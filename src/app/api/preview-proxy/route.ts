import { validatePublicUrl } from "@/lib/security/url";
import { capturePageHtml } from "@/lib/browser/playwright";
import {
  errorPageHtml,
  looksLikeChallengePage,
  looksLikeEmptyShell,
  prepareProxiedHtml,
  resolveDocumentBase,
  type ProxyMode,
} from "@/lib/preview/proxy-html";
import { ASSET_PLACEHOLDER, fixMediaForProxy, inlineStyles } from "@/lib/preview/css";
import { PREVIEW_UA, readTextLimited, safeFetch } from "@/lib/preview/safe-fetch";
import { enforceRateLimit, publicErrorMessage } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_HTML_BYTES = 6_000_000;

type Source = {
  html: string; // raw page HTML with stylesheets inlined
  finalUrl: string;
  /** Rendered with a real browser (JS already executed) – must not run scripts again. */
  rendered: boolean;
};

// All device frames for one Launch hit this route with the same url+r, so share the work.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; promise: Promise<Source> }>();

function cacheGet(key: string, make: () => Promise<Source>): Promise<Source> {
  const now = Date.now();
  for (const [k, v] of cache) if (now - v.at > CACHE_TTL_MS) cache.delete(k);
  const hit = cache.get(key);
  if (hit) return hit.promise;
  const promise = make();
  cache.set(key, { at: now, promise });
  promise.catch(() => cache.delete(key));
  while (cache.size > 40) cache.delete(cache.keys().next().value as string);
  return promise;
}

async function fetchHtmlDirect(url: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const { res, finalUrl } = await safeFetch(url, {
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      timeoutMs: 20000,
    });
    const type = (res.headers.get("content-type") || "").toLowerCase();
    if (!res.ok || (!type.includes("text/html") && !type.includes("application/xhtml"))) {
      await res.body?.cancel().catch(() => undefined);
      return null;
    }
    const html = await readTextLimited(res, MAX_HTML_BYTES);
    if (!html || looksLikeChallengePage(html)) return null;
    return { html, finalUrl };
  } catch {
    return null;
  }
}

async function loadSource(url: string, width: number, height: number): Promise<Source> {
  const direct = await fetchHtmlDirect(url);
  if (direct && !looksLikeEmptyShell(direct.html)) {
    const base = resolveDocumentBase(direct.html, direct.finalUrl);
    const html = await inlineStyles(direct.html, base, direct.finalUrl);
    return { html, finalUrl: direct.finalUrl, rendered: false };
  }

  // Bot-walled or client-rendered site: let a real browser render it, then snapshot the DOM.
  try {
    const captured = await capturePageHtml({ url, width, height, userAgent: PREVIEW_UA });
    if (looksLikeChallengePage(captured.html) || captured.html.length < 400) {
      throw new Error(
        "This site uses bot protection (CAPTCHA) and blocks automated previews. Use “Open in new tab” to view it directly."
      );
    }
    const base = resolveDocumentBase(captured.html, captured.finalUrl);
    const html = await inlineStyles(captured.html, base, captured.finalUrl);
    return { html, finalUrl: captured.finalUrl, rendered: true };
  } catch (e) {
    if (direct) {
      const base = resolveDocumentBase(direct.html, direct.finalUrl);
      const html = await inlineStyles(direct.html, base, direct.finalUrl);
      return { html, finalUrl: direct.finalUrl, rendered: false };
    }
    throw e;
  }
}

function htmlResponse(body: string, status: number, extra: Record<string, string> = {}) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extra,
    },
  });
}

// Embeddable only by DeviceLab itself. `sandbox` makes the proxied document an opaque origin even when
// opened directly (so a third-party site's scripts never get access to DeviceLab's cookies/APIs).
function securityHeaders(mode: ProxyMode): Record<string, string> {
  // Do not add allow-same-origin here: this response is served from DeviceLab's origin.
  const sandbox =
    mode === "live"
      ? "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-presentation"
      : "sandbox allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation";
  return {
    "content-security-policy": `${sandbox}; frame-ancestors 'self'`,
    "referrer-policy": "strict-origin-when-cross-origin",
  };
}

export async function GET(request: Request) {
  // Each Launch loads several frames (+ link clicks); keep the limit generous.
  const limited = enforceRateLimit(request, "preview-proxy", { max: 240 });
  if (!limited.allowed) {
    return htmlResponse(
      errorPageHtml("Too many previews", "Please wait a few seconds and press Reload previews."),
      429,
      securityHeaders("static")
    );
  }

  let rawUrl = "";
  try {
    const { searchParams } = new URL(request.url);
    rawUrl = searchParams.get("url") || "";
    if (!rawUrl.trim()) {
      return htmlResponse(errorPageHtml("No URL", "A website address is required."), 400, securityHeaders("static"));
    }

    const safe = await validatePublicUrl(rawUrl);
    if (!safe.ok) {
      return htmlResponse(errorPageHtml("This address can't be previewed", safe.error), 400, securityHeaders("static"));
    }

    const width = Math.min(Math.max(Number(searchParams.get("width") || 1280) || 1280, 200), 3840);
    const height = Math.min(Math.max(Number(searchParams.get("height") || 800) || 800, 200), 3840);
    const wantedMode: ProxyMode = searchParams.get("scripts") === "0" ? "static" : "live";
    const refresh = searchParams.get("r") || "";

    const source = await cacheGet(`${safe.url}|${refresh}`, () => loadSource(safe.url, width, height));

    // A browser-rendered snapshot already ran the site's JS; running it again would double-mount SPAs.
    const mode: ProxyMode = source.rendered ? "static" : wantedMode;
    // Root-relative URLs would resolve against the injected <base href> (the remote site), so use absolute ones.
    const origin = new URL(request.url).origin;
    const prepared = prepareProxiedHtml(source.html, source.finalUrl, `${origin}/api/preview-proxy`, {
      mode,
      width,
      height,
    });
    const withMedia = fixMediaForProxy(prepared, resolveDocumentBase(source.html, source.finalUrl));
    const body = withMedia.split(ASSET_PLACEHOLDER).join(`${origin}/api/preview-asset`);

    return htmlResponse(body, 200, {
      ...securityHeaders(mode),
      "x-devicelab-preview": mode,
      "x-devicelab-final-url": source.finalUrl,
    });
  } catch (e) {
    return htmlResponse(
      errorPageHtml("Preview unavailable", publicErrorMessage(e, "Could not load this site."), rawUrl || undefined),
      502,
      securityHeaders("static")
    );
  }
}
