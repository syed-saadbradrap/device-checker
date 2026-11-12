import path from "node:path";
import { runInPage } from "@/lib/browser/playwright";

const axeMinPath = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "node_modules",
  "axe-core",
  "axe.min.js"
);

export interface A11yViolation {
  id: string;
  impact: "critical" | "serious" | "moderate" | "minor" | null;
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary?: string;
  }>;
}

export interface A11yReport {
  url: string;
  violations: A11yViolation[];
  passes: number;
  incomplete: number;
  engine: string;
  scannedAt: string;
}

type AxeRunResult = {
  violations: Array<{
    id: string;
    impact?: string | null;
    description: string;
    help: string;
    helpUrl: string;
    nodes: Array<{
      html: string;
      target: Array<string | string[]>;
      failureSummary?: string;
    }>;
  }>;
  passes: unknown[];
  incomplete: unknown[];
};

export async function runAccessibilityAudit(
  url: string,
  opts?: { width?: number; height?: number }
): Promise<A11yReport> {
  return runInPage(
    {
      url,
      width: opts?.width ?? 1280,
      height: opts?.height ?? 800,
      engine: "chromium",
    },
    async (page) => {
      await page.addScriptTag({ path: axeMinPath });
      const results = (await page.evaluate(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const axeLib = (window as any).axe;
        if (!axeLib) throw new Error("axe-core failed to load in page");
        return axeLib.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "best-practice"],
          },
        });
      })) as AxeRunResult;

      return {
        url: page.url(),
        violations: results.violations.map((v) => ({
          id: v.id,
          impact: (v.impact as A11yViolation["impact"]) ?? null,
          description: v.description,
          help: v.help,
          helpUrl: v.helpUrl,
          nodes: v.nodes.slice(0, 10).map((n) => ({
            html: n.html,
            target: n.target.map((t) => (Array.isArray(t) ? t.join(" ") : String(t))),
            failureSummary: n.failureSummary,
          })),
        })),
        passes: results.passes.length,
        incomplete: results.incomplete.length,
        engine: "axe-core via Playwright Chromium",
        scannedAt: new Date().toISOString(),
      };
    }
  );
}
