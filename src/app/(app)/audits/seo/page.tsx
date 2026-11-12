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

export default function SeoAuditPage() {
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
    toast.success("SEO analysis complete");
  }

  return (
    <div>
      <PageHeader
        title="SEO Analyzer"
        description="Fetches the page and runs on-page SEO checks, including a sampled broken-link probe."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Analyze URL</CardTitle>
          <CardDescription>Public HTTP(S) pages only.</CardDescription>
        </CardHeader>
        <CardContent>
          <UrlForm onSubmit={run} loading={loading} submitLabel="Analyze SEO" />
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
        <EmptyState title="No SEO report yet" description="Run an analysis to see checks." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{report.title || "Untitled page"}</CardTitle>
            <CardDescription>
              {report.finalUrl} · {formatDate(report.fetchedAt)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-[var(--border)]">
              {report.checks.map((c) => (
                <li key={c.id} className="py-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <StatusBadge status={c.status} />
                    <span className="text-xs text-[var(--muted-foreground)]">{c.category}</span>
                  </div>
                  <p className="text-sm font-medium">{c.message}</p>
                  {c.detail ? (
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">{c.detail}</p>
                  ) : null}
                  {c.suggestion ? (
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">{c.suggestion}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
