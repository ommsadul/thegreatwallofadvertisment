import { Buffer } from "node:buffer";
import crypto from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  assertPublicHttpUrl,
  fetchPublicResource,
  fetchWebsitePreview,
} from "./website-preview";

export const AD_ASSETS_BUCKET = "ad-assets";

const MAX_AD_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_HEADLINE_LENGTH = 96;
const IMAGE_ACCEPT_HEADER = "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8";
const IMAGE_USER_AGENT =
  "TheGreatWallOfAdvertisementBot/1.0 (+https://thegreatwallofadvertisment.com)";

const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

type StoredAsset = {
  sourceUrl: string;
  path: string;
  publicUrl: string;
  contentType: string;
  byteSize: number;
};

type RemoteImageAsset = {
  sourceUrl: string;
  bytes: Buffer;
  contentType: string;
  extension: string;
};

export type AdDraftClient = {
  id: string;
  status: "draft" | "ready" | "failed" | "published";
  targetUrl: string;
  sourceImageUrl: string | null;
  imageUrl: string | null;
  imagePath: string | null;
  headline: string | null;
  warning: string | null;
};

export type CreateAdDraftInput = {
  supabase: SupabaseClient;
  targetUrl: string;
  customerEmail?: string | null;
  headline?: string | null;
  imageUrl?: string | null;
};

type AdDraftRow = {
  id: string;
  status: AdDraftClient["status"];
  target_url: string;
  source_image_url: string | null;
  stored_image_path: string | null;
  stored_image_url: string | null;
  headline: string | null;
  error_message: string | null;
};

export class AdDraftInputError extends Error {
  status = 400;
}

function cleanOptionalString(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function sanitizeAdHeadline(value: string | null | undefined): string | null {
  const trimmed = cleanOptionalString(value)?.replace(/\s+/g, " ");

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, MAX_HEADLINE_LENGTH);
}

function hostnameHeadline(targetUrl: string): string {
  try {
    return new URL(targetUrl).hostname.replace(/^www\./i, "");
  } catch {
    return "Sponsored";
  }
}

function normalizeContentType(contentType: string | null): {
  contentType: string;
  extension: string;
} | null {
  const normalized = contentType?.split(";")[0]?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const extension = ALLOWED_IMAGE_TYPES.get(normalized);

  return extension ? { contentType: normalized, extension } : null;
}

async function readLimitedBody(
  response: Response,
  maxBytes: number,
): Promise<Buffer> {
  const reader = response.body?.getReader();

  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.byteLength > maxBytes) {
      throw new Error("Image is larger than the 5 MB limit.");
    }

    return buffer;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    const chunk = Buffer.from(value);
    totalBytes += chunk.byteLength;

    if (totalBytes > maxBytes) {
      throw new Error("Image is larger than the 5 MB limit.");
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks, totalBytes);
}

async function fetchRemoteImageAsset(
  imageUrl: string,
  timeoutMs = 8000,
): Promise<RemoteImageAsset> {
  const safeImageUrl = await assertPublicHttpUrl(imageUrl);

  if (!safeImageUrl) {
    throw new Error("Image URL must be a public http or https image.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchPublicResource(safeImageUrl, controller.signal, {
      "User-Agent": IMAGE_USER_AGENT,
      Accept: IMAGE_ACCEPT_HEADER,
    });

    if (!response.ok) {
      throw new Error(`Image request failed (${response.status}).`);
    }

    const type = normalizeContentType(response.headers.get("content-type"));

    if (!type) {
      throw new Error("Image must be JPEG, PNG, or WebP.");
    }

    const contentLength = Number(response.headers.get("content-length") ?? "0");

    if (Number.isFinite(contentLength) && contentLength > MAX_AD_IMAGE_BYTES) {
      throw new Error("Image is larger than the 5 MB limit.");
    }

    const bytes = await readLimitedBody(response, MAX_AD_IMAGE_BYTES);

    return {
      sourceUrl: response.url || safeImageUrl.toString(),
      bytes,
      contentType: type.contentType,
      extension: type.extension,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function uploadAdAsset(
  supabase: SupabaseClient,
  draftId: string,
  asset: RemoteImageAsset,
): Promise<StoredAsset> {
  const digest = crypto
    .createHash("sha256")
    .update(asset.bytes)
    .digest("hex")
    .slice(0, 24);
  const path = `drafts/${draftId}/${Date.now()}-${digest}.${asset.extension}`;
  const { error } = await supabase.storage
    .from(AD_ASSETS_BUCKET)
    .upload(path, asset.bytes, {
      cacheControl: "31536000",
      contentType: asset.contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to store ad image: ${error.message}`);
  }

  const { data } = supabase.storage.from(AD_ASSETS_BUCKET).getPublicUrl(path);

  return {
    sourceUrl: asset.sourceUrl,
    path,
    publicUrl: data.publicUrl,
    contentType: asset.contentType,
    byteSize: asset.bytes.byteLength,
  };
}

function mapDraft(row: AdDraftRow): AdDraftClient {
  return {
    id: row.id,
    status: row.status,
    targetUrl: row.target_url,
    sourceImageUrl: row.source_image_url,
    imageUrl: row.stored_image_url,
    imagePath: row.stored_image_path,
    headline: row.headline,
    warning: row.error_message,
  };
}

function uniqueImageCandidates(values: Array<string | null>): string[] {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    next.push(value);
  }

  return next;
}

export async function createAdDraft(input: CreateAdDraftInput): Promise<AdDraftClient> {
  const safeTargetUrl = await assertPublicHttpUrl(input.targetUrl);

  if (!safeTargetUrl) {
    throw new AdDraftInputError("Destination URL must be a public http or https website.");
  }

  const preview = await fetchWebsitePreview(safeTargetUrl.toString());
  const headline =
    sanitizeAdHeadline(input.headline) ??
    sanitizeAdHeadline(preview.headline) ??
    hostnameHeadline(safeTargetUrl.toString());
  const requestedImageUrl = cleanOptionalString(input.imageUrl);
  const imageCandidates = uniqueImageCandidates([
    requestedImageUrl,
    preview.imageUrl,
    preview.screenshotUrl,
  ]);

  const { data: draft, error: insertError } = await input.supabase
    .from("ad_drafts")
    .insert({
      customer_email: cleanOptionalString(input.customerEmail),
      target_url: safeTargetUrl.toString(),
      source_image_url: requestedImageUrl ?? preview.imageUrl ?? preview.screenshotUrl,
      headline,
      status: "draft",
      error_message: preview.warning,
    })
    .select("id,status,target_url,source_image_url,stored_image_path,stored_image_url,headline,error_message")
    .single<AdDraftRow>();

  if (insertError || !draft) {
    throw new Error(insertError?.message ?? "Failed to create ad draft.");
  }

  let storedAsset: StoredAsset | null = null;
  let warning = preview.warning;

  for (const candidate of imageCandidates) {
    try {
      const remoteAsset = await fetchRemoteImageAsset(candidate);
      storedAsset = await uploadAdAsset(input.supabase, draft.id, remoteAsset);
      warning =
        requestedImageUrl && candidate !== requestedImageUrl
          ? "Optional image URL could not be used, so a website preview image was stored instead."
          : warning;
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Image could not be stored.";
      warning =
        candidate === requestedImageUrl
          ? message
          : (warning ?? message);
    }
  }

  if (!storedAsset && imageCandidates.length > 0) {
    warning =
      warning ??
      "No usable image was found, so the wall tile will use your headline and destination.";
  }

  const { data: updatedDraft, error: updateError } = await input.supabase
    .from("ad_drafts")
    .update({
      source_image_url: storedAsset?.sourceUrl ?? draft.source_image_url,
      stored_image_path: storedAsset?.path ?? null,
      stored_image_url: storedAsset?.publicUrl ?? null,
      image_content_type: storedAsset?.contentType ?? null,
      image_byte_size: storedAsset?.byteSize ?? null,
      headline,
      status: "ready",
      error_message: warning,
    })
    .eq("id", draft.id)
    .select("id,status,target_url,source_image_url,stored_image_path,stored_image_url,headline,error_message")
    .single<AdDraftRow>();

  if (updateError || !updatedDraft) {
    throw new Error(updateError?.message ?? "Failed to update ad draft.");
  }

  return mapDraft(updatedDraft);
}
