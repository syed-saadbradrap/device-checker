"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { UrlForm } from "@/components/shared/url-form";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";

type A11yReport = {
  url: string;
  violations: Array<{
    id: string;
    impact: string | null;
    description: string;
    help: string;
    helpUrl: string;
    nodes: Array<{ html: string; target: string[]; failureSummary?: string }>;
  }>;
  passes: number;
  incomplete: number;
  engine: string;
  scannedAt: string;
};

export default function AccessibilityAuditPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<A11yReport | null>(null);

  async function run(url: string) {
    setLoading(true);
    setError(null);
    const res = await apiFetch<A11yReport>("/api/analyze/accessibility", {
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
    toast.success("Accessibility audit complete");
  }

  return (
    <div>
      <PageHeader
        title="Accessibility"
        description="axe-core via Playwright Chromium. Violations are real results from the scanned page."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Run axe audit</CardTitle>
          <CardDescription>WCAG 2 A/AA and best-practice tags.</CardDescription>
        </CardHeader>
        <CardContent>
          <UrlForm onSubmit={run} loading={loading} submitLabel="Scan page" />
        </CardContent>
      </Card>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : !report ? (
        <EmptyState title="No scan yet" description="Enter a URL to collect axe violations." />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Violations</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{report.violations.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Passes</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{report.passes}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Incomplete</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{report.incomplete}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Violations</CardTitle>
              <CardDescription>
                {report.engine} · {formatDate(report.scannedAt)} · {report.url}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report.violations.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No violations found in this scan.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {report.violations.map((v) => (
                    <li key={v.id} className="space-y-2 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{v.help}</p>
                        {v.impact ? <StatusBadge status={v.impact} /> : null}
                      </div>
                      <p className="text-sm text-[var(--muted-foreground)]">{v.description}</p>
                      <a
                        href={v.helpUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline-offset-4 hover:underline"
                      >
                        Learn more
                      </a>
                      {v.nodes[0] ? (
                        <pre className="overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--secondary)] p-2 text-[11px]">
                          {v.nodes[0].html}
                        </pre>
                      ) : null}
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
