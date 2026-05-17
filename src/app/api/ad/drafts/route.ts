import { NextRequest, NextResponse } from "next/server";

import { AdDraftInputError, createAdDraft } from "@/lib/ad/ad-drafts";
import {
  getSupabaseAdminClient,
  hasSupabaseServiceEnv,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

type Payload = {
  targetUrl: string;
  customerEmail?: string;
  headline?: string;
  imageUrl?: string;
};

function isPayload(value: unknown): value is Payload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.targetUrl === "string" &&
    /^https?:\/\//i.test(candidate.targetUrl) &&
    (candidate.customerEmail === undefined ||
      typeof candidate.customerEmail === "string") &&
    (candidate.headline === undefined || typeof candidate.headline === "string") &&
    (candidate.imageUrl === undefined || typeof candidate.imageUrl === "string")
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isPayload(body)) {
    return NextResponse.json(
      {
        error:
          "Expected targetUrl starting with http or https. Optional fields: customerEmail, headline, imageUrl.",
      },
      { status: 400 },
    );
  }

  if (!hasSupabaseServiceEnv()) {
    return NextResponse.json(
      {
        error:
          "Supabase environment is not configured yet. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 503 },
    );
  }

  try {
    const draft = await createAdDraft({
      supabase: getSupabaseAdminClient(),
      targetUrl: body.targetUrl,
      customerEmail: body.customerEmail,
      headline: body.headline,
      imageUrl: body.imageUrl,
    });

    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    if (error instanceof AdDraftInputError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: "Failed to prepare ad preview.",
        details: error instanceof Error ? error.message : "Unknown error.",
      },
      { status: 500 },
    );
  }
}
