export type ProxyMode = "live" | "static";

export type PrepareOptions = {
  /** live = site scripts run (sandboxed, opaque origin). static = scripts removed, links rewritten server-side. */
  mode: ProxyMode;
  width: number;
  height: number;
};

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function directoryBase(finalUrl: string): string {
  const u = new URL(finalUrl);
  if (u.pathname.endsWith("/")) return `${u.origin}${u.pathname}`;
  const parts = u.pathname.split("/");
  parts.pop();
  return `${u.origin}${parts.join("/") || ""}/`;
}

/** Document base: honours an existing <base href> in the page, otherwise the page's directory. */
export function resolveDocumentBase(html: string, finalUrl: string): string {
  const m = /<base\b[^>]*\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(html);
  const raw = m?.[1] ?? m?.[2] ?? m?.[3];
  if (raw) {
    try {
      const abs = new URL(raw.replace(/&amp;/g, "&"), finalUrl);
      if (/^https?:$/.test(abs.protocol)) return abs.href;
    } catch {
      /* fall through */
    }
  }
  return directoryBase(finalUrl);
}

export function proxyHref(
  proxyPath: string,
  target: string,
  opts: { width: number; height: number; mode: ProxyMode }
): string {
  const q = new URLSearchParams({
    url: target,
    width: String(opts.width),
    height: String(opts.height),
    scripts: opts.mode === "live" ? "1" : "0",
  });
  return `${proxyPath}?${q.toString()}`;
}

function rewriteLinks(html: string, base: string, proxyPath: string, opts: PrepareOptions): string {
  return html.replace(/<(a|area)\b[^>]*>/gi, (tag) => {
    const m = /(\shref\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
    if (!m) return tag;
    const raw = (m[2] ?? m[3] ?? m[4] ?? "").replace(/&amp;/g, "&").trim();
    if (!raw || raw.startsWith("#") || /^(mailto:|tel:|sms:|javascript:|data:)/i.test(raw)) return tag;
    let abs: string;
    try {
      const u = new URL(raw, base);
      if (!/^https?:$/.test(u.protocol)) return tag;
      abs = u.href;
    } catch {
      return tag;
    }
    const opensNew = /\starget\s*=\s*["']?_blank/i.test(tag);
    const next = opensNew ? abs : proxyHref(proxyPath, abs, opts);
    return tag.replace(m[0], `${m[1]}"${escapeAttr(next)}"`);
  });
}

function jsonForScript(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function liveBootstrap(finalUrl: string, proxyPath: string): string {
  return `<script>
(function () {
  var PROXY = ${jsonForScript(proxyPath)};
  var PAGE = ${jsonForScript(finalUrl)};
  var qs = new URLSearchParams(location.search);
  var W = qs.get("width"), H = qs.get("height");
  // Immediate "loaded" ping on window load so the host can quickly tell a proxied page from a frame that escaped to the real site.
  window.addEventListener("load", function () {
    try { parent.postMessage({ devicelab: "preview", state: "loaded" }, "*"); } catch (e) {}
  });
  // Handshake + blank-page detector. The host expects this message after every load; if it never arrives
  // (site scripts redirected the frame to the real origin) or the page is empty, it falls back to static mode.
  window.addEventListener("load", function () {
    setTimeout(function () {
      try {
        var len = ((document.body && document.body.innerText) || "").trim().length;
        parent.postMessage({ devicelab: "preview", state: "rendered", textLength: len }, "*");
      } catch (e) {}
    }, 2500);
  });
  // The document runs in an opaque origin (sandbox), so storage/cookies throw. Shim them in memory so site scripts keep working.
  function mem() {
    var d = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
      setItem: function (k, v) { d[k] = String(v); },
      removeItem: function (k) { delete d[k]; },
      clear: function () { d = {}; },
      key: function (i) { return Object.keys(d)[i] || null; },
      get length() { return Object.keys(d).length; }
    };
  }
  ["localStorage", "sessionStorage"].forEach(function (n) {
    var ok = true;
    try { void window[n]; } catch (e) { ok = false; }
    if (!ok) { try { Object.defineProperty(window, n, { value: mem(), configurable: true }); } catch (e) {} }
  });
  try { void document.cookie; } catch (e) {
    var jar = "";
    try { Object.defineProperty(document, "cookie", { get: function () { return jar; }, set: function (v) { jar = String(v).split(";")[0]; }, configurable: true }); } catch (e2) {}
  }
  // SPA routers call history.pushState with the real site's paths; that throws in our origin. Ignore instead of crashing.
  ["pushState", "replaceState"].forEach(function (m) {
    var orig = history[m];
    history[m] = function () { try { return orig.apply(this, arguments); } catch (e) {} };
  });
  function toProxy(raw) {
    try {
      var abs = new URL(raw, PAGE).href;
      if (!/^https?:/i.test(abs)) return null;
      var q = "?url=" + encodeURIComponent(abs) + "&scripts=1";
      if (W) q += "&width=" + encodeURIComponent(W);
      if (H) q += "&height=" + encodeURIComponent(H);
      return PROXY + q;
    } catch (e) { return null; }
  }
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented) return;
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#" || /^(mailto:|tel:|sms:|javascript:)/i.test(href)) return;
    if (a.target === "_blank") return;
    var next = toProxy(href);
    if (!next) return;
    e.preventDefault();
    location.href = next;
  });
  document.addEventListener("submit", function (e) {
    if (e.defaultPrevented) return;
    var form = e.target;
    if (!form || form.tagName !== "FORM") return;
    var method = (form.getAttribute("method") || "GET").toUpperCase();
    if (method !== "GET") { form.target = "_blank"; return; }
    var next = toProxy(form.getAttribute("action") || PAGE);
    if (!next) return;
    e.preventDefault();
    var u = new URL(next, location.href);
    var target = new URL(u.searchParams.get("url") || PAGE);
    new FormData(form).forEach(function (value, key) { if (typeof value === "string") target.searchParams.set(key, value); });
    u.searchParams.set("url", target.href);
    location.href = u.pathname + u.search;
  });
})();
</script>`;
}

/**
 * CSS injected into every proxied page.
 * - phones/tablets: hide the scrollbar (real devices use overlay scrollbars; a classic 15px bar would shrink the layout width)
 * - lazy-load libs blur/fade images until JS flags them loaded: neutralise that
 * - static mode additionally reveals content that only becomes visible through JS (entrance animations, preloaders)
 */
function previewCss(mode: ProxyMode, width: number): string {
  const css: string[] = [];
  css.push(
    width < 1100
      ? "html{scrollbar-width:none!important}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}"
      : "html{scrollbar-width:thin}"
  );
  css.push("img.lazyloaded,img.lazyload,img.lazyloading,img.lazy,img[data-src]{filter:none!important;-webkit-filter:none!important}");
  if (mode === "static") {
    css.push(
      [
        "img.lazyload,img.lazyloading,img.lazy,img[data-src]{opacity:1!important;visibility:visible!important}",
        ".elementor-invisible,.wow,.sr-hidden,.reveal-on-scroll,.js-reveal{visibility:visible!important;opacity:1!important}",
        "[data-aos],[data-sal],[data-scroll],.aos-init,.fade-in-up,.animate-on-scroll,.animated-hidden{opacity:1!important;transform:none!important;visibility:visible!important;transition:none!important}",
        "#preloader,.preloader,#page-loader,.page-loader,#loader-wrapper,.loader-wrapper,#page-preloader,.site-preloader,.pace,.pace-active{display:none!important}",
      ].join("\n")
    );
  }
  return `<style data-devicelab-preview>${css.join("\n")}</style>`;
}

/** Static-mode only: JS-driven bits that would otherwise stay in their empty initial state. */
function staticFixups(html: string): string {
  // Lazy-load plugins ship `<img lazy><noscript><img></noscript>`; we promote the lazy one, so drop the duplicate.
  let out = html.replace(
    /(<\/picture\s*>|<img\b[^>]*>)(\s*)<noscript\b[^>]*>\s*(?:<img\b[^>]*>|<picture\b[\s\S]*?<\/picture\s*>)\s*<\/noscript\s*>/gi,
    "$1"
  );
  // <noscript> is rendered when scripts are off: keep lazy-load image fallbacks, drop "enable JavaScript" banners/trackers.
  out = out.replace(/<noscript\b[^>]*>([\s\S]*?)<\/noscript\s*>/gi, (_m, inner: string) =>
    /<img\b|<picture\b|<style\b|<link\b/i.test(inner) && !/<iframe\b/i.test(inner) ? inner : ""
  );
  // Counters animate from 0 via JS.
  out = out.replace(
    /(<[a-z]+\b[^>]*\bclass\s*=\s*["'][^"']*elementor-counter-number[^"']*["'][^>]*\sdata-to-value\s*=\s*["']?([\d.,]+)["']?[^>]*>)([^<]*)(?=<)/gi,
    (_m, open: string, to: string) => `${open}${to}`
  );
  return out;
}

/** Both modes: Elementor hides section backgrounds until JS adds .e-lazyloaded. */
function unlockBackgrounds(html: string): string {
  return html.replace(/<[a-z][a-z0-9-]*\b[^>]*\sclass\s*=\s*"[^"]*\be-con\b[^"]*"[^>]*>/gi, (tag) =>
    /\be-lazyloaded\b/.test(tag)
      ? tag
      : tag.replace(/(\sclass\s*=\s*")([^"]*)"/i, (_m, p1: string, cls: string) => `${p1}${cls} e-lazyloaded"`)
  );
}

/**
 * Prepare remote HTML so it can live inside our iframe:
 * - <base href> keeps images/scripts/links resolving against the real site
 * - live mode: bootstrap script keeps in-frame navigation on our proxy
 * - static mode: all scripts removed and links rewritten up front (no JS, can't break out of the frame)
 */
export function prepareProxiedHtml(
  html: string,
  finalUrl: string,
  proxyPath: string,
  opts: PrepareOptions
): string {
  const baseHref = resolveDocumentBase(html, finalUrl);

  let out = html
    // meta CSP can block our inlined styles/assets; meta refresh would navigate the frame away from the proxy
    .replace(/<meta\b[^>]+http-equiv\s*=\s*["']?(?:content-security-policy|refresh)["']?[^>]*>/gi, "")
    .replace(/<base\b[^>]*>/gi, "");

  if (opts.mode === "static") {
    out = out
      .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
      .replace(/<script\b[^>]*\/>/gi, "")
      .replace(/<link\b[^>]*rel\s*=\s*["']?(?:modulepreload)["']?[^>]*>/gi, "");
    out = staticFixups(out);
    out = rewriteLinks(out, baseHref, proxyPath, opts);
    // Forms can't be proxied without JS: open submissions on the real site in a new tab.
    out = out.replace(/<form\b/gi, '<form target="_blank"');
  }
  out = unlockBackgrounds(out);

  const head =
    `<base href="${escapeAttr(baseHref)}">\n<meta name="devicelab-preview" content="${opts.mode}">\n` +
    `${previewCss(opts.mode, opts.width)}\n` +
    (opts.mode === "live" ? `\n${liveBootstrap(finalUrl, proxyPath)}` : "");

  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (m) => `${m}\n${head}`);
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${head}</head>`);
  } else {
    out = `<!DOCTYPE html><html><head>${head}</head><body>${out}</body></html>`;
  }
  return out;
}

export function looksLikeChallengePage(html: string): boolean {
  const sample = html.slice(0, 8000).toLowerCase();
  return (
    sample.includes("just a moment") ||
    sample.includes("cf-browser-verification") ||
    sample.includes("cf-challenge") ||
    sample.includes("attention required") ||
    sample.includes("_cf_chl") ||
    sample.includes("captcha-delivery.com") || // DataDome
    sample.includes("px-captcha") || // PerimeterX / HUMAN
    sample.includes("pardon our interruption") || // Imperva
    sample.includes("/_incapsula_resource")
  );
}

/** True for client-rendered shells: scripts present but almost no visible text in the raw HTML. */
export function looksLikeEmptyShell(html: string): boolean {
  if (!/<script\b/i.test(html)) return false;
  const text = html
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length < 80;
}

/** Page-level helpers for the route. */
export function errorPageHtml(title: string, message: string, targetUrl?: string): string {
  const link = targetUrl
    ? `<p><a href="${escapeAttr(targetUrl)}" target="_blank" rel="noopener noreferrer">Open the site in a new tab</a></p>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;font:14px/1.5 system-ui,sans-serif;background:#f5f5f5;color:#222;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px;box-sizing:border-box}
h1{font-size:16px;margin:0 0 8px}p{margin:6px 0;color:#555}a{color:#2563eb}
</style></head><body><div><h1>${escapeAttr(title)}</h1><p>${escapeAttr(message)}</p>${link}</div></body></html>`;
}
