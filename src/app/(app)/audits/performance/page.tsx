"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { UrlForm } from "@/components/shared/url-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { cn, formatScore, scoreColor } from "@/lib/utils";

type LighthouseReport = {
  url: string;
  finalUrl: string;
  fetchTime: string;
  lighthouseVersion: string;
  scores: {
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
  };
  opportunities: Array<{
    id: string;
    title: string;
    description: string;
    score: number | null;
    displayValue?: string;
  }>;
  diagnostics?: Array<{
    id: string;
    title: string;
    description: string;
    score: number | null;
    displayValue?: string;
  }>;
  note?: string;
};

export default function PerformanceAuditPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<LighthouseReport | null>(null);

  async function run(url: string) {
    setLoading(true);
    setError(null);
    const res = await apiFetch<LighthouseReport>("/api/analyze/performance", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      setReport(null);
      toast.error(res.error);
      return;
    }
    setReport(res.data);
    toast.success("Lighthouse audit complete");
  }

  const scoreCards = report
    ? [
        { label: "Performance", value: report.scores.performance },
        { label: "Accessibility", value: report.scores.accessibility },
        { label: "Best Practices", value: report.scores.bestPractices },
        { label: "SEO", value: report.scores.seo },
      ]
    : [];

  return (
    <div>
      <PageHeader
        title="Performance"
        description="Runs a real Lighthouse audit via Playwright. Scores appear only after a successful run — never placeholders."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Run Lighthouse</CardTitle>
          <CardDescription>Desktop form factor. This can take 30–90 seconds.</CardDescription>
        </CardHeader>
        <CardContent>
          <UrlForm onSubmit={run} loading={loading} submitLabel="Run audit" />
        </CardContent>
      </Card>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !report ? (
        <EmptyState
          title="No audit yet"
          description="Enter a public URL to run Lighthouse. Empty scores are never invented."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {scoreCards.map((s) => (
              <Card key={s.label}>
                <CardHeader className="pb-2">
                  <CardDescription>{s.label}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={cn("text-3xl font-semibold tabular-nums", s.value != null && scoreColor(s.value))}>
                    {formatScore(s.value)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Core metrics</CardTitle>
              <CardDescription>
                {report.finalUrl} · LH {report.lighthouseVersion}
                {report.note ? ` · ${report.note}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["FCP", report.scores.fcp, "ms"],
                ["LCP", report.scores.lcp, "ms"],
                ["CLS", report.scores.cls, ""],
                ["Speed Index", report.scores.si, "ms"],
                ["TBT", report.scores.tbt, "ms"],
                ["TTI", report.scores.tti, "ms"],
              ].map(([label, value, unit]) => (
                <div key={String(label)} className="rounded-md border border-[var(--border)] px-3 py-2">
                  <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
                  <p className="font-medium tabular-nums">
                    {value == null ? "—" : `${Math.round(Number(value))}${unit}`}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Opportunities</CardTitle>
              <CardDescription>Actionable Lighthouse opportunities from this run</CardDescription>
            </CardHeader>
            <CardContent>
              {report.opportunities.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No opportunities returned.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {report.opportunities.map((o) => (
                    <li key={o.id} className="py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium">{o.title}</p>
                        {o.displayValue ? (
                          <span className="text-xs text-[var(--muted-foreground)]">{o.displayValue}</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{o.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
