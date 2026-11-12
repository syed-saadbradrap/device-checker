import { enforceRateLimit } from "@/lib/api/http";
import { safeFetch } from "@/lib/preview/safe-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 12_000_000;

const ALLOWED_TYPE =
  /^(image\/|font\/|application\/(font|x-font|vnd\.ms-fontobject|octet-stream)|binary\/octet-stream)/i;
const ALLOWED_EXT = /\.(woff2?|ttf|otf|eot|png|jpe?g|gif|webp|avif|svg|ico|bmp)(\?|#|$)/i;

const CORS = {
  "access-control-allow-origin": "*",
  "cross-origin-resource-policy": "cross-origin",
};

function fail(status: number, message: string) {
  return new Response(message, { status, headers: { "content-type": "text/plain", ...CORS } });
}

type Asset = { buf: Buffer; type: string };
type Outcome = { ok: true; asset: Asset } | { ok: false; status: number; message: string };

// One Launch loads the same images/fonts in every device frame (and again on Reload): fetch each once.
// Small in-memory LRU + in-flight de-duplication also keeps us under upstream rate limits.
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX_BYTES = 80_000_000;
const CACHE_ITEM_MAX = 4_000_000;
const cache = new Map<string, { at: number; asset: Asset }>();
const inflight = new Map<string, Promise<Outcome>>();
let cacheBytes = 0;

function cacheGet(key: string): Asset | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    cacheBytes -= hit.asset.buf.byteLength;
    return null;
  }
  // refresh LRU position
  cache.delete(key);
  cache.set(key, hit);
  return hit.asset;
}

function cacheSet(key: string, asset: Asset) {
  if (asset.buf.byteLength > CACHE_ITEM_MAX) return;
  cache.set(key, { at: Date.now(), asset });
  cacheBytes += asset.buf.byteLength;
  while (cacheBytes > CACHE_MAX_BYTES && cache.size) {
    const oldest = cache.keys().next().value as string;
    cacheBytes -= cache.get(oldest)!.asset.buf.byteLength;
    cache.delete(oldest);
  }
}

async function fetchOnce(target: string): Promise<Outcome> {
  let referer: string | undefined;
  try {
    referer = new URL(target).origin + "/";
  } catch {
    referer = undefined;
  }
  const { res } = await safeFetch(target, {
    accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    timeoutMs: 20000,
    referer,
  });
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    return { ok: false, status: res.status === 404 ? 404 : res.status === 429 || res.status >= 500 ? 503 : 502, message: `Upstream error ${res.status}` };
  }
  const type = res.headers.get("content-type") || "application/octet-stream";
  if (!ALLOWED_TYPE.test(type) && !ALLOWED_EXT.test(target)) {
    await res.body?.cancel().catch(() => undefined);
    return { ok: false, status: 415, message: "Only images and fonts are proxied" };
  }
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > MAX_BYTES) {
    await res.body?.cancel().catch(() => undefined);
    return { ok: false, status: 413, message: "Too large" };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) return { ok: false, status: 413, message: "Too large" };
  return { ok: true, asset: { buf, type: type.startsWith("text/") ? "application/octet-stream" : type } };
}

// A page can reference dozens of images on one CDN (e.g. wikimedia rate-limits bursts with 429): cap per-host concurrency.
const PER_HOST_LIMIT = 6;
const hostActive = new Map<string, number>();
const hostWaiters = new Map<string, Array<() => void>>();

async function withHostSlot<T>(host: string, fn: () => Promise<T>): Promise<T> {
  while ((hostActive.get(host) ?? 0) >= PER_HOST_LIMIT) {
    await new Promise<void>((resolve) => {
      const q = hostWaiters.get(host) ?? [];
      q.push(resolve);
      hostWaiters.set(host, q);
    });
  }
  hostActive.set(host, (hostActive.get(host) ?? 0) + 1);
  try {
    return await fn();
  } finally {
    hostActive.set(host, (hostActive.get(host) ?? 1) - 1);
    hostWaiters.get(host)?.shift()?.();
  }
}

async function load(target: string): Promise<Outcome> {
  let last: Outcome = { ok: false, status: 502, message: "Could not fetch asset" };
  let host = "";
  try {
    host = new URL(target).host;
  } catch {
    return { ok: false, status: 400, message: "Invalid url" };
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      last = await withHostSlot(host, () => fetchOnce(target));
    } catch {
      last = { ok: false, status: 502, message: "Could not fetch asset" };
    }
    // Retry transient failures (rate limits / flaky CDNs) with a short backoff.
    if (last.ok || (last.status !== 503 && last.status !== 502)) return last;
    await new Promise((r) => setTimeout(r, 250 * (attempt + 1) ** 2));
  }
  return last;
}

/**
 * Asset proxy for live preview: fonts (CORS) + images (hotlink / referrer blocks).
 * SSRF-checked; only image/font content types (or known extensions) are returned.
 */
export async function GET(request: Request) {
  const limited = enforceRateLimit(request, "preview-asset", { max: 6000 });
  if (!limited.allowed) return fail(429, "Rate limit exceeded");

  const target = new URL(request.url).searchParams.get("url") || "";
  if (!target) return fail(400, "url required");

  let asset = cacheGet(target);
  if (!asset) {
    let p = inflight.get(target);
    if (!p) {
      p = load(target).finally(() => inflight.delete(target));
      inflight.set(target, p);
    }
    const out = await p;
    if (!out.ok) return fail(out.status, out.message);
    asset = out.asset;
    cacheSet(target, asset);
  }

  return new Response(new Uint8Array(asset.buf), {
    status: 200,
    headers: {
      "content-type": asset.type,
      "cache-control": "public, max-age=86400",
      "x-content-type-options": "nosniff",
      // SVGs can carry scripts; if one is opened directly it must not run on DeviceLab's origin.
      "content-security-policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      ...CORS,
    },
  });
}
