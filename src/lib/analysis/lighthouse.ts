import { validatePublicUrl } from "@/lib/security/url";

export interface LighthouseMetrics {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
  fcp: number | null;
  lcp: number | null;
  cls: number | null;
  si: number | null;
  tbt: number | null;
  tti: number | null;
  totalByteWeight: number | null;
  requestCount: number | null;
}

export interface LighthouseOpportunity {
  id: string;
  title: string;
  description: string;
  score: number | null;
  displayValue?: string;
}

export interface LighthouseReport {
  url: string;
  finalUrl: string;
  fetchTime: string;
  lighthouseVersion: string;
  userAgent: string;
  scores: LighthouseMetrics;
  opportunities: LighthouseOpportunity[];
  diagnostics: LighthouseOpportunity[];
  note?: string;
}

function scoreOf(audit: { score?: number | null } | undefined) {
  if (!audit || audit.score == null) return null;
  return Math.round(audit.score * 100);
}

function numeric(audit: { numericValue?: number } | undefined) {
  return audit?.numericValue ?? null;
}

export async function runLighthouse(url: string): Promise<LighthouseReport> {
  const safe = await validatePublicUrl(url);
  if (!safe.ok) throw new Error(safe.error);

  // Dynamic import — lighthouse is heavy and Node-only
  const lighthouse = (await import("lighthouse")).default;
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({
    headless: true,
    args: ["--remote-debugging-port=0"],
  });

  try {
    const port = 9222;
    // Relaunch with fixed port for LH protocol connection
    await browser.close();
    const browser2 = await chromium.launch({
      headless: true,
      args: [`--remote-debugging-port=${port}`, "--disable-dev-shm-usage"],
    });

    try {
      const result = await lighthouse(safe.url, {
        port,
        output: "json",
        logLevel: "error",
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
        formFactor: "desktop",
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false,
        },
      });

      if (!result?.lhr) {
        throw new Error("Lighthouse returned no results");
      }

      const lhr = result.lhr;
      const audits = lhr.audits;

      const opportunities: LighthouseOpportunity[] = Object.values(audits)
        .filter(
          (a) =>
            a.details?.type === "opportunity" &&
            a.score !== null &&
            a.score < 1
        )
        .map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
          score: a.score,
          displayValue: a.displayValue,
        }))
        .slice(0, 15);

      const diagnostics: LighthouseOpportunity[] = [
        "total-byte-weight",
        "dom-size",
        "network-requests",
        "mainthread-work-breakdown",
        "bootup-time",
        "uses-responsive-images",
        "offscreen-images",
        "unminified-css",
        "unminified-javascript",
        "unused-css-rules",
        "unused-javascript",
        "render-blocking-resources",
        "font-display",
        "uses-long-cache-ttl",
      ]
        .map((id) => audits[id])
        .filter(Boolean)
        .map((a) => ({
          id: a!.id,
          title: a!.title,
          description: a!.description,
          score: a!.score,
          displayValue: a!.displayValue,
        }));

      return {
        url: safe.url,
        finalUrl: lhr.finalDisplayedUrl || lhr.finalUrl || safe.url,
        fetchTime: lhr.fetchTime,
        lighthouseVersion: lhr.lighthouseVersion,
        userAgent: lhr.environment?.networkUserAgent || "unknown",
        scores: {
          performance: scoreOf(lhr.categories.performance),
          accessibility: scoreOf(lhr.categories.accessibility),
          bestPractices: scoreOf(lhr.categories["best-practices"]),
          seo: scoreOf(lhr.categories.seo),
          fcp: numeric(audits["first-contentful-paint"]),
          lcp: numeric(audits["largest-contentful-paint"]),
          cls: numeric(audits["cumulative-layout-shift"]),
          si: numeric(audits["speed-index"]),
          tbt: numeric(audits["total-blocking-time"]),
          tti: numeric(audits.interactive),
          totalByteWeight: numeric(audits["total-byte-weight"]),
          requestCount:
            (audits["network-requests"]?.details as { items?: unknown[] })?.items
              ?.length ?? null,
        },
        opportunities,
        diagnostics,
      };
    } finally {
      await browser2.close();
    }
  } catch (e) {
    // Fallback note if LH fails in this environment
    throw new Error(
      e instanceof Error
        ? `Lighthouse failed: ${e.message}`
        : "Lighthouse failed"
    );
  }
}
