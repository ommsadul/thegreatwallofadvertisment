import { NextRequest, NextResponse } from "next/server";

import { fetchWebsitePreview } from "@/lib/ad/website-preview";

export const runtime = "nodejs";

type Payload = {
  targetUrl: string;
};

function isPayload(value: unknown): value is Payload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.targetUrl === "string" &&
    /^https?:\/\//i.test(candidate.targetUrl)
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
      { error: "Expected targetUrl starting with http or https." },
      { status: 400 },
    );
  }

  const preview = await fetchWebsitePreview(body.targetUrl);

  return NextResponse.json({
    headline: preview.headline,
    imageUrl: preview.imageUrl ?? preview.screenshotUrl,
    faviconUrl: preview.faviconUrl,
    warning: preview.warning,
  });
}
