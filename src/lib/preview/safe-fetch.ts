import { assertSafeRedirectTarget, validatePublicUrl } from "@/lib/security/url";

export const PREVIEW_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

export type SafeFetchResult = {
  res: Response;
  finalUrl: string;
};

/**
 * SSRF-safe fetch: validates the target and every redirect hop (manual redirects),
 * so a public URL can't bounce us to a private/metadata address.
 */
export async function safeFetch(
  url: string,
  opts: { accept?: string; timeoutMs?: number; maxHops?: number; referer?: string } = {}
): Promise<SafeFetchResult> {
  const maxHops = opts.maxHops ?? 6;
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 20000);
  let current = url;

  for (let hop = 0; hop <= maxHops; hop++) {
    const check = hop === 0 ? await validatePublicUrl(current) : await assertSafeRedirectTarget(current);
    if (!check.ok) throw new Error(check.error);

    const headers: Record<string, string> = {
      "user-agent": PREVIEW_UA,
      accept: opts.accept ?? "*/*",
      "accept-language": "en-US,en;q=0.9",
    };
    if (opts.referer) headers.referer = opts.referer;

    const res = await fetch(check.url, { redirect: "manual", headers, signal });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { res, finalUrl: check.url };
      current = new URL(loc, check.url).href;
      await res.body?.cancel().catch(() => undefined);
      continue;
    }
    return { res, finalUrl: check.url };
  }
  throw new Error("Too many redirects");
}

/** Read a response body as text but refuse anything larger than maxBytes. */
export async function readTextLimited(res: Response, maxBytes: number): Promise<string | null> {
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared && declared > maxBytes) {
    await res.body?.cancel().catch(() => undefined);
    return null;
  }
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const charset = /charset=([\w-]+)/i.exec(res.headers.get("content-type") || "")?.[1] || "utf-8";
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(charset);
  } catch {
    decoder = new TextDecoder("utf-8");
  }
  return decoder.decode(Buffer.concat(chunks));
}
