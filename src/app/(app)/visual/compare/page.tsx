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

type CompareResult = {
  width: number;
  height: number;
  diffPixels: number;
  totalPixels: number;
  diffRatio: number;
  diffPercent: number;
  passed: boolean;
  diffBase64?: string;
  diffPngBase64?: string;
  imageBase64?: string;
};

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export default function ComparePage() {
  const [baseline, setBaseline] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.1);
  const [maxDiffPercent, setMaxDiffPercent] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState<"a" | "b" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);

  async function onFile(which: "a" | "b", file: File | null) {
    if (!file) return;
    const b64 = await fileToBase64(file);
    if (which === "a") setBaseline(b64);
    else setCurrent(b64);
  }

  async function captureInto(which: "a" | "b", url: string) {
    setCapturing(which);
    const res = await apiFetch<{ imageBase64: string }>("/api/screenshot", {
      method: "POST",
      body: JSON.stringify({ url, width: 1280, height: 800, engine: "chromium" }),
    });
    setCapturing(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (which === "a") setBaseline(res.data.imageBase64);
    else setCurrent(res.data.imageBase64);
    toast.success(which === "a" ? "Baseline captured" : "Current captured");
  }

  async function compare() {
    if (!baseline || !current) {
      toast.error("Provide both images");
      return;
    }
    setLoading(true);
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
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      setResult(null);
      toast.error(res.error);
      return;
    }
    setResult(res.data);
    toast.success("Comparison complete");
  }

  const diffSrc =
    result?.diffBase64 || result?.diffPngBase64 || result?.imageBase64
      ? `data:image/png;base64,${result.diffBase64 || result.diffPngBase64 || result.imageBase64}`
      : null;

  return (
    <div>
      <PageHeader
        title="Screenshot Comparison"
        description="Upload two PNGs or capture them, then diff via /api/visual/compare."
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {(["a", "b"] as const).map((which) => (
          <Card key={which}>
            <CardHeader>
              <CardTitle>{which === "a" ? "Baseline" : "Current"}</CardTitle>
              <CardDescription>Upload or capture</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => void onFile(which, e.target.files?.[0] ?? null)}
              />
              <UrlForm
                submitLabel={capturing === which ? "Capturing…" : "Capture URL"}
                loading={capturing === which}
                onSubmit={(url) => captureInto(which, url)}
              />
              {(which === "a" ? baseline : current) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:image/png;base64,${which === "a" ? baseline : current}`}
                  alt={which === "a" ? "Baseline" : "Current"}
                  className="max-h-64 w-full rounded-md border border-[var(--border)] object-contain"
                />
              ) : (
                <EmptyState title="No image" description="Upload or capture one." className="py-8" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Diff settings</CardTitle>
          <CardDescription>
            Pixelmatch threshold (0–1) and max allowed diff percent for pass/fail.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            Threshold
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
          <label className="flex-1 text-sm">
            Max diff %
            <Input
              type="number"
              step="0.1"
              min={0}
              value={maxDiffPercent}
              onChange={(e) => setMaxDiffPercent(Number(e.target.value))}
              className="mt-1"
            />
          </label>
          <Button onClick={compare} disabled={loading || !baseline || !current}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Compare
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {result ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Diff result</CardTitle>
              <StatusBadge status={result.passed ? "passed" : "failed"} />
            </div>
            <CardDescription>
              {result.diffPixels.toLocaleString()} / {result.totalPixels.toLocaleString()} pixels ·{" "}
              {result.diffPercent.toFixed(3)}% · {result.width}×{result.height}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {diffSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={diffSrc} alt="Diff" className="w-full rounded-md border border-[var(--border)]" />
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">Diff image not returned by API.</p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
