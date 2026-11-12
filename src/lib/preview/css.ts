import { readTextLimited, safeFetch } from "@/lib/preview/safe-fetch";

/** Replaced with the real DeviceLab origin per request (the cached HTML is origin-agnostic). */
export const ASSET_PLACEHOLDER = "https://__devicelab_asset__";

const MAX_SHEETS = 32;
const MAX_SHEET_BYTES = 6_000_000;
const MAX_IMPORT_DEPTH = 2;
const MAX_IMPORTS_PER_SHEET = 8;

function assetUrl(abs: string): string {
  // encodeURIComponent leaves ' ( ) unescaped; escape them so the URL is safe inside url('...') and attributes.
  const enc = encodeURIComponent(abs).replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29");
  return `${ASSET_PLACEHOLDER}?url=${enc}`;
}

function absolutize(raw: string, base: string): string | null {
  const v = raw.trim();
  if (!v || v.startsWith("#") || /^(data:|blob:|about:)/i.test(v)) return null;
  try {
    const abs = new URL(v, base);
    return /^https?:$/.test(abs.protocol) ? abs.href : null;
  } catch {
    return null;
  }
}

/**
 * Make a stylesheet position-independent so it can be inlined into the proxied document:
 * - url() become absolute, then go through /api/preview-asset (hotlink / no-referrer blocks
 *   break remote background images + fonts when the document is served from DeviceLab)
 * - `quote` lets the same logic work inside style="..." attributes (single quotes there)
 * `@import` is handled by resolveImports() before this runs.
 */
export function rewriteCss(css: string, cssBase: string, quote: '"' | "'" = '"'): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+?)\1\s*\)/gi, (m, _q: string, raw: string) => {
    if (raw.trim().startsWith(ASSET_PLACEHOLDER)) return m; // already proxied
    const abs = absolutize(raw.replace(/&amp;/g, "&"), cssBase);
    if (!abs) return m;
    return `url(${quote}${assetUrl(abs)}${quote})`;
  });
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** srcset candidates are separated by commas, but URLs may contain commas (CDN transforms), so parse by tokens. */
function rewriteSrcset(value: string, base: string): string {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let url: string | null = null;
  let desc = "";
  const flush = () => {
    if (url == null) return;
    const abs = absolutize(url, base);
    out.push(`${abs ? assetUrl(abs) : url}${desc ? ` ${desc}` : ""}`);
    url = null;
    desc = "";
  };
  for (const t of tokens) {
    if (url == null) {
      if (t.endsWith(",")) {
        url = t.slice(0, -1);
        flush();
      } else {
        url = t;
      }
    } else if (/^\d*\.?\d+[wx],?$/i.test(t)) {
      desc = t.replace(/,$/, "");
      flush();
    } else if (t === ",") {
      flush();
    } else {
      // A new URL started without a descriptor for the previous one.
      flush();
      url = t.endsWith(",") ? t.slice(0, -1) : t;
      if (t.endsWith(",")) flush();
    }
  }
  flush();
  return out.join(", ");
}

function setOrReplaceAttr(tag: string, name: string, value: string): string {
  const re = new RegExp(`(\\s${name}\\s*=\\s*)(?:"[^"]*"|'[^']*'|[^\\s>]+)`, "i");
  if (re.test(tag)) return tag.replace(re, (_m, p1: string) => `${p1}"${escapeAttr(value)}"`);
  return tag.replace(/^<([a-z0-9]+)\b/i, (_m, n: string) => `<${n} ${name}="${escapeAttr(value)}"`);
}

function dropAttr(tag: string, name: string): string {
  return tag.replace(new RegExp(`\\s${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`, "i"), "");
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3] ?? "").replace(/&amp;/g, "&");
}

const LAZY_CLASSES = new Set(["lazyload", "lazyloading", "lazy", "b-lazy", "lozad", "lazy-load", "lazy-loading", "lazyautosizes"]);

/** Lazy-load libraries blur / hide images until JS marks them loaded. Mark them loaded up front. */
function markLazyLoaded(tag: string): string {
  const cls = attr(tag, "class");
  if (cls == null) return tag;
  const parts = cls.split(/\s+/).filter(Boolean);
  if (!parts.some((c) => LAZY_CLASSES.has(c.toLowerCase()))) return tag;
  const next = parts.filter((c) => !LAZY_CLASSES.has(c.toLowerCase()));
  next.push("lazyloaded", "b-loaded", "loaded");
  return setOrReplaceAttr(tag, "class", next.join(" "));
}

const VIDEO_EXT = /\.(mp4|webm|ogv|ogg|mov|m4v|mp3|m4a|wav|aac|flac)(\?|#|$)/i;

/** Promote lazy attrs, mark lazy classes, and route image URLs through the asset proxy. */
export function fixMediaForProxy(html: string, pageBase: string): string {
  let out = html.replace(/<(img|source|video|audio|use)\b[^>]*>/gi, (tag) => {
    const name = /^<([a-z]+)/i.exec(tag)![1]!.toLowerCase();
    let t = tag;
    const typeAttr = (attr(t, "type") || "").toLowerCase();
    const mediaLike =
      name === "video" ||
      name === "audio" ||
      (name === "source" && (typeAttr.startsWith("video/") || typeAttr.startsWith("audio/") || VIDEO_EXT.test(attr(t, "src") || "")));

    if (name === "img" || name === "source") {
      const lazySrc =
        attr(t, "data-src") ||
        attr(t, "data-lazy-src") ||
        attr(t, "data-original") ||
        attr(t, "data-lazyload") ||
        attr(t, "data-lazy") ||
        attr(t, "data-img-src");
      const lazySrcset = attr(t, "data-srcset") || attr(t, "data-lazy-srcset");
      const lazySizes = attr(t, "data-sizes");
      if (lazySrc && !/^data:/i.test(lazySrc) && !mediaLike) t = setOrReplaceAttr(t, "src", lazySrc);
      if (lazySrcset) t = setOrReplaceAttr(t, "srcset", lazySrcset);
      if (lazySizes && lazySizes !== "auto") t = setOrReplaceAttr(t, "sizes", lazySizes);
      if (name === "img") {
        t = dropAttr(t, "loading");
        t = markLazyLoaded(t);
      }
    }

    const src = attr(t, "src");
    if (src) {
      const abs = absolutize(src, pageBase);
      if (abs) t = setOrReplaceAttr(t, "src", mediaLike ? abs : assetUrl(abs));
    }
    const poster = attr(t, "poster");
    if (poster) {
      const abs = absolutize(poster, pageBase);
      if (abs) t = setOrReplaceAttr(t, "poster", assetUrl(abs));
    }
    const srcset = attr(t, "srcset");
    if (srcset) t = setOrReplaceAttr(t, "srcset", rewriteSrcset(srcset, pageBase));
    if (name === "use") {
      const href = attr(t, "href") || attr(t, "xlink:href");
      if (href && !href.startsWith("#")) {
        const abs = absolutize(href, pageBase);
        if (abs) {
          t = setOrReplaceAttr(t, "href", assetUrl(abs));
          if (/\sxlink:href\s*=/i.test(t)) t = setOrReplaceAttr(t, "xlink:href", assetUrl(abs));
        }
      }
    }
    return t;
  });

  // Lazy background images: <div data-bg="..."> / data-background-image / data-bg-src become real inline backgrounds.
  out = out.replace(
    /<(?!img\b|source\b)[a-z][a-z0-9-]*\b[^>]*\sdata-(?:bg|background|background-image|bg-src|bgset)\s*=\s*(?:"[^"]*"|'[^']*')[^>]*>/gi,
    (tag) => {
      const raw =
        attr(tag, "data-bg") || attr(tag, "data-background-image") || attr(tag, "data-background") || attr(tag, "data-bg-src") || "";
      const first = raw.trim().replace(/^url\(\s*['"]?|['"]?\s*\)$/g, "").split(/[\s,]+/)[0] || "";
      const abs = first && !/^(#|data:)/i.test(first) && /[./]/.test(first) ? absolutize(first, pageBase) : null;
      if (!abs) return tag;
      const style = attr(tag, "style") || "";
      const decl = `background-image:url('${assetUrl(abs)}');background-size:cover;background-position:center;`;
      return setOrReplaceAttr(markLazyLoaded(tag), "style", `${decl}${style}`);
    }
  );

  // Inline style="…url(…)…" backgrounds.
  out = out.replace(/(\sstyle\s*=\s*)"([^"]*url\([^"]*)"/gi, (_m, p1: string, css: string) => {
    const decoded = css.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    const rewritten = rewriteCss(decoded, pageBase, "'");
    return `${p1}"${rewritten.replace(/"/g, "&quot;")}"`;
  });

  // Maps / embeds: LiteSpeed & similar leave src="about:blank" until JS runs — promote the real URL so maps show.
  out = out.replace(/<iframe\b[^>]*>/gi, (tag) => {
    let t = tag;
    const lazy =
      attr(t, "data-litespeed-src") ||
      attr(t, "data-src") ||
      attr(t, "data-lazy-src") ||
      attr(t, "data-original");
    const src = (attr(t, "src") || "").trim();
    const blank = !src || /^(about:blank|javascript:)/i.test(src);
    if (lazy && blank) {
      try {
        const abs = new URL(lazy.replace(/&amp;/g, "&"), pageBase);
        if (/^https?:$/.test(abs.protocol)) t = setOrReplaceAttr(t, "src", abs.href);
      } catch {
        /* keep */
      }
    } else if (src && !/^(about:blank|javascript:|data:)/i.test(src)) {
      try {
        const abs = new URL(src.replace(/&amp;/g, "&"), pageBase);
        if (/^https?:$/.test(abs.protocol)) t = setOrReplaceAttr(t, "src", abs.href);
      } catch {
        /* keep */
      }
    }
    t = dropAttr(t, "loading");
    // Google Maps / embeds need a usable size even when the theme sizes via JS
    if (/maps\.google|google\.com\/maps|maps\.googleapis/i.test(attr(t, "src") || "")) {
      if (!attr(t, "style") || !/min-height/i.test(attr(t, "style") || "")) {
        const style = attr(t, "style") || "";
        t = setOrReplaceAttr(t, "style", `min-height:240px;width:100%;border:0;${style}`);
      }
      if (!/\sallow\s*=/i.test(t)) {
        t = t.replace(
          /^<iframe\b/i,
          '<iframe allow="fullscreen; geolocation; accelerometer; gyroscope; clipboard-write"'
        );
      }
    }
    return t;
  });

  return out;
}

function safeStyleText(css: string): string {
  return css.replace(/<\/style/gi, "<\\/style");
}

type SheetFetch = { text: string; finalUrl: string };

async function fetchSheetText(abs: string, referer: string, accept = "text/css,*/*;q=0.1"): Promise<SheetFetch | null> {
  try {
    const { res, finalUrl } = await safeFetch(abs, { accept, timeoutMs: 8000, referer });
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      return null;
    }
    const type = (res.headers.get("content-type") || "").toLowerCase();
    if (type && !type.includes("css") && !type.includes("text/plain") && !type.includes("octet-stream")) {
      await res.body?.cancel().catch(() => undefined);
      return null;
    }
    const text = await readTextLimited(res, MAX_SHEET_BYTES);
    return text == null ? null : { text, finalUrl };
  } catch {
    return null;
  }
}

const IMPORT_RE = /@import\s+(?:url\(\s*(['"]?)([^'")]+?)\1\s*\)|(['"])([^'"]+)\3)\s*([^;{}]*);/gi;

/**
 * Inline @import'ed stylesheets (Google Fonts etc.) so they're fetched server-side with SSRF checks,
 * and make every url() in the result go through the asset proxy.
 */
async function processCss(text: string, base: string, referer: string, depth: number): Promise<string> {
  const imports: Array<{ marker: string; abs: string; media: string }> = [];
  let n = 0;
  const withMarkers = text.replace(IMPORT_RE, (_m, _q1: string, u1: string | undefined, _q2: string, u2: string | undefined, media: string) => {
    const abs = absolutize((u1 ?? u2 ?? "").replace(/&amp;/g, "&"), base);
    if (!abs || depth >= MAX_IMPORT_DEPTH || imports.length >= MAX_IMPORTS_PER_SHEET) return "";
    const marker = `/*__DL_IMPORT_${n++}__*/`;
    imports.push({ marker, abs, media: (media || "").trim() });
    return marker;
  });
  let css = rewriteCss(withMarkers, base);
  if (!imports.length) return css;
  const fetched = await Promise.all(
    imports.map(async (imp) => {
      const sheet = await fetchSheetText(imp.abs, referer);
      if (!sheet) return "";
      const body = await processCss(sheet.text, sheet.finalUrl, referer, depth + 1);
      return imp.media && imp.media !== "all" ? `@media ${imp.media}{${body}}` : body;
    })
  );
  imports.forEach((imp, i) => {
    css = css.replace(imp.marker, () => fetched[i]!);
  });
  return css;
}

/**
 * Inline linked stylesheets (rewritten) and rewrite inline <style> blocks.
 * Inlining means a single response renders fully, regardless of CORS on the remote CSS/fonts.
 */
export async function inlineStyles(html: string, pageBase: string, pageUrl: string): Promise<string> {
  // Inline <style> blocks first
  const styleBlocks = [...html.matchAll(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi)];
  let out = html;
  if (styleBlocks.length) {
    const processed = await Promise.all(styleBlocks.map((m) => processCss(m[2]!, pageBase, pageUrl, 0)));
    let i = 0;
    out = html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, open: string, _css: string, close: string) =>
      `${open}${safeStyleText(processed[i++]!)}${close}`
    );
  }

  const linkRe = /<link\b[^>]*>/gi;
  const found: Array<{ tag: string; abs: string; media: string | null }> = [];
  for (const m of out.matchAll(linkRe)) {
    const tag = m[0];
    const rel = (attr(tag, "rel") || "").toLowerCase();
    const rels = rel.split(/\s+/);
    // Async-CSS plugins use <link rel="preload" as="style" onload="this.rel='stylesheet'">; treat as stylesheet.
    const isSheet =
      rels.includes("stylesheet") || (rels.includes("preload") && (attr(tag, "as") || "").toLowerCase() === "style");
    if (!isSheet) continue;
    const href = attr(tag, "href");
    if (!href) continue;
    const abs = absolutize(href, pageBase);
    if (!abs) continue;
    const media = attr(tag, "media");
    // media="print" + onload swap is a lazy-load pattern: treat as a regular stylesheet once inlined.
    const lazyPrint = media === "print" && /\sonload\s*=/i.test(tag);
    found.push({ tag, abs, media: lazyPrint || media === "all" ? null : media });
    if (found.length >= MAX_SHEETS) break;
  }
  if (!found.length) return out;

  const sheets = await Promise.all(
    found.map(async (f) => {
      const sheet = await fetchSheetText(f.abs, pageUrl);
      if (!sheet) return null;
      return processCss(sheet.text, sheet.finalUrl, pageUrl, 0);
    })
  );
  found.forEach((f, i) => {
    const css = sheets[i];
    if (css == null) return;
    const mediaAttr = f.media ? ` media="${f.media.replace(/"/g, "&quot;")}"` : "";
    out = out.replace(f.tag, () => `<style data-devicelab-href="${f.abs.replace(/"/g, "&quot;")}"${mediaAttr}>${safeStyleText(css)}</style>`);
  });
  return out;
}
