"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Camera,
  ExternalLink,
  Maximize2,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Trash2,
  ZoomIn,
  ZoomOut,
  Link2,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceFrame } from "@/components/testing/device-frame";
import { PreviewPane } from "@/components/testing/preview-pane";
import {
  DEFAULT_DEVICES,
  DEVICE_PRESETS,
  RESPONSIVE_BREAKPOINTS,
  getDeviceById,
  type DevicePreset,
} from "@/lib/devices/presets";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api/client";

type AnalyzerIssue = {
  status: "PASS" | "FAIL" | "WARNING" | "INFO";
  viewport: number;
  selector: string;
  description: string;
  suggestion: string;
};

type ViewportResult = {
  width: number;
  height: number;
  issues: AnalyzerIssue[];
  summary: Record<string, number>;
};

export default function ResponsiveTesterPage() {
  const [urlInput, setUrlInput] = useState("https://example.com");
  const [activeUrl, setActiveUrl] = useState("");
  const [deviceIds, setDeviceIds] = useState<string[]>(DEFAULT_DEVICES.slice(0, 4));
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [zoom, setZoom] = useState(0.35);
  const [syncScroll, setSyncScroll] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deviceQuery, setDeviceQuery] = useState("");
  const [customW, setCustomW] = useState(390);
  const [customH, setCustomH] = useState(844);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<ViewportResult[] | null>(null);
  const [shots, setShots] = useState<Record<string, string>>({});
  const [capturing, setCapturing] = useState(false);
  const [panel, setPanel] = useState<"devices" | "results" | "inspect">("devices");
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);

  const devices = useMemo(
    () =>
      deviceIds
        .map((id) => {
          if (id.startsWith("custom:")) {
            const [, w, h] = id.split(":");
            return {
              id,
              name: `Custom ${w}×${h}`,
              brand: "Custom" as const,
              category: "phone" as const,
              width: Number(w),
              height: Number(h),
              dpr: 1,
            } satisfies DevicePreset;
          }
          return getDeviceById(id);
        })
        .filter(Boolean) as DevicePreset[],
    [deviceIds]
  );

  const library = useMemo(() => {
    const q = deviceQuery.toLowerCase();
    return DEVICE_PRESETS.filter(
      (d) =>
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.brand.toLowerCase().includes(q) ||
        d.id.includes(q)
    ).slice(0, 40);
  }, [deviceQuery]);

  const launch = () => {
    let value = urlInput.trim();
    if (!value) return toast.error("Enter a URL");
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    setActiveUrl(value);
    setResults(null);
    setShots({});
    setRefreshKey((k) => k + 1);
    toast.success("Workspace launched");
  };

  const addDevice = (id: string) => {
    setDeviceIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const removeDevice = (id: string) => {
    setDeviceIds((prev) => prev.filter((x) => x !== id));
  };

  const addCustom = () => {
    if (customW < 200 || customH < 200) {
      toast.error("Minimum viewport is 200×200");
      return;
    }
    addDevice(`custom:${customW}:${customH}`);
  };

  const runAnalyzer = async () => {
    if (!activeUrl) return toast.error("Launch a URL first");
    setAnalyzing(true);
    setPanel("results");
    try {
      const res = await apiFetch<{ results: ViewportResult[] }>("/api/analyze/responsive", {
        method: "POST",
        body: JSON.stringify({
          url: activeUrl,
          widths: [...RESPONSIVE_BREAKPOINTS],
        }),
      });
      if (!res.ok) throw new Error(res.error);
      setResults(res.data.results);
      toast.success("Responsive analysis complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const captureAll = async () => {
    if (!activeUrl) return toast.error("Launch a URL first");
    setCapturing(true);
    try {
      const next: Record<string, string> = {};
      for (const d of devices) {
        const w = orientation === "portrait" ? d.width : d.height;
        const h = orientation === "portrait" ? d.height : d.width;
        const res = await apiFetch<{ imageBase64: string; browserVersion?: string }>(
          "/api/screenshot",
          {
            method: "POST",
            body: JSON.stringify({
              url: activeUrl,
              width: w,
              height: h,
              dpr: d.dpr,
              deviceId: d.id.startsWith("custom:") ? undefined : d.id,
              engine: "chromium",
            }),
          }
        );
        if (!res.ok) throw new Error(res.error);
        next[d.id] = res.data.imageBase64;
      }
      setShots(next);
      toast.success("Screenshots captured via Playwright");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Screenshot failed");
    } finally {
      setCapturing(false);
    }
  };

  const retestViewport = useCallback(
    async (width: number) => {
      if (!activeUrl) return;
      try {
        const res = await apiFetch<{ results: ViewportResult[] }>("/api/analyze/responsive", {
          method: "POST",
          body: JSON.stringify({ url: activeUrl, widths: [width] }),
        });
        if (!res.ok) throw new Error(res.error);
        setResults((prev) => {
          if (!prev) return res.data.results;
          const others = prev.filter((r) => r.width !== width);
          return [...others, ...res.data.results].sort((a, b) => a.width - b.width);
        });
        toast.success(`Retested ${width}px`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Retest failed");
      }
    },
    [activeUrl]
  );

  const fullscreenDevice = fullscreenId
    ? devices.find((d) => d.id === fullscreenId)
    : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Responsive Tester"
        description="Multi-device CSS viewport workspace with iframe previews when allowed, Playwright screenshots, and breakpoint analysis."
      />

      {/* URL bar */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
              className="pl-9"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && launch()}
              placeholder="https://example.com"
              aria-label="Website URL"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={launch}>
              <Play className="h-4 w-4" />
              Launch
            </Button>
            <Button
              variant="outline"
              disabled={!activeUrl}
              onClick={() => setRefreshKey((k) => k + 1)}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            {activeUrl && (
              <a href={activeUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline">
                  <ExternalLink className="h-4 w-4" />
                  Open
                </Button>
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setZoom((z) => Math.max(0.15, Number((z - 0.05).toFixed(2))))}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-[var(--muted-foreground)]">{Math.round(zoom * 100)}%</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setZoom((z) => Math.min(1, Number((z + 0.05).toFixed(2))))}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setOrientation((o) => (o === "portrait" ? "landscape" : "portrait"))
          }
        >
          <RotateCw className="h-3.5 w-3.5" />
          {orientation}
        </Button>
        <Button
          size="sm"
          variant={syncScroll ? "default" : "outline"}
          onClick={() => setSyncScroll((s) => !s)}
        >
          Sync scroll {syncScroll ? "on" : "off"}
        </Button>
        <Button size="sm" variant="outline" disabled={!activeUrl || capturing} onClick={captureAll}>
          <Camera className="h-3.5 w-3.5" />
          {capturing ? "Capturing…" : "Screenshot all"}
        </Button>
        <Button size="sm" disabled={!activeUrl || analyzing} onClick={runAnalyzer}>
          {analyzing ? "Analyzing…" : "Run responsive analyzer"}
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr_320px]">
        {/* Device library */}
        <Card className="h-fit xl:sticky xl:top-20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Device toolbar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <Input
                className="h-8 pl-8 text-xs"
                placeholder="Search devices…"
                value={deviceQuery}
                onChange={(e) => setDeviceQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-1">
              <Input
                type="number"
                className="h-8 text-xs"
                value={customW}
                onChange={(e) => setCustomW(Number(e.target.value))}
                aria-label="Custom width"
              />
              <Input
                type="number"
                className="h-8 text-xs"
                value={customH}
                onChange={(e) => setCustomH(Number(e.target.value))}
                aria-label="Custom height"
              />
              <Button size="sm" variant="outline" onClick={addCustom}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="max-h-[420px] space-y-1 overflow-y-auto">
              {library.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => addDevice(d.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-[var(--accent)]",
                    deviceIds.includes(d.id) && "bg-[var(--accent)]"
                  )}
                >
                  <span className="truncate font-medium">{d.name}</span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    {d.width}×{d.height}
                    {d.estimated ? "*" : ""}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[var(--muted-foreground)]">
              * Estimated CSS viewport. Active: {devices.length}
            </p>
          </CardContent>
        </Card>

        {/* Preview area */}
        <div className="min-w-0 space-y-3">
          {!activeUrl ? (
            <Card>
              <CardContent className="flex min-h-[360px] flex-col items-center justify-center gap-2 p-8 text-center">
                <p className="text-sm font-medium">Enter a public URL and launch</p>
                <p className="max-w-md text-xs text-[var(--muted-foreground)]">
                  Previews use sandboxed iframes when the site allows embedding. Sites that set
                  X-Frame-Options or restrictive CSP are never faked — use Playwright screenshots
                  instead.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex gap-6 overflow-x-auto pb-4">
              {devices.map((d) => {
                const w = orientation === "portrait" ? d.width : d.height;
                const h = orientation === "portrait" ? d.height : d.width;
                return (
                  <div key={d.id} className="relative shrink-0">
                    <div className="absolute right-0 top-0 z-10 flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setFullscreenId(d.id)}
                        aria-label="Fullscreen"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => removeDevice(d.id)}
                        aria-label="Remove device"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <DeviceFrame device={d} scale={zoom} orientation={orientation}>
                      {shots[d.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`data:image/png;base64,${shots[d.id]}`}
                          alt={`${d.name} screenshot`}
                          width={w}
                          height={h}
                          className="block"
                        />
                      ) : (
                        <PreviewPane
                          url={activeUrl}
                          width={w}
                          height={h}
                          syncScroll={syncScroll}
                          scrollTop={scrollTop}
                          onScroll={setScrollTop}
                          refreshKey={refreshKey}
                        />
                      )}
                    </DeviceFrame>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Side panel */}
        <Card className="h-fit xl:sticky xl:top-20">
          <CardHeader className="space-y-2 pb-2">
            <div className="flex gap-1">
              {(["devices", "results", "inspect"] as const).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={panel === p ? "default" : "ghost"}
                  onClick={() => setPanel(p)}
                >
                  {p}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="max-h-[560px] space-y-3 overflow-y-auto text-sm">
            {panel === "devices" && (
              <ul className="space-y-2">
                {devices.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-md border border-[var(--border)] p-2 text-xs"
                  >
                    <div className="font-medium">{d.name}</div>
                    <div className="text-[var(--muted-foreground)]">
                      CSS {d.width}×{d.height} · DPR {d.dpr}
                      {d.physicalWidth
                        ? ` · Physical ${d.physicalWidth}×${d.physicalHeight}`
                        : ""}
                    </div>
                    {d.estimated && <Badge variant="warning">Estimated</Badge>}
                  </li>
                ))}
              </ul>
            )}
            {panel === "results" && (
              <div className="space-y-3">
                {!results && (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Run the responsive analyzer to inspect overflow, clipping, nav, forms, and
                    layout issues across breakpoints.
                  </p>
                )}
                {results?.map((r) => (
                  <div key={r.width} className="rounded-md border border-[var(--border)] p-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-semibold">{r.width}px</span>
                      <Button size="sm" variant="ghost" onClick={() => retestViewport(r.width)}>
                        Retest
                      </Button>
                    </div>
                    <div className="mb-2 flex flex-wrap gap-1">
                      {Object.entries(r.summary).map(([k, v]) => (
                        <Badge
                          key={k}
                          variant={
                            k === "FAIL"
                              ? "danger"
                              : k === "WARNING"
                                ? "warning"
                                : k === "PASS"
                                  ? "success"
                                  : "info"
                          }
                        >
                          {k} {v}
                        </Badge>
                      ))}
                    </div>
                    <ul className="space-y-2">
                      {r.issues
                        .filter((i) => i.status !== "PASS")
                        .slice(0, 8)
                        .map((issue, idx) => (
                          <li key={idx} className="text-[11px]">
                            <Badge
                              variant={
                                issue.status === "FAIL"
                                  ? "danger"
                                  : issue.status === "WARNING"
                                    ? "warning"
                                    : "info"
                              }
                            >
                              {issue.status}
                            </Badge>{" "}
                            <span className="font-mono">{issue.selector}</span>
                            <div>{issue.description}</div>
                            <div className="text-[var(--muted-foreground)]">
                              {issue.suggestion}
                            </div>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            {panel === "inspect" && (
              <div className="space-y-2 text-xs text-[var(--muted-foreground)]">
                <p>
                  <strong className="text-[var(--foreground)]">Active URL:</strong>{" "}
                  {activeUrl || "—"}
                </p>
                <p>
                  Iframe previews use sandbox permissions for scripts/forms. Screenshots use
                  Playwright Chromium with the device CSS viewport — not claimed as real Safari
                  or device hardware.
                </p>
                <p>
                  Prefer screenshots when sites block embedding. Analyzer results include CSS
                  selector hints and remediation suggestions.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {fullscreenDevice && activeUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-full overflow-auto rounded-xl bg-[var(--card)] p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">{fullscreenDevice.name}</span>
              <Button size="sm" variant="outline" onClick={() => setFullscreenId(null)}>
                Close
              </Button>
            </div>
            <DeviceFrame device={fullscreenDevice} scale={0.7} orientation={orientation}>
              <PreviewPane
                url={activeUrl}
                width={
                  orientation === "portrait"
                    ? fullscreenDevice.width
                    : fullscreenDevice.height
                }
                height={
                  orientation === "portrait"
                    ? fullscreenDevice.height
                    : fullscreenDevice.width
                }
                refreshKey={refreshKey}
              />
            </DeviceFrame>
          </div>
        </div>
      )}
    </div>
  );
}
