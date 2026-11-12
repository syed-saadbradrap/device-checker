const DARK_FEATURE = /\(\s*prefers-color-scheme\s*:\s*dark\s*\)/i;
const LIGHT_FEATURE = /\(\s*prefers-color-scheme\s*:\s*light\s*\)/i;

const LIGHT_CLIENT_BG = "#f4f4f5";
const DARK_CLIENT_BG = "#1a1a1a";

export type DarkCssRewrite = {
  css: string;
  /** Number of `prefers-color-scheme: dark` blocks forced on. */
  darkBlocks: number;
};

/** Index just past the `}` matching the `{` at `open`, skipping strings and comments. */
function findBlockEnd(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    const ch = css[i];
    if (ch === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      if (end === -1) return css.length;
      i = end + 1;
    } else if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== ch) j += css[j] === "\\" ? 2 : 1;
      i = j;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return css.length;
}

/** Drop the dark feature from one media query, e.g. `screen and (prefers-color-scheme: dark)` → `screen`. */
function stripDarkFeature(query: string): string {
  const rest = query
    .replace(DARK_FEATURE, " ")
    .replace(/\band\s+and\b/gi, "and")
    .replace(/^\s*and\b|\band\s*$/gi, "")
    .trim();
  return rest || "all";
}

/**
 * Force `@media (prefers-color-scheme: dark)` blocks on and `light` blocks off.
 * Needed because inside an iframe the media feature follows the OS, not the preview toggle.
 */
export function rewriteDarkModeCss(css: string): DarkCssRewrite {
  const mediaRe = /@media\b([^{;]*)\{/gi;
  let out = "";
  let last = 0;
  let darkBlocks = 0;
  let match: RegExpExecArray | null;

  while ((match = mediaRe.exec(css))) {
    const prelude = match[1];
    const isDark = DARK_FEATURE.test(prelude);
    const isLight = LIGHT_FEATURE.test(prelude);
    if (!isDark && !isLight) continue;

    const open = match.index + match[0].length - 1;
    const end = findBlockEnd(css, open);
    const inner = css.slice(open + 1, Math.max(open + 1, end - 1));

    const queries = prelude
      .split(",")
      .map((q) => q.trim())
      .filter(Boolean)
      .map((q) => {
        if (DARK_FEATURE.test(q)) return stripDarkFeature(q);
        if (LIGHT_FEATURE.test(q)) return "not all";
        return q;
      });

    let replacement: string;
    if (queries.some((q) => q === "all")) {
      replacement = inner;
    } else if (queries.every((q) => q === "not all")) {
      replacement = `@media not all{${inner}}`;
    } else {
      replacement = `@media ${queries.join(", ")}{${inner}}`;
    }
    if (isDark) darkBlocks++;

    out += css.slice(last, match.index) + replacement;
    last = end;
    mediaRe.lastIndex = end;
  }

  return { css: out + css.slice(last), darkBlocks };
}

function rewriteStyleTags(html: string): DarkCssRewrite {
  let darkBlocks = 0;
  const css = html.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_, open: string, body: string, close: string) => {
      const result = rewriteDarkModeCss(body);
      darkBlocks += result.darkBlocks;
      return `${open}${result.css}${close}`;
    }
  );
  return { css, darkBlocks };
}

/** True when the email ships its own `prefers-color-scheme: dark` styles. */
export function emailHasDarkModeCss(html: string): boolean {
  return rewriteStyleTags(html).darkBlocks > 0;
}

function previewHead(dark: boolean, emailHasDarkCss: boolean): string {
  const base = `body{margin:0;padding:0;} img{max-width:100%;height:auto;}`;
  const client = dark
    ? `html{background:${DARK_CLIENT_BG};color-scheme:dark;}` +
      (emailHasDarkCss
        ? ""
        : // Not dark-aware: keep it as authored on a light card instead of inverting it.
          `body{background:#ffffff;color:#111111;color-scheme:light;}`)
    : `html{background:${LIGHT_CLIENT_BG};color-scheme:light;}`;

  const scheme = dark ? "light dark" : "light";
  return (
    `<meta charset="utf-8">` +
    `<meta name="color-scheme" content="${scheme}">` +
    `<meta name="supported-color-schemes" content="${scheme}">` +
    `<style data-devicelab-preview>${base}${client}</style>`
  );
}

/**
 * Build a complete iframe srcDoc for email HTML.
 * Dark mode = dark email-client canvas + the email's own `prefers-color-scheme: dark` CSS forced on.
 * Preview styles go first in <head> so the email's own CSS still wins.
 */
export function buildEmailPreviewHtml(html: string, dark = false): string {
  let source = html.trim();
  if (!source) return "";

  let hasDarkCss = false;
  if (dark) {
    const rewritten = rewriteStyleTags(source);
    source = rewritten.css;
    hasDarkCss = rewritten.darkBlocks > 0;
  }

  const head = previewHead(dark, hasDarkCss);
  const doctype = /^\s*<!doctype[^>]*>/i;
  const body = source.replace(doctype, "").trim();

  let doc: string;
  if (/<head\b[^>]*>/i.test(body)) {
    doc = body.replace(/<head\b[^>]*>/i, (tag) => `${tag}${head}`);
  } else if (/<html\b[^>]*>/i.test(body)) {
    doc = body.replace(/<html\b[^>]*>/i, (tag) => `${tag}<head>${head}</head>`);
  } else if (/<body\b[^>]*>/i.test(body)) {
    doc = `<html><head>${head}</head>${body}</html>`;
  } else {
    doc = `<html><head>${head}</head><body>${body}</body></html>`;
  }

  return `<!DOCTYPE html>${doc}`;
}
