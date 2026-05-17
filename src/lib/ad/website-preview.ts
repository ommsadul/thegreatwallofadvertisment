import dns from "node:dns/promises";
import net from "node:net";

export type WebsitePreview = {
  headline: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
  screenshotUrl: string | null;
  warning: string | null;
};

const MAX_REDIRECTS = 5;
const DEFAULT_USER_AGENT =
  "TheGreatWallOfAdvertisementBot/1.0 (+https://thegreatwallofadvertisment.com)";

function parseTargetUrl(targetUrl: string): URL | null {
  try {
    return new URL(targetUrl);
  } catch {
    return null;
  }
}

export function buildWebsiteScreenshotUrl(targetUrl: string): string | null {
  const parsed = parseTargetUrl(targetUrl);
  if (!parsed || !isAllowedProtocol(parsed) || isBlockedHostname(parsed.hostname)) {
    return null;
  }

  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(parsed.toString())}?w=1200`;
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

function decodeHtmlText(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function isAllowedProtocol(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:";
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");

  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "0" ||
    normalized === "0.0.0.0" ||
    normalized === "::" ||
    normalized === "::1" ||
    normalized.endsWith(".local")
  );
}

function isBlockedIpAddress(address: string): boolean {
  const ipVersion = net.isIP(address);

  if (ipVersion === 0) {
    return false;
  }

  if (ipVersion === 4) {
    const [a = 0, b = 0] = address.split(".").map(Number);

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }

  const normalized = address.toLowerCase();

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:169.254.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

export async function assertPublicHttpUrl(targetUrl: string): Promise<URL | null> {
  const parsed = parseTargetUrl(targetUrl);
  if (!parsed || !isAllowedProtocol(parsed) || parsed.username || parsed.password) {
    return null;
  }

  if (isBlockedHostname(parsed.hostname)) {
    return null;
  }

  const ipVersion = net.isIP(parsed.hostname);
  if (ipVersion !== 0) {
    return isBlockedIpAddress(parsed.hostname) ? null : parsed;
  }

  try {
    const addresses = await dns.lookup(parsed.hostname, { all: true, verbatim: true });
    if (
      addresses.length === 0 ||
      addresses.some(({ address }) => isBlockedIpAddress(address))
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return parsed;
}

export async function fetchPublicResource(
  initialUrl: URL,
  signal: AbortSignal,
  headers: HeadersInit,
): Promise<Response> {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",
      signal,
      headers,
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) {
      return response;
    }

    const nextUrl = await assertPublicHttpUrl(new URL(location, currentUrl).toString());
    if (!nextUrl) {
      throw new Error("Redirect target is not allowed.");
    }

    currentUrl = nextUrl;
  }

  throw new Error("Too many redirects.");
}

async function fetchPublicHtml(
  initialUrl: URL,
  signal: AbortSignal,
): Promise<Response> {
  return fetchPublicResource(initialUrl, signal, {
    "User-Agent": DEFAULT_USER_AGENT,
    Accept: "text/html,application/xhtml+xml",
  });
}

export async function fetchWebsitePreview(
  targetUrl: string,
  timeoutMs = 7000,
): Promise<WebsitePreview> {
  const safeTargetUrl = await assertPublicHttpUrl(targetUrl);
  const screenshotUrl = safeTargetUrl
    ? buildWebsiteScreenshotUrl(safeTargetUrl.toString())
    : null;

  if (!safeTargetUrl) {
    return {
      headline: null,
      imageUrl: null,
      faviconUrl: null,
      screenshotUrl,
      warning: "URL must be a public http or https website.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchPublicHtml(safeTargetUrl, controller.signal);

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
    const ogImage =
      extractMetaContent(html, "og:image:secure_url") ??
      extractMetaContent(html, "og:image");
    const twitterImage =
      extractMetaContent(html, "twitter:image:src") ??
      extractMetaContent(html, "twitter:image");
    const title = extractTitle(html);
    const favicon = extractFavicon(html);

    return {
      headline: ogTitle || title ? decodeHtmlText(ogTitle || title || "") : null,
      imageUrl:
        ogImage || twitterImage
          ? normalizeUrl(finalUrl, ogImage || twitterImage || "")
          : null,
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
