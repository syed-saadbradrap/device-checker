import { chromium, firefox, webkit, type Browser, type BrowserContext, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";
import { validatePublicUrl, assertSafeRedirectTarget } from "@/lib/security/url";

export type BrowserEngine = "chromium" | "firefox" | "webkit";

const TIMEOUT = Number(process.env.PLAYWRIGHT_TIMEOUT_MS || 30000);

let browserPool: Partial<Record<BrowserEngine, Browser>> = {};

async function getBrowser(engine: BrowserEngine): Promise<Browser> {
  if (browserPool[engine]?.isConnected()) {
    return browserPool[engine]!;
  }
  const launchers = { chromium, firefox, webkit };
  browserPool[engine] = await launchers[engine].launch({
    headless: true,
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
  });
  return browserPool[engine]!;
}

export async function closeBrowsers() {
  await Promise.all(
    Object.values(browserPool).map(async (b) => {
      try {
        await b?.close();
      } catch {
        /* ignore */
      }
    })
  );
  browserPool = {};
}

export interface CaptureOptions {
  url: string;
  width: number;
  height: number;
  dpr?: number;
  engine?: BrowserEngine;
  colorScheme?: "light" | "dark" | "no-preference";
  userAgent?: string;
  fullPage?: boolean;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
}

export interface CaptureResult {
  buffer: Buffer;
  finalUrl: string;
  title: string;
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: Array<{ url: string; status?: number; error?: string }>;
  engine: BrowserEngine;
  browserVersion: string;
}

async function createContext(
  engine: BrowserEngine,
  opts: CaptureOptions
): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await getBrowser(engine);
  const context = await browser.newContext({
    viewport: { width: opts.width, height: opts.height },
    deviceScaleFactor: opts.dpr ?? 1,
    colorScheme: opts.colorScheme ?? "no-preference",
    userAgent: opts.userAgent,
    javaScriptEnabled: true,
    bypassCSP: false,
  });
  return { browser, context };
}

async function navigateSafely(page: Page, url: string) {
  const safe = await validatePublicUrl(url);
  if (!safe.ok) throw new Error(safe.error);

  page.on("framenavigated", async (frame) => {
    if (frame !== page.mainFrame()) return;
    const check = await assertSafeRedirectTarget(frame.url());
    if (!check.ok) {
      await page.close().catch(() => undefined);
      throw new Error(`Blocked redirect: ${check.error}`);
    }
  });

  const response = await page.goto(safe.url, {
    waitUntil: "domcontentloaded",
    timeout: TIMEOUT,
  });

  const finalUrl = page.url();
  const finalCheck = await assertSafeRedirectTarget(finalUrl);
  if (!finalCheck.ok) {
    throw new Error(`Final URL blocked: ${finalCheck.error}`);
  }

  return response;
}

export async function captureScreenshot(opts: CaptureOptions): Promise<CaptureResult> {
  const engine = opts.engine ?? "chromium";
  const { context } = await createContext(engine, opts);
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: CaptureResult["failedRequests"] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("requestfailed", (req) => {
    failedRequests.push({
      url: req.url(),
      error: req.failure()?.errorText,
    });
  });
  page.on("response", (res) => {
    if (res.status() >= 400) {
      failedRequests.push({ url: res.url(), status: res.status() });
    }
  });

  try {
    await navigateSafely(page, opts.url);
    if (opts.waitUntil === "networkidle") {
      await page.waitForLoadState("networkidle", { timeout: TIMEOUT }).catch(() => undefined);
    }
    const buffer = Buffer.from(
      await page.screenshot({
        fullPage: opts.fullPage ?? false,
        type: "png",
      })
    );
    const browser = context.browser();
    return {
      buffer,
      finalUrl: page.url(),
      title: await page.title(),
      consoleErrors,
      pageErrors,
      failedRequests: dedupeFailed(failedRequests),
      engine,
      browserVersion: browser?.version() || "unknown",
    };
  } finally {
    await context.close();
  }
}

function dedupeFailed(items: CaptureResult["failedRequests"]) {
  const seen = new Set<string>();
  return items.filter((i) => {
    const key = `${i.status || ""}:${i.url}:${i.error || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function analyzePageWithScript<T>(
  opts: CaptureOptions & { script: string }
): Promise<{ result: T; capture?: CaptureResult }> {
  const engine = opts.engine ?? "chromium";
  const { context } = await createContext(engine, opts);
  const page = await context.newPage();
  try {
    await navigateSafely(page, opts.url);
    await page.waitForTimeout(500);
    const result = (await page.evaluate(opts.script)) as T;
    return { result };
  } finally {
    await context.close();
  }
}

export async function runInPage<T>(
  opts: CaptureOptions,
  fn: (page: Page) => Promise<T>
): Promise<T> {
  const engine = opts.engine ?? "chromium";
  const { context } = await createContext(engine, opts);
  const page = await context.newPage();
  try {
    await navigateSafely(page, opts.url);
    return await fn(page);
  } finally {
    await context.close();
  }
}

export function screenshotDir() {
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "storage",
    "screenshots"
  );
}

export async function ensureScreenshotDir() {
  const dir = screenshotDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function saveScreenshotBuffer(buffer: Buffer, filename: string) {
  const dir = await ensureScreenshotDir();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(/*turbopackIgnore: true*/ dir, safeName);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

/** Probe whether a URL allows iframe embedding. */
export async function probeFrameEmbedding(url: string): Promise<{
  allowed: boolean;
  reason?: string;
  xFrameOptions?: string | null;
  csp?: string | null;
}> {
  const safe = await validatePublicUrl(url);
  if (!safe.ok) return { allowed: false, reason: safe.error };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(safe.url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "DeviceLab/1.0 (+https://devicelab.local)" },
    });
    clearTimeout(timer);

    const finalCheck = await assertSafeRedirectTarget(res.url);
    if (!finalCheck.ok) {
      return { allowed: false, reason: finalCheck.error };
    }

    const xfo = res.headers.get("x-frame-options");
    const csp = res.headers.get("content-security-policy");
    if (xfo && /deny|sameorigin/i.test(xfo)) {
      return {
        allowed: false,
        reason: `X-Frame-Options: ${xfo} prevents iframe embedding`,
        xFrameOptions: xfo,
        csp,
      };
    }
    if (csp && /frame-ancestors\s+('none'|none)/i.test(csp)) {
      return {
        allowed: false,
        reason: "CSP frame-ancestors blocks iframe embedding",
        xFrameOptions: xfo,
        csp,
      };
    }
    if (csp && /frame-ancestors/i.test(csp) && !/frame-ancestors\s+\*/i.test(csp)) {
      const match = csp.match(/frame-ancestors\s+([^;]+)/i);
      const ancestors = match?.[1]?.trim() || "";
      if (ancestors && !ancestors.includes("'self'") === false) {
        // May still allow same-origin only — treat restrictive ancestors as blocked for our app
        if (!/\*/.test(ancestors)) {
          return {
            allowed: false,
            reason: `CSP frame-ancestors (${ancestors}) may block embedding from DeviceLab`,
            xFrameOptions: xfo,
            csp,
          };
        }
      }
    }
    return { allowed: true, xFrameOptions: xfo, csp };
  } catch (e) {
    return {
      allowed: false,
      reason: e instanceof Error ? e.message : "Failed to probe URL headers",
    };
  }
}
