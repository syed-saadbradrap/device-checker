import type { Page } from "playwright";
import { runInPage } from "@/lib/browser/playwright";

export type CheckStatus = "PASS" | "FAIL" | "WARNING" | "INFO";

export interface ResponsiveIssue {
  status: CheckStatus;
  viewport: number;
  selector: string;
  description: string;
  suggestion: string;
  tagName?: string;
  rect?: { x: number; y: number; width: number; height: number };
}

export interface ViewportResult {
  width: number;
  height: number;
  issues: ResponsiveIssue[];
  summary: Record<CheckStatus, number>;
}

const ANALYSIS_SCRIPT = `
(() => {
  const issues = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const doc = document.documentElement;
  const body = document.body;

  const push = (status, selector, description, suggestion, el) => {
    const rect = el ? el.getBoundingClientRect() : null;
    issues.push({
      status,
      viewport: vw,
      selector,
      description,
      suggestion,
      tagName: el ? el.tagName.toLowerCase() : undefined,
      rect: rect
        ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        : undefined,
    });
  };

  // Horizontal overflow
  const scrollWidth = Math.max(doc.scrollWidth, body?.scrollWidth || 0);
  if (scrollWidth > vw + 1) {
    push(
      "FAIL",
      "html/body",
      \`Horizontal overflow detected (\${scrollWidth}px content vs \${vw}px viewport)\`,
      "Inspect wide fixed-width elements, negative margins, and non-wrapping flex children.",
      doc
    );
  } else {
    push("PASS", "html/body", "No horizontal page overflow", "None", doc);
  }

  // Elements overflowing viewport
  const all = Array.from(document.querySelectorAll("body *")).slice(0, 2500);
  let overflowCount = 0;
  for (const el of all) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.right > vw + 2 || r.left < -2) {
      overflowCount++;
      if (overflowCount <= 12) {
        const sel =
          el.id
            ? \`#\${el.id}\`
            : el.className && typeof el.className === "string"
              ? \`\${el.tagName.toLowerCase()}.\${el.className.trim().split(/\\s+/).slice(0, 2).join(".")}\`
              : el.tagName.toLowerCase();
        push(
          "FAIL",
          sel,
          "Element extends outside the viewport horizontally",
          "Use max-width: 100%, flex-wrap, or responsive units.",
          el
        );
      }
    }

    // Text overflow
    if (
      (style.overflow === "hidden" || style.textOverflow === "ellipsis") &&
      el.scrollWidth > el.clientWidth + 2
    ) {
      push(
        "WARNING",
        el.id ? \`#\${el.id}\` : el.tagName.toLowerCase(),
        "Text appears clipped or truncated",
        "Allow wrapping or increase container width at this breakpoint.",
        el
      );
    }

    // Stretched images
    if (el.tagName === "IMG") {
      const natW = el.naturalWidth || 0;
      const natH = el.naturalHeight || 0;
      if (natW && natH && r.width && r.height) {
        const aspect = natW / natH;
        const rendered = r.width / r.height;
        if (Math.abs(aspect - rendered) > 0.15 && style.objectFit === "fill") {
          push(
            "WARNING",
            "img",
            "Image may be stretched (aspect ratio mismatch)",
            "Use object-fit: cover/contain or preserve intrinsic ratio.",
            el
          );
        }
      }
      if (r.width > vw + 2) {
        push(
          "FAIL",
          "img",
          "Image wider than viewport",
          "Add max-width: 100%; height: auto;",
          el
        );
      }
    }

    // Fixed elements covering large area
    if (style.position === "fixed") {
      const area = r.width * r.height;
      if (area > vw * vh * 0.35 && style.pointerEvents !== "none") {
        push(
          "WARNING",
          el.id ? \`#\${el.id}\` : el.tagName.toLowerCase(),
          "Large fixed element may cover content",
          "Ensure dismissible overlays and accessible close controls.",
          el
        );
      }
    }
  }

  // Navigation overflow heuristic
  const navs = Array.from(document.querySelectorAll("nav, header, [role='navigation']"));
  for (const nav of navs) {
    if (nav.scrollWidth > nav.clientWidth + 4) {
      push(
        "FAIL",
        "nav/header",
        "Navigation content overflows its container",
        "Use a hamburger menu, wrapping, or horizontal scroll with accessible controls.",
        nav
      );
    }
  }

  // Forms / buttons
  document.querySelectorAll("button, .btn, [type='submit'], a.button").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.width < 24) {
      push(
        "WARNING",
        el.tagName.toLowerCase(),
        "Control may be too small to tap easily",
        "Aim for at least 44×44 CSS px touch targets on mobile.",
        el
      );
    }
    if (r.width > vw) {
      push(
        "FAIL",
        el.tagName.toLowerCase(),
        "Button wider than viewport",
        "Constrain button width with max-width: 100%.",
        el
      );
    }
  });

  document.querySelectorAll("input, select, textarea").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > vw + 2) {
      push(
        "FAIL",
        el.tagName.toLowerCase(),
        "Form control overflows viewport",
        "Use width: 100% and box-sizing: border-box.",
        el
      );
    }
  });

  // Grid / flex heuristics
  document.querySelectorAll("*").forEach((el) => {
    const style = getComputedStyle(el);
    if (style.display === "flex" && style.flexWrap === "nowrap") {
      const children = Array.from(el.children);
      const total = children.reduce((s, c) => s + c.getBoundingClientRect().width, 0);
      if (total > el.getBoundingClientRect().width + 8 && vw < 768) {
        push(
          "WARNING",
          el.tagName.toLowerCase(),
          "Flex container with nowrap may cause overflow on small screens",
          "Consider flex-wrap: wrap or stacking at this breakpoint.",
          el
        );
      }
    }
  });

  return issues.slice(0, 80);
})()
`;

export async function analyzeViewport(
  url: string,
  width: number,
  height = 900
): Promise<ViewportResult> {
  const issues = await runInPage<ResponsiveIssue[]>(
    { url, width, height, engine: "chromium" },
    async (page: Page) => {
      await page.waitForTimeout(400);
      return page.evaluate(ANALYSIS_SCRIPT) as Promise<ResponsiveIssue[]>;
    }
  );

  const summary: Record<CheckStatus, number> = {
    PASS: 0,
    FAIL: 0,
    WARNING: 0,
    INFO: 0,
  };
  for (const issue of issues) {
    summary[issue.status] = (summary[issue.status] || 0) + 1;
  }

  return { width, height, issues, summary };
}

export async function analyzeBreakpoints(
  url: string,
  widths: number[],
  onProgress?: (done: number, total: number, width: number) => void
): Promise<ViewportResult[]> {
  const results: ViewportResult[] = [];
  for (let i = 0; i < widths.length; i++) {
    const width = widths[i]!;
    const height = width < 768 ? 844 : width < 1280 ? 900 : 1080;
    const result = await analyzeViewport(url, width, height);
    results.push(result);
    onProgress?.(i + 1, widths.length, width);
  }
  return results;
}
