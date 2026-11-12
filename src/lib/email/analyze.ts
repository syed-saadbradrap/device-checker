import * as cheerio from "cheerio";

export type EmailIssueSeverity = "critical" | "serious" | "moderate" | "minor" | "info";

export interface EmailIssue {
  id: string;
  severity: EmailIssueSeverity;
  category: string;
  message: string;
  selector?: string;
  suggestion?: string;
}

export interface EmailAnalysis {
  issues: EmailIssue[];
  stats: {
    imageCount: number;
    linkCount: number;
    tableCount: number;
    hasDoctype: boolean;
    hasViewportMeta: boolean;
    approxHtmlBytes: number;
    maxWidthHint: number | null;
  };
  unsupportedCss: string[];
  simulatedNote: string;
}

const UNSUPPORTED_IN_MANY_CLIENTS = [
  "position:fixed",
  "position:sticky",
  "display:flex",
  "display:grid",
  "gap:",
  "filter:",
  "backdrop-filter",
  "clip-path",
  "object-fit",
  "vh",
  "vw",
  "calc(",
];

export function analyzeEmailHtml(html: string): EmailAnalysis {
  const $ = cheerio.load(html);
  const issues: EmailIssue[] = [];
  let id = 0;
  const nextId = () => `email-${++id}`;

  const images = $("img");
  images.each((_, el) => {
    const alt = $(el).attr("alt");
    const src = $(el).attr("src") || "";
    if (alt == null || alt.trim() === "") {
      issues.push({
        id: nextId(),
        severity: "moderate",
        category: "Accessibility",
        message: "Image missing alt text",
        selector: "img",
        suggestion: "Add meaningful alt attributes for all images.",
      });
    }
    if (!src) {
      issues.push({
        id: nextId(),
        severity: "serious",
        category: "Images",
        message: "Image missing src",
        suggestion: "Provide a valid image URL or CID reference.",
      });
    }
    const w = Number($(el).attr("width"));
    const h = Number($(el).attr("height"));
    if (!w || !h) {
      issues.push({
        id: nextId(),
        severity: "minor",
        category: "Images",
        message: "Image missing explicit width/height attributes",
        suggestion: "Set width and height to reduce layout shift in clients.",
      });
    }
  });

  const links = $("a");
  links.each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href === "#" || href.trim() === "") {
      issues.push({
        id: nextId(),
        severity: "moderate",
        category: "Links",
        message: "Link missing a valid href",
        suggestion: "Use absolute https:// or mailto: links.",
      });
    }
  });

  const textLower = html.toLowerCase();
  if (!/unsubscribe|opt[-\s]?out|manage preferences/i.test(textLower)) {
    issues.push({
      id: nextId(),
      severity: "info",
      category: "Compliance",
      message: "No unsubscribe language detected",
      suggestion:
        "Marketing emails typically require an unsubscribe link where regulations apply.",
    });
  }

  if (!$("table").length) {
    issues.push({
      id: nextId(),
      severity: "info",
      category: "Layout",
      message: "No table-based layout detected",
      suggestion:
        "Many email clients still prefer table-based layouts for consistent rendering.",
    });
  }

  const styleBlocks = $("style")
    .map((_, el) => $(el).html() || "")
    .get()
    .join("\n");
  const inlineStyles = $("[style]")
    .map((_, el) => $(el).attr("style") || "")
    .get()
    .join("\n");
  const allCss = `${styleBlocks}\n${inlineStyles}`.toLowerCase();

  const unsupportedCss = UNSUPPORTED_IN_MANY_CLIENTS.filter((token) =>
    allCss.includes(token.toLowerCase())
  );
  for (const token of unsupportedCss) {
    issues.push({
      id: nextId(),
      severity: "moderate",
      category: "CSS Compatibility",
      message: `Potentially unsupported CSS: ${token}`,
      suggestion: "Prefer hybrid/table layouts and progressive enhancement for advanced CSS.",
    });
  }

  if (!/\$|style=/.test(html) && !$("style").length) {
    issues.push({
      id: nextId(),
      severity: "info",
      category: "CSS",
      message: "Little or no CSS detected — ensure critical styles are inlined for clients that strip <style>.",
    });
  }

  // Buttons / tap targets
  $("a").each((_, el) => {
    const style = ($(el).attr("style") || "").toLowerCase();
    const text = $(el).text().trim();
    if (text && /button|cta|buy|shop|subscribe|register/i.test(text + style)) {
      if (!/padding|display:\s*inline-block|line-height/i.test(style)) {
        issues.push({
          id: nextId(),
          severity: "minor",
          category: "Buttons",
          message: `Possible CTA link may be hard to tap: "${text.slice(0, 40)}"`,
          suggestion: "Use padding ≥ 12px and inline-block for bulletproof buttons.",
        });
      }
    }
  });

  const widthMatches = [...html.matchAll(/max-width\s*:\s*(\d+)px/gi)].map((m) =>
    Number(m[1])
  );
  const maxWidthHint = widthMatches.length ? Math.max(...widthMatches) : null;
  if (maxWidthHint && maxWidthHint > 800) {
    issues.push({
      id: nextId(),
      severity: "warning" as EmailIssueSeverity,
      category: "Layout",
      message: `Large max-width (${maxWidthHint}px) may overflow mobile clients`,
      suggestion: "Keep email containers around 600–680px wide.",
    });
  }

  // Fix severity typo - use moderate instead of warning
  issues.forEach((issue) => {
    if ((issue.severity as string) === "warning") issue.severity = "moderate";
  });

  if (!/<!doctype/i.test(html)) {
    issues.push({
      id: nextId(),
      severity: "minor",
      category: "HTML",
      message: "Missing DOCTYPE",
      suggestion: "Add <!DOCTYPE html> for more consistent rendering.",
    });
  }

  return {
    issues,
    stats: {
      imageCount: images.length,
      linkCount: links.length,
      tableCount: $("table").length,
      hasDoctype: /<!doctype/i.test(html),
      hasViewportMeta: $('meta[name="viewport"]').length > 0,
      approxHtmlBytes: Buffer.byteLength(html, "utf8"),
      maxWidthHint,
    },
    unsupportedCss,
    simulatedNote:
      "Email client previews in DeviceLab are CSS/viewport simulations, not exact client rendering engines (unless an external ESP integration is configured).",
  };
}
