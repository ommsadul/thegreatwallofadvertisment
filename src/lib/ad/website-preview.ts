export type WebsitePreview = {
  headline: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
  screenshotUrl: string | null;
  warning: string | null;
};

function normalizeTargetUrl(targetUrl: string): string | null {
  try {
    return new URL(targetUrl).toString();
  } catch {
    return null;
  }
}

export function buildWebsiteScreenshotUrl(targetUrl: string): string | null {
  const normalized = normalizeTargetUrl(targetUrl);
  if (!normalized) {
    return null;
  }

  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(normalized)}?w=1200`;
}

function normalizeUrl(baseUrl: string, maybeRelative: string): string | null {
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractMetaContent(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=['\"]${escaped}['\"][^>]*content=['\"]([^'\"]+)['\"][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=['\"]([^'\"]+)['\"][^>]*(?:property|name)=['\"]${escaped}['\"][^>]*>`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function extractTitle(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!titleMatch?.[1]) {
    return null;
  }

  return titleMatch[1].trim();
}

function extractFavicon(html: string): string | null {
  const faviconPatterns = [
    /<link[^>]+rel=['\"][^'\"]*icon[^'\"]*['\"][^>]+href=['\"]([^'\"]+)['\"][^>]*>/i,
    /<link[^>]+href=['\"]([^'\"]+)['\"][^>]+rel=['\"][^'\"]*icon[^'\"]*['\"][^>]*>/i,
  ];

  for (const pattern of faviconPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

export async function fetchWebsitePreview(
  targetUrl: string,
  timeoutMs = 7000,
): Promise<WebsitePreview> {
  const screenshotUrl = buildWebsiteScreenshotUrl(targetUrl);

  if (!/^https?:\/\//i.test(targetUrl)) {
    return {
      headline: null,
      imageUrl: null,
      faviconUrl: null,
      screenshotUrl,
      warning: "URL must start with http or https.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "2MillionDollarWallBot/1.0 (+http://localhost)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        headline: null,
        imageUrl: null,
        faviconUrl: null,
        screenshotUrl,
        warning: `Failed to fetch URL (${response.status}).`,
      };
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return {
        headline: null,
        imageUrl: null,
        faviconUrl: null,
        screenshotUrl,
        warning: "URL did not return HTML.",
      };
    }

    const html = await response.text();
    const finalUrl = response.url;

    const ogTitle = extractMetaContent(html, "og:title");
    const ogImage = extractMetaContent(html, "og:image");
    const twitterImage = extractMetaContent(html, "twitter:image");
    const title = extractTitle(html);
    const favicon = extractFavicon(html);

    return {
      headline: ogTitle || title || null,
      imageUrl: ogImage || twitterImage ? normalizeUrl(finalUrl, ogImage || twitterImage || "") : null,
      faviconUrl: favicon ? normalizeUrl(finalUrl, favicon) : null,
      screenshotUrl,
      warning: null,
    };
  } catch {
    clearTimeout(timeout);
    return {
      headline: null,
      imageUrl: null,
      faviconUrl: null,
      screenshotUrl,
      warning: "Could not fetch metadata from this URL.",
    };
  }
}
