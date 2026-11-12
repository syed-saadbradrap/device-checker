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

type ThemeShot = {
  colorScheme: "light" | "dark";
  title?: string;
  finalUrl?: string;
  imageBase64: string;
  consoleErrors?: string[];
  pageErrors?: string[];
};

type ThemeResult = {
  url: string;
  width: number;
  height: number;
  screenshots: ThemeShot[];
};

export default function ThemeTesterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ThemeResult | null>(null);

  async function run(url: string) {
    setLoading(true);
    setError(null);
    const res = await apiFetch<ThemeResult>("/api/analyze/theme", {
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
    toast.success("Theme captures complete");
  }

  return (
    <div>
      <PageHeader
        title="Theme Tester"
        description="Side-by-side light and dark captures using Playwright colorScheme emulation."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>How this works</CardTitle>
          <CardDescription>
            DeviceLab sets <code className="text-xs">colorScheme: &quot;light&quot; | &quot;dark&quot;</code>{" "}
            on the browser context. That emulates the CSS{" "}
            <code className="text-xs">prefers-color-scheme</code> media query — it is not the same as
            toggling a site&apos;s own dark-mode switch, OS appearance, or native app theming. Sites
            that ignore <code className="text-xs">prefers-color-scheme</code> may look identical in both panes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UrlForm onSubmit={run} loading={loading} submitLabel="Capture themes" />
        </CardContent>
      </Card>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : !result ? (
        <EmptyState title="No theme captures yet" description="Run a capture to compare light vs dark colorScheme." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {result.screenshots.map((s) => (
            <Card key={s.colorScheme}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="capitalize">{s.colorScheme}</CardTitle>
                  <Badge variant="outline">colorScheme emulation</Badge>
                </div>
                <CardDescription className="truncate">{s.title || s.finalUrl}</CardDescription>
              </CardHeader>
              <CardContent>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${s.imageBase64}`}
                  alt={`${s.colorScheme} theme screenshot`}
                  className="w-full rounded-md border border-[var(--border)]"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
