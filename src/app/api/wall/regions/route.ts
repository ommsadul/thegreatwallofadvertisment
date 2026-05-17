import { NextRequest, NextResponse } from "next/server";

import { normalizeRectBigInt, parsePixelRectBigInt } from "@/lib/selection";
import {
  getSupabaseAdminClient,
  hasSupabaseServiceEnv,
} from "@/lib/supabase/server";
import { integerLikeToSafeNumber } from "@/lib/wall/serialization";

type RegionPayload = {
  x1: bigint;
  y1: bigint;
  x2: bigint;
  y2: bigint;
};

type RegionRow = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  state: "sold" | "pending";
  ad: {
    imageUrl: string | null;
    targetUrl: string | null;
    headline: string | null;
  } | null;
};

function mapToRegionRows(
  input: Array<Record<string, unknown>>,
  state: "sold" | "pending",
  adBySubmissionId?: Map<
    string,
    {
      imageUrl: string | null;
      targetUrl: string | null;
      headline: string | null;
    }
  >,
): RegionRow[] {
  return input
    .map((row) => {
      const x1 = integerLikeToSafeNumber(row.x1);
      const y1 = integerLikeToSafeNumber(row.y1);
      const x2 = integerLikeToSafeNumber(row.x2);
      const y2 = integerLikeToSafeNumber(row.y2);

      if (
        typeof row.id !== "string" ||
        x1 === null ||
        y1 === null ||
        x2 === null ||
        y2 === null
      ) {
        return null;
      }

      return {
        id: row.id,
        x1,
        y1,
        x2,
        y2,
        state,
          ad:
            state === "sold" &&
            typeof row.submission_id === "string" &&
            adBySubmissionId
              ? (adBySubmissionId.get(row.submission_id) ?? null)
              : null,
      };
    })
    .filter((row): row is RegionRow => row !== null);
}

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parsePixelRectBigInt(payload);

  if (!parsed) {
    return NextResponse.json(
      {
        error:
          "Expected viewport with integer x1,y1,x2,y2 (number or integer string).",
      },
      { status: 400 },
    );
  }

  const viewport: RegionPayload = normalizeRectBigInt(parsed);

  if (!hasSupabaseServiceEnv()) {
    return NextResponse.json(
      {
        regions: [],
        warning:
          "Supabase environment is not configured yet. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 503 },
    );
  }

  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const { data: soldDataRaw, error: soldError } = await supabase
    .from("pixel_regions")
    .select("id,x1,y1,x2,y2,submission_id")
    .gt("lease_ends_at", nowIso)
    .lte("x1", viewport.x2.toString())
    .gte("x2", viewport.x1.toString())
    .lte("y1", viewport.y2.toString())
    .gte("y2", viewport.y1.toString())
    .limit(300);

  if (soldError) {
    return NextResponse.json(
      {
        error: "Failed to load sold regions.",
        details: soldError.message,
      },
      { status: 500 },
    );
  }

  const soldSubmissionIds = ((soldDataRaw ?? []) as Array<Record<string, unknown>>)
    .map((row) => row.submission_id)
    .filter((id): id is string => typeof id === "string");

  const uniqueSubmissionIds = [...new Set(soldSubmissionIds)];
  let adBySubmissionId = new Map<
    string,
    {
      imageUrl: string | null;
      targetUrl: string | null;
      headline: string | null;
    }
  >();

  if (uniqueSubmissionIds.length > 0) {
    const { data: adRowsRaw, error: adRowsError } = await supabase
      .from("ad_submissions")
      .select("id,image_url,target_url,headline")
      .in("id", uniqueSubmissionIds)
      .limit(300);

    if (adRowsError) {
      return NextResponse.json(
        {
          error: "Failed to load ad metadata for sold regions.",
          details: adRowsError.message,
        },
        { status: 500 },
      );
    }

    adBySubmissionId = new Map(
      ((adRowsRaw ?? []) as Array<Record<string, unknown>>)
        .map((row) => {
          if (typeof row.id !== "string") {
            return null;
          }

          return [
            row.id,
            {
              imageUrl: typeof row.image_url === "string" ? row.image_url : null,
              targetUrl: typeof row.target_url === "string" ? row.target_url : null,
              headline: typeof row.headline === "string" ? row.headline : null,
            },
          ] as const;
        })
        .filter(
          (
            item,
          ): item is readonly [
            string,
            { imageUrl: string | null; targetUrl: string | null; headline: string | null },
          ] => item !== null,
        ),
    );
  }

  const { data: pendingRaw, error: pendingError } = await supabase
    .from("pixel_reservations")
    .select("id,x1,y1,x2,y2")
    .eq("status", "pending")
    .gt("expires_at", nowIso)
    .lte("x1", viewport.x2.toString())
    .gte("x2", viewport.x1.toString())
    .lte("y1", viewport.y2.toString())
    .gte("y2", viewport.y1.toString())
    .limit(300);

  if (pendingError) {
    return NextResponse.json(
      {
        error: "Failed to load pending regions.",
        details: pendingError.message,
      },
      { status: 500 },
    );
  }

  const soldRows = mapToRegionRows(
    (soldDataRaw ?? []) as Array<Record<string, unknown>>,
    "sold",
    adBySubmissionId,
  );
  const pendingRows = mapToRegionRows(
    (pendingRaw ?? []) as Array<Record<string, unknown>>,
    "pending",
  );

  const seen = new Set<string>();
  const merged = [...soldRows, ...pendingRows].filter((row) => {
    const key = `${row.x1}:${row.y1}:${row.x2}:${row.y2}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  return NextResponse.json({
    regions: merged,
  });
}
