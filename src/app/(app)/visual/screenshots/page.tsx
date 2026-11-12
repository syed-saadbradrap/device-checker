"use client";

import { use, useState } from "react";
import { Download, GitCompare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { UrlForm } from "@/components/shared/url-form";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { DEFAULT_DEVICES, getDeviceById } from "@/lib/devices/presets";
import { apiFetch } from "@/lib/api/client";
import { downloadBlob } from "@/lib/utils";

type ScreenshotResult = {
  imageBase64: string;
  mimeType: string;
  metadata: {
    url: string;
    finalUrl: string;
    title: string;
    width: number;
    height: number;
    engine: string;
    browserVersion?: string;
  };
};

type CompareResult = {
  width: number;
  height: number;
  diffPixels: number;
  totalPixels: number;
  diffPercent: number;
  passed: boolean;
  diffBase64?: string;
  diffPngBase64?: string;
  imageBase64?: string;
};

type View = "capture" | "compare";

const CUSTOM = "custom";

export default function ScreenshotsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = use(searchParams);
  const [view, setView] = useState<View>(params.tab === "compare" ? "compare" : "capture");

  return (
    <div>
      <PageHeader
        title="Screenshots"
        description="Take a real browser screenshot of any public page, or compare two screenshots to spot changes."
      />
      <Tabs
        className="mb-4"
        value={view}
        onChange={setView}
        tabs={[
          { id: "capture", label: "Capture" },
          { id: "compare", label: "Compare two" },
        ]}
      />
      {view === "capture" ? <CaptureView /> : <CompareView />}
    </div>
  );
}

function CaptureView() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScreenshotResult | null>(null);
  const [deviceId, setDeviceId] = useState("desktop-fhd");
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(800);
  const [fullPage, setFullPage] = useState(false);
  const [engine, setEngine] = useState("chromium");

  async function capture(url: string) {
    const device = deviceId === CUSTOM ? undefined : getDeviceById(deviceId);
    if (!device && (width < 200 || height < 200 || width > 3840 || height > 3840)) {
      toast.error("Custom size must be between 200 and 3840 pixels");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await apiFetch<ScreenshotResult>("/api/screenshot", {
      method: "POST",
      body: JSON.stringify({
        url,
        deviceId: device?.id,
        width: device?.width ?? width,
        height: device?.height ?? height,
        dpr: device?.dpr ?? 1,
        engine,
        fullPage,
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
    toast.success("Screenshot captured");
  }

  function download() {
    if (!result) return;
    const bytes = Uint8Array.from(atob(result.imageBase64), (c) => c.charCodeAt(0));
    downloadBlob(new Blob([bytes], { type: result.mimeType || "image/png" }), `screenshot-${Date.now()}.png`);
  }

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Capture a page</CardTitle>
          <CardDescription>Choose a device, type a URL and press Capture. Usually takes 5–20 seconds.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
              aria-label="Device"
            >
              {DEFAULT_DEVICES.map((id) => {
                const d = getDeviceById(id);
                return d ? (
                  <option key={id} value={id}>
                    {d.name} ({d.width}×{d.height})
                  </option>
                ) : null;
              })}
              <option value={CUSTOM}>Custom size…</option>
            </select>
            {deviceId === CUSTOM ? (
              <>
                <Input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  className="w-24"
                  aria-label="Width"
                />
                <span className="text-sm text-[var(--muted-foreground)]">×</span>
                <Input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="w-24"
                  aria-label="Height"
                />
              </>
            ) : null}
            <select
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
              aria-label="Browser engine"
            >
              <option value="chromium">Chromium (Chrome/Edge engine)</option>
              <option value="firefox">Firefox engine</option>
              <option value="webkit">WebKit (Safari engine)</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={fullPage}
                onChange={(e) => setFullPage(e.target.checked)}
              />
              Whole page (scroll to bottom)
            </label>
          </div>
          <UrlForm onSubmit={capture} loading={loading} submitLabel="Capture" />
        </CardContent>
      </Card>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Opening the page in a real browser…
          </p>
          <Skeleton className="h-80 w-full" />
        </div>
      ) : !result ? (
        <EmptyState
          title="No screenshot yet"
          description="Type a website above (for example example.com) and press Capture."
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="truncate">{result.metadata.title || "Screenshot"}</CardTitle>
                <CardDescription>
                  {result.metadata.width}×{result.metadata.height} · {result.metadata.engine}
                  {result.metadata.browserVersion ? ` ${result.metadata.browserVersion}` : ""}
                </CardDescription>
              </div>
              <Button variant="outline" onClick={download}>
                <Download className="h-4 w-4" />
                Download PNG
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:${result.mimeType};base64,${result.imageBase64}`}
              alt="Captured screenshot"
              className="mx-auto max-w-full rounded-md border border-[var(--border)]"
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function CompareView() {
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
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image too large (max 10MB)");
      return;
    }
    const b64 = await fileToBase64(file);
    if (which === "a") setBaseline(b64);
    else setCurrent(b64);
    setResult(null);
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
    setResult(null);
    toast.success(which === "a" ? "Before image captured" : "After image captured");
  }

  async function compare() {
    if (!baseline || !current) {
      toast.error("Add both images first");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await apiFetch<CompareResult>("/api/visual/compare", {
      method: "POST",
      body: JSON.stringify({
        baseline,
        current,
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

  const diffData = result?.diffBase64 || result?.diffPngBase64 || result?.imageBase64;

  return (
    <>
      <p className="mb-4 text-sm text-[var(--muted-foreground)]">
        Add a “before” and an “after” image (upload a PNG or capture a URL). We highlight every pixel
        that changed.
      </p>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {(["a", "b"] as const).map((which) => {
          const image = which === "a" ? baseline : current;
          return (
            <Card key={which}>
              <CardHeader>
                <CardTitle>{which === "a" ? "Before" : "After"}</CardTitle>
                <CardDescription>Upload an image or capture a URL (1280×800)</CardDescription>
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
                  disabled={capturing !== null && capturing !== which}
                  onSubmit={(url) => captureInto(which, url)}
                />
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:image/png;base64,${image}`}
                    alt={which === "a" ? "Before" : "After"}
                    className="max-h-64 w-full rounded-md border border-[var(--border)] object-contain"
                  />
                ) : (
                  <EmptyState title="No image yet" description="Upload or capture one." className="py-8" />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start">
        <Button size="lg" onClick={compare} disabled={loading || !baseline || !current}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompare className="h-4 w-4" />}
          Compare images
        </Button>
        <details className="text-sm text-[var(--muted-foreground)]">
          <summary className="cursor-pointer py-2">Advanced settings</summary>
          <div className="mt-2 flex flex-wrap gap-3">
            <label className="text-xs">
              Color sensitivity (0–1)
              <Input
                type="number"
                step="0.01"
                min={0}
                max={1}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="mt-1 w-32"
              />
            </label>
            <label className="text-xs">
              Allowed change %
              <Input
                type="number"
                step="0.1"
                min={0}
                value={maxDiffPercent}
                onChange={(e) => setMaxDiffPercent(Number(e.target.value))}
                className="mt-1 w-32"
              />
            </label>
          </div>
        </details>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {result ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{result.passed ? "Looks the same" : "Changes found"}</CardTitle>
              <StatusBadge status={result.passed ? "passed" : "failed"} />
            </div>
            <CardDescription>
              {result.diffPercent.toFixed(3)}% of pixels changed (
              {result.diffPixels.toLocaleString()} of {result.totalPixels.toLocaleString()}) ·{" "}
              {result.width}×{result.height}. Changed pixels are highlighted in red.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {diffData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${diffData}`}
                alt="Difference"
                className="w-full rounded-md border border-[var(--border)]"
              />
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">Diff image not returned.</p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
