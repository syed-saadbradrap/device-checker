"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { UrlForm } from "@/components/shared/url-form";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";

type SeoCheck = {
  id: string;
  status: string;
  category: string;
  message: string;
  detail?: string;
  suggestion?: string;
};

type SeoReport = {
  url: string;
  finalUrl: string;
  title: string | null;
  checks: SeoCheck[];
  fetchedAt: string;
};

export default function BrokenLinksPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SeoReport | null>(null);

  async function run(url: string) {
    setLoading(true);
    setError(null);
    const res = await apiFetch<SeoReport>("/api/analyze/seo", {
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
    toast.success("Link check complete");
  }

  const linkChecks = useMemo(
    () =>
      report?.checks.filter(
        (c) =>
          c.id === "broken-links" ||
          c.category.toLowerCase().includes("link") ||
          c.message.toLowerCase().includes("link")
      ) ?? [],
    [report]
  );

  return (
    <div>
      <PageHeader
        title="Broken Links"
        description="Uses the SEO analyzer’s sampled link probe (HEAD/GET on a subset of absolute links)."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Check links</CardTitle>
          <CardDescription>Calls /api/analyze/seo and surfaces link-related checks.</CardDescription>
        </CardHeader>
        <CardContent>
          <UrlForm onSubmit={run} loading={loading} submitLabel="Scan links" />
        </CardContent>
      </Card>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : !report ? (
        <EmptyState title="No link scan yet" description="Enter a URL to sample outbound links." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Link findings</CardTitle>
            <CardDescription>
              {report.finalUrl} · {formatDate(report.fetchedAt)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {linkChecks.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                No link-specific checks were returned for this page.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {linkChecks.map((c) => (
                  <li key={c.id} className="py-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <StatusBadge status={c.status} />
                      <span className="text-xs text-[var(--muted-foreground)]">{c.category}</span>
                    </div>
                    <p className="text-sm font-medium">{c.message}</p>
                    {c.suggestion ? (
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">{c.suggestion}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
