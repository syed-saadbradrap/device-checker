"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { UrlForm } from "@/components/shared/url-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";

type Capture = {
  engine: string;
  title?: string;
  finalUrl?: string;
  browserVersion?: string;
  consoleErrors?: string[];
  pageErrors?: string[];
  failedRequests?: Array<{ url: string; status?: number; error?: string }>;
  imageBase64: string;
  width?: number;
  height?: number;
};

type BrowsersResult = {
  url: string;
  width: number;
  height: number;
  captures: Capture[];
};

const ENGINE_LABEL: Record<string, string> = {
  chromium: "Playwright Chromium",
  firefox: "Playwright Firefox",
  webkit: "Playwright WebKit",
};

export default function BrowserTesterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BrowsersResult | null>(null);

  async function run(url: string) {
    setLoading(true);
    setError(null);
    const res = await apiFetch<BrowsersResult>("/api/analyze/browsers", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      setResult(null);
      toast.error(res.error);
      return;
    }
    setResult(res.data);
    toast.success("Browser captures complete");
  }

  return (
    <div>
      <PageHeader
        title="Browser Tester"
        description="Captures the same URL in Playwright Chromium, Firefox, and WebKit. These are engine builds — not branded Safari or Chrome releases."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Run cross-engine capture</CardTitle>
          <CardDescription>
            Public URLs only. Screenshots and console/page errors are returned per engine.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UrlForm onSubmit={run} loading={loading} submitLabel="Capture browsers" />
        </CardContent>
      </Card>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : !result ? (
        <EmptyState
          title="No captures yet"
          description="Enter a URL to compare rendering across Playwright engines."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {result.captures.map((c) => (
            <Card key={c.engine}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{ENGINE_LABEL[c.engine] ?? c.engine}</CardTitle>
                  <Badge variant="outline">{c.engine}</Badge>
                </div>
                <CardDescription className="truncate">
                  {c.browserVersion || c.title || c.finalUrl}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${c.imageBase64}`}
                  alt={`${c.engine} screenshot`}
                  className="w-full rounded-md border border-[var(--border)]"
                />
                {(c.pageErrors?.length || c.consoleErrors?.length) ? (
                  <div className="space-y-1 text-xs">
                    {c.pageErrors?.slice(0, 3).map((e, i) => (
                      <p key={`p-${i}`} className="text-red-600 dark:text-red-400">
                        Page: {e}
                      </p>
                    ))}
                    {c.consoleErrors?.slice(0, 3).map((e, i) => (
                      <p key={`c-${i}`} className="text-amber-700 dark:text-amber-400">
                        Console: {e}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted-foreground)]">No page/console errors reported.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
