import * as cheerio from "cheerio";
import { validatePublicUrl, assertSafeRedirectTarget } from "@/lib/security/url";

export interface SeoCheck {
  id: string;
  status: "pass" | "fail" | "warning" | "info";
  category: string;
  message: string;
  detail?: string;
  suggestion?: string;
}

export interface SeoReport {
  url: string;
  finalUrl: string;
  title: string | null;
  checks: SeoCheck[];
  fetchedAt: string;
}

export async function analyzeSeo(inputUrl: string): Promise<SeoReport> {
  const safe = await validatePublicUrl(inputUrl);
  if (!safe.ok) throw new Error(safe.error);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  const res = await fetch(safe.url, {
    redirect: "follow",
    signal: controller.signal,
    headers: { "User-Agent": "DeviceLab-SEO/1.0" },
  });
  clearTimeout(timer);

  const finalCheck = await assertSafeRedirectTarget(res.url);
  if (!finalCheck.ok) throw new Error(finalCheck.error);

  const html = await res.text();
  const $ = cheerio.load(html);
  const checks: SeoCheck[] = [];
  const title = $("title").first().text().trim() || null;
  const metaDesc = $('meta[name="description"]').attr("content")?.trim() || null;
  const canonical = $('link[rel="canonical"]').attr("href") || null;
  const robots = $('meta[name="robots"]').attr("content") || null;
  const h1s = $("h1");
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogDesc = $('meta[property="og:description"]').attr("content");
  const ogImage = $('meta[property="og:image"]').attr("content");
  const twitterCard = $('meta[name="twitter:card"]').attr("content");

  checks.push(
    title
      ? {
          id: "title",
          status: title.length >= 15 && title.length <= 60 ? "pass" : "warning",
          category: "Title",
          message: title
            ? `Title present (${title.length} chars)`
            : "Missing title",
          detail: title || undefined,
          suggestion:
            title && (title.length < 15 || title.length > 60)
              ? "Keep titles roughly 15–60 characters."
              : undefined,
        }
      : {
          id: "title",
          status: "fail",
          category: "Title",
          message: "Missing <title>",
          suggestion: "Add a unique, descriptive page title.",
        }
  );

  checks.push(
    metaDesc
      ? {
          id: "meta-description",
          status:
            metaDesc.length >= 50 && metaDesc.length <= 160 ? "pass" : "warning",
          category: "Meta",
          message: `Meta description present (${metaDesc.length} chars)`,
          detail: metaDesc,
        }
      : {
          id: "meta-description",
          status: "fail",
          category: "Meta",
          message: "Missing meta description",
          suggestion: "Add a compelling meta description (≈50–160 chars).",
        }
  );

  checks.push({
    id: "h1",
    status: h1s.length === 1 ? "pass" : h1s.length === 0 ? "fail" : "warning",
    category: "Headings",
    message:
      h1s.length === 1
        ? "Single H1 found"
        : h1s.length === 0
          ? "No H1 found"
          : `Multiple H1 tags (${h1s.length})`,
    detail: h1s
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .slice(0, 5)
      .join(" | "),
    suggestion: "Use exactly one H1 that describes the page topic.",
  });

  // Heading hierarchy
  const headingLevels = $("h1,h2,h3,h4,h5,h6")
    .map((_, el) => Number(el.tagName[1]))
    .get();
  let hierarchyOk = true;
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i]! > headingLevels[i - 1]! + 1) {
      hierarchyOk = false;
      break;
    }
  }
  checks.push({
    id: "heading-hierarchy",
    status: hierarchyOk ? "pass" : "warning",
    category: "Headings",
    message: hierarchyOk
      ? "Heading hierarchy looks sequential"
      : "Heading levels appear to skip (e. and g. H2 → H4)",
    suggestion: "Avoid skipping heading levels for accessibility and SEO.",
  });

  checks.push({
    id: "canonical",
    status: canonical ? "pass" : "warning",
    category: "Indexability",
    message: canonical ? "Canonical URL present" : "No canonical link",
    detail: canonical || undefined,
  });

  checks.push({
    id: "robots-meta",
    status: robots && /noindex/i.test(robots) ? "warning" : "info",
    category: "Indexability",
    message: robots
      ? `Robots meta: ${robots}`
      : "No robots meta tag (defaults to index,follow)",
    detail: robots || undefined,
  });

  checks.push({
    id: "open-graph",
    status: ogTitle && ogDesc && ogImage ? "pass" : "warning",
    category: "Social",
    message:
      ogTitle && ogDesc && ogImage
        ? "Open Graph tags present"
        : "Incomplete Open Graph tags",
    detail: [ogTitle, ogDesc, ogImage].filter(Boolean).join(" · "),
    suggestion: "Add og:title, og:description, and og:image.",
  });

  checks.push({
    id: "twitter-card",
    status: twitterCard ? "pass" : "info",
    category: "Social",
    message: twitterCard
      ? `Twitter card: ${twitterCard}`
      : "No Twitter Card meta tags",
  });

  const imgs = $("img");
  let missingAlt = 0;
  imgs.each((_, el) => {
    if (!$(el).attr("alt") && $(el).attr("alt") !== "") missingAlt++;
    if ($(el).attr("alt") == null) missingAlt++;
  });
  // recount properly
  missingAlt = imgs.filter((_, el) => $(el).attr("alt") == null).length;
  checks.push({
    id: "img-alt",
    status: missingAlt === 0 ? "pass" : "warning",
    category: "Images",
    message:
      missingAlt === 0
        ? `All ${imgs.length} images have alt attributes`
        : `${missingAlt} of ${imgs.length} images missing alt`,
  });

  // Internal links sample + broken link probe (limited)
  const origin = new URL(res.url).origin;
  const hrefs = $(
    "a[href^='http'], a[href^='/']"
  )
    .map((_, el) => $(el).attr("href") || "")
    .get()
    .filter(Boolean);
  const absolute = [
    ...new Set(
      hrefs.map((h) => {
        try {
          return new URL(h, res.url).toString();
        } catch {
          return "";
        }
      })
    ),
  ]
    .filter(Boolean)
    .slice(0, 15);

  let broken = 0;
  for (const link of absolute) {
    const check = await assertSafeRedirectTarget(link);
    if (!check.ok) continue;
    try {
      const r = await fetch(link, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
      });
      if (r.status >= 400) broken++;
    } catch {
      // HEAD may fail; try GET lightly
      try {
        const r = await fetch(link, {
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(5000),
        });
        if (r.status >= 400) broken++;
      } catch {
        broken++;
      }
    }
  }

  checks.push({
    id: "broken-links",
    status: broken === 0 ? "pass" : "fail",
    category: "Links",
    message:
      broken === 0
        ? `No broken links in sample of ${absolute.length}`
        : `${broken} broken link(s) in sample of ${absolute.length}`,
    suggestion: "Fix 4xx/5xx destinations and update outdated hrefs.",
  });

  // robots.txt & sitemap
  try {
    const robotsUrl = new URL("/robots.txt", origin).toString();
    const rr = await fetch(robotsUrl, { signal: AbortSignal.timeout(5000) });
    checks.push({
      id: "robots-txt",
      status: rr.ok ? "pass" : "warning",
      category: "Crawl",
      message: rr.ok ? "robots.txt reachable" : `robots.txt status ${rr.status}`,
    });
  } catch {
    checks.push({
      id: "robots-txt",
      status: "warning",
      category: "Crawl",
      message: "Could not fetch robots.txt",
    });
  }

  try {
    const sitemapUrl = new URL("/sitemap.xml", origin).toString();
    const sr = await fetch(sitemapUrl, { signal: AbortSignal.timeout(5000) });
    checks.push({
      id: "sitemap",
      status: sr.ok ? "pass" : "info",
      category: "Crawl",
      message: sr.ok ? "sitemap.xml reachable" : `sitemap.xml status ${sr.status}`,
    });
  } catch {
    checks.push({
      id: "sitemap",
      status: "info",
      category: "Crawl",
      message: "Could not fetch sitemap.xml",
    });
  }

  return {
    url: safe.url,
    finalUrl: res.url,
    title,
    checks,
    fetchedAt: new Date().toISOString(),
  };
}
