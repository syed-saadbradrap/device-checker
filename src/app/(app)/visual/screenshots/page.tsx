"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { UrlForm } from "@/components/shared/url-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_DEVICES, getDeviceById } from "@/lib/devices/presets";
import { apiFetch } from "@/lib/api/client";
import { downloadBlob } from "@/lib/utils";

type ScreenshotResult = {
  imageBase64: string;
  mimeType: string;
  filePath?: string;
  metadata: {
    url: string;
    finalUrl: string;
    title: string;
    width: number;
    height: number;
    engine: string;
    browserVersion?: string;
    deviceId?: string | null;
  };
};

export default function ScreenshotsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScreenshotResult | null>(null);
  const [deviceId, setDeviceId] = useState(DEFAULT_DEVICES[0]);
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(800);
  const [fullPage, setFullPage] = useState(false);
  const [engine, setEngine] = useState("chromium");

  async function capture(url: string) {
    setLoading(true);
    setError(null);
    const device = getDeviceById(deviceId);
    const res = await apiFetch<ScreenshotResult>("/api/screenshot", {
      method: "POST",
      body: JSON.stringify({
        url,
        deviceId,
        width: device?.width ?? width,
        height: device?.height ?? height,
        dpr: device?.dpr,
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
    <div>
      <PageHeader
        title="Screenshot Capture"
        description="Capture a Playwright screenshot for a public URL, then download the PNG."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Capture options</CardTitle>
          <CardDescription>Uses /api/screenshot with optional device preset.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select
              value={deviceId}
              onChange={(e) => {
                setDeviceId(e.target.value);
                const d = getDeviceById(e.target.value);
                if (d) {
                  setWidth(d.width);
                  setHeight(d.height);
                }
              }}
              className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
            >
              {DEFAULT_DEVICES.map((id) => {
                const d = getDeviceById(id);
                return (
                  <option key={id} value={id}>
                    {d?.name ?? id}
                  </option>
                );
              })}
            </select>
            <Input
              type="number"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              placeholder="Width"
            />
            <Input
              type="number"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              placeholder="Height"
            />
            <select
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
            >
              <option value="chromium">Chromium</option>
              <option value="firefox">Firefox</option>
              <option value="webkit">WebKit</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={fullPage}
              onChange={(e) => setFullPage(e.target.checked)}
            />
            Full page
          </label>
          <UrlForm onSubmit={capture} loading={loading} submitLabel="Capture" />
        </CardContent>
      </Card>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {loading ? (
        <Skeleton className="h-80 w-full" />
      ) : !result ? (
        <EmptyState title="No screenshot yet" description="Capture a URL to preview and download." />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle>{result.metadata.title || "Screenshot"}</CardTitle>
                <CardDescription>
                  {result.metadata.width}×{result.metadata.height} · {result.metadata.engine}
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
              className="w-full rounded-md border border-[var(--border)]"
            />
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Capturing…
        </p>
      ) : null}
    </div>
  );
}
