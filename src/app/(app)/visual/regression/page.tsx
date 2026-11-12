"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { UrlForm } from "@/components/shared/url-form";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";

type Shot = { imageBase64: string; metadata?: { finalUrl?: string; title?: string } };
type CompareResult = {
  diffPixels: number;
  totalPixels: number;
  diffPercent: number;
  passed: boolean;
  width: number;
  height: number;
  diffBase64?: string;
  diffPngBase64?: string;
};

export default function RegressionPage() {
  const [baseline, setBaseline] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [maxDiffPercent, setMaxDiffPercent] = useState(0.5);
  const [threshold, setThreshold] = useState(0.1);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);

  async function captureBaseline(target: string) {
    setUrl(target);
    setBusy("baseline");
    setError(null);
    const res = await apiFetch<Shot>("/api/screenshot", {
      method: "POST",
      body: JSON.stringify({ url: target, width: 1280, height: 800, engine: "chromium" }),
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    setBaseline(res.data.imageBase64);
    toast.success("Baseline saved in this session");
  }

  async function captureCurrent() {
    if (!url) {
      toast.error("Capture a baseline URL first");
      return;
    }
    setBusy("current");
    setError(null);
    const res = await apiFetch<Shot>("/api/screenshot", {
      method: "POST",
      body: JSON.stringify({ url, width: 1280, height: 800, engine: "chromium" }),
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    setCurrent(res.data.imageBase64);
    toast.success("Current capture ready");
  }

  async function runDiff() {
    if (!baseline || !current) {
      toast.error("Need baseline and current captures");
      return;
    }
    setBusy("diff");
    setError(null);
    const res = await apiFetch<CompareResult>("/api/visual/compare", {
      method: "POST",
      body: JSON.stringify({
        baseline,
        current,
        imageA: baseline,
        imageB: current,
        threshold,
        maxDiffPercent,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    setResult(res.data);
    toast.success(res.data.passed ? "Regression check passed" : "Regression check failed");
  }

  const diffSrc =
    result?.diffBase64 || result?.diffPngBase64
      ? `data:image/png;base64,${result.diffBase64 || result.diffPngBase64}`
      : null;

  return (
    <div>
      <PageHeader
        title="Visual Regression"
        description="Capture a baseline screenshot, recapture the same URL, then compare with a pass threshold."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Threshold</CardTitle>
          <CardDescription>
            <strong>maxDiffPercent</strong> is the maximum percentage of differing pixels allowed
            before the check fails (default 0.5%). <strong>threshold</strong> is the pixelmatch
            per-pixel sensitivity (0–1; lower is stricter). Anti-aliased edges and animations can
            inflate diffs — raise the max percent carefully rather than ignoring failures.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Pixelmatch threshold
            <Input
              type="number"
              step="0.01"
              min={0}
              max={1}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="mt-1"
            />
          </label>
          <label className="text-sm">
            Max diff percent
            <Input
              type="number"
              step="0.1"
              min={0}
              value={maxDiffPercent}
              onChange={(e) => setMaxDiffPercent(Number(e.target.value))}
              className="mt-1"
            />
          </label>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Workflow</CardTitle>
          <CardDescription>1) Capture baseline · 2) Capture current · 3) Compare</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <UrlForm
            onSubmit={captureBaseline}
            loading={busy === "baseline"}
            submitLabel="1. Capture baseline"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={captureCurrent} disabled={!url || busy === "current"}>
              {busy === "current" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              2. Capture current
            </Button>
            <Button
              variant="outline"
              onClick={runDiff}
              disabled={!baseline || !current || busy === "diff"}
            >
              {busy === "diff" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              3. Compare
            </Button>
          </div>
          {url ? (
            <p className="text-xs text-[var(--muted-foreground)]">Target: {url}</p>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Baseline</CardTitle>
          </CardHeader>
          <CardContent>
            {baseline ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`data:image/png;base64,${baseline}`} alt="Baseline" className="w-full rounded-md border border-[var(--border)]" />
            ) : (
              <EmptyState title="No baseline" className="py-8" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Current</CardTitle>
          </CardHeader>
          <CardContent>
            {current ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`data:image/png;base64,${current}`} alt="Current" className="w-full rounded-md border border-[var(--border)]" />
            ) : (
              <EmptyState title="No current capture" className="py-8" />
            )}
          </CardContent>
        </Card>
      </div>

      {result ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Regression result</CardTitle>
              <StatusBadge status={result.passed ? "passed" : "failed"} />
            </div>
            <CardDescription>
              {result.diffPercent.toFixed(3)}% differing ({result.diffPixels}/{result.totalPixels}) ·
              limit {maxDiffPercent}%
            </CardDescription>
          </CardHeader>
          <CardContent>
            {diffSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={diffSrc} alt="Diff" className="w-full rounded-md border border-[var(--border)]" />
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
