"use client";

import { use, useMemo, useState } from "react";
import {
  ExternalLink,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  ScanSearch,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { normalizeUrl } from "@/components/shared/url-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceFrame } from "@/components/testing/device-frame";
import { PreviewPane } from "@/components/testing/preview-pane";
import { DEVICE_PRESETS, getDeviceById, type DevicePreset } from "@/lib/devices/presets";
import { apiFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";

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


const STARTER_DEVICES = ["iphone-18-pro", "iphone-duo", "ipad-pro-11-2024", "macbook-air-13"];
const EXAMPLE_SITES = ["example.com", "wikipedia.org", "nextjs.org"];

function resolveDevice(id: string): DevicePreset | undefined {
  if (id.startsWith("custom:")) {
    const [, w, h] = id.split(":");
    return {
      id,
      name: `Custom ${w}×${h}`,
      brand: "Custom",
      category: "phone",
      width: Number(w),
      height: Number(h),
      dpr: 1,
    } as DevicePreset;
  }
  return getDeviceById(id);
}

function initialDevices(param: string | string[] | undefined): string[] {
  const raw = Array.isArray(param) ? param.join(",") : param;
  const ids = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((id) => /^custom:\d{3,4}:\d{3,4}$/.test(id) || getDeviceById(id));
  return ids.length ? ids : STARTER_DEVICES;
}

export default function ResponsiveTesterPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = use(searchParams);
  const urlParam = typeof params.url === "string" ? normalizeUrl(params.url) : "";

  const [urlInput, setUrlInput] = useState(urlParam);
  const [activeUrl, setActiveUrl] = useState(urlParam);
  const [deviceIds, setDeviceIds] = useState<string[]>(() => initialDevices(params.device));
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [zoom, setZoom] = useState(0.4);
  const [refreshKey, setRefreshKey] = useState(0);
  const [runScripts, setRunScripts] = useState(true); // Interactive: menus, popups, maps need site JS
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deviceQuery, setDeviceQuery] = useState("");
  const [customW, setCustomW] = useState(390);
  const [customH, setCustomH] = useState(844);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<ViewportResult[] | null>(null);

  const devices = useMemo(
    () => deviceIds.map(resolveDevice).filter(Boolean) as DevicePreset[],
    [deviceIds]
  );

  const library = useMemo(() => {
    const q = deviceQuery.toLowerCase().trim();
    return DEVICE_PRESETS.filter(
      (d) =>
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.brand.toLowerCase().includes(q) ||
        d.category.includes(q)
    ).slice(0, 30);
  }, [deviceQuery]);

  const size = (d: DevicePreset) =>
    orientation === "portrait"
      ? { w: d.width, h: d.height }
      : { w: d.height, h: d.width };

  function launch(value = urlInput) {
    const next = normalizeUrl(value);
    if (!next) {
      toast.error("Type a website address first, e.g. example.com");
      return;
    }
    setUrlInput(next);
    setActiveUrl(next);
    setResults(null);
    setRefreshKey((k) => k + 1);
    toast.message("Live preview loaded — scroll inside each device");
  }

  function addDevice(id: string) {
    if (deviceIds.includes(id)) {
      toast.info("Already added");
      return;
    }
    if (deviceIds.length >= 6) {
      toast.error("Up to 6 devices at a time — remove one first");
      return;
    }
    setDeviceIds((prev) => [...prev, id]);
  }

  function removeDevice(id: string) {
    setDeviceIds((prev) => prev.filter((x) => x !== id));
  }

  function addCustom() {
    if (customW < 200 || customH < 200 || customW > 3840 || customH > 3840) {
      toast.error("Size must be between 200 and 3840 pixels");
      return;
    }
    addDevice(`custom:${customW}:${customH}`);
  }

  async function runAnalyzer() {
    if (!activeUrl) return;
    const widths = [...new Set(devices.map((d) => size(d).w))].sort((a, b) => a - b);
    if (widths.length === 0) {
      toast.error("Add at least one device first");
      return;
    }
    setAnalyzing(true);
    const res = await apiFetch<{ results: ViewportResult[] }>("/api/analyze/responsive", {
      method: "POST",
      body: JSON.stringify({ url: activeUrl, widths }),
    });
    setAnalyzing(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setResults(res.data.results);
    const problems = res.data.results.reduce(
      (n, r) => n + r.issues.filter((i) => i.status === "FAIL" || i.status === "WARNING").length,
      0
    );
    toast.success(problems ? `Found ${problems} thing${problems === 1 ? "" : "s"} to check` : "No layout problems found");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Test Website"
        description="Pick devices, Launch a URL, then scroll the live preview inside each frame to check responsive layout."
      />

      <Card>
        <CardContent className="p-4">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              launch();
            }}
          >
            <Input
              className="h-11 flex-1 text-base"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="example.com"
              inputMode="url"
              aria-label="Website URL"
            />
            <Button type="submit" size="lg" className="h-11">
              <Play className="h-4 w-4" />
              Launch
            </Button>
          </form>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            Works with any public website. Local addresses (localhost, 192.168.x.x) can&apos;t be tested.
          </p>
        </CardContent>
      </Card>

      {!activeUrl ? (
        <Card>
          <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-base font-medium">Start by typing a website above and pressing Launch</p>
            <p className="max-w-md text-sm text-[var(--muted-foreground)]">
              We&apos;ll show it on {devices.map((d) => d.name).join(", ")}. You can add or remove
              devices after launching.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="self-center text-xs text-[var(--muted-foreground)]">Try:</span>
              {EXAMPLE_SITES.map((site) => (
                <Button key={site} variant="outline" size="sm" onClick={() => launch(site)}>
                  {site}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">Live preview</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOrientation((o) => (o === "portrait" ? "landscape" : "portrait"))}
              >
                <RotateCw className="h-3.5 w-3.5" />
                {orientation === "portrait" ? "Rotate to landscape" : "Rotate to portrait"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                aria-label="Zoom out"
                onClick={() => setZoom((z) => Math.max(0.2, Number((z - 0.1).toFixed(2))))}
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="w-10 text-center text-xs tabular-nums text-[var(--muted-foreground)]">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                size="sm"
                variant="outline"
                aria-label="Zoom in"
                onClick={() => setZoom((z) => Math.min(1, Number((z + 0.1).toFixed(2))))}
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <div
                className="inline-flex overflow-hidden rounded-md border border-[var(--border)] text-xs"
                role="group"
                aria-label="Preview mode"
              >
                <button
                  type="button"
                  aria-pressed={!runScripts}
                  title="Most reliable: shows the full layout with all images, fonts and styles. Menus and sliders don't animate."
                  onClick={() => setRunScripts(false)}
                  className={cn(
                    "px-2.5 py-1.5 font-medium",
                    !runScripts ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "hover:bg-[var(--accent)]"
                  )}
                >
                  Visual
                </button>
                <button
                  type="button"
                  aria-pressed={runScripts}
                  title="Runs the site's JavaScript (menus, sliders, tabs). Some sites render blank or incomplete; we fall back to Visual automatically."
                  onClick={() => setRunScripts(true)}
                  className={cn(
                    "border-l border-[var(--border)] px-2.5 py-1.5 font-medium",
                    runScripts ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "hover:bg-[var(--accent)]"
                  )}
                >
                  Interactive
                </button>
              </div>
              <Button size="sm" variant="outline" onClick={() => setRefreshKey((k) => k + 1)}>
                <RefreshCw className="h-3.5 w-3.5" />
                Reload previews
              </Button>
              <a href={activeUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="ghost">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open site
                </Button>
              </a>
            </div>
          </div>

          <p className="text-xs text-[var(--muted-foreground)]">
            Default is <strong>Interactive</strong> — scroll, open menus/popups, and check maps inside
            each device. Switch to <strong>Visual</strong> only if a site goes blank (layout-only,
            no JS).
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {devices.map((d) => (
              <span
                key={d.id}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] py-1 pl-3 pr-1 text-xs"
              >
                {d.name}
                <button
                  type="button"
                  onClick={() => removeDevice(d.id)}
                  className="rounded-full p-0.5 hover:bg-[var(--accent)]"
                  aria-label={`Remove ${d.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <Button size="sm" variant={pickerOpen ? "default" : "outline"} onClick={() => setPickerOpen((v) => !v)}>
              <Plus className="h-3.5 w-3.5" />
              Add device
            </Button>
          </div>

          {pickerOpen ? (
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
                    <Input
                      className="pl-8"
                      placeholder="Search: iPhone, Galaxy, tablet, laptop…"
                      value={deviceQuery}
                      onChange={(e) => setDeviceQuery(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      className="w-20"
                      value={customW}
                      onChange={(e) => setCustomW(Number(e.target.value))}
                      aria-label="Custom width"
                    />
                    <span className="text-xs text-[var(--muted-foreground)]">×</span>
                    <Input
                      type="number"
                      className="w-20"
                      value={customH}
                      onChange={(e) => setCustomH(Number(e.target.value))}
                      aria-label="Custom height"
                    />
                    <Button variant="outline" onClick={addCustom}>
                      Add size
                    </Button>
                  </div>
                </div>
                <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                  {library.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => addDevice(d.id)}
                      className={cn(
                        "flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-[var(--accent)]",
                        deviceIds.includes(d.id) && "bg-[var(--accent)] font-medium"
                      )}
                    >
                      <span className="truncate">{d.name}</span>
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        {d.width}×{d.height}
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {devices.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-[var(--muted-foreground)]">
                No devices selected. Click “Add device” to pick one.
              </CardContent>
            </Card>
          ) : (
            <div className="flex gap-6 overflow-x-auto pb-4">
              {devices.map((d) => {
                const { w, h } = size(d);
                return (
                  <div key={`${d.id}:${orientation}:${refreshKey}`} className="flex shrink-0 flex-col items-center gap-1">
                    <Badge variant="info">Live · scroll inside</Badge>
                    <DeviceFrame device={d} scale={zoom} orientation={orientation}>
                      <PreviewPane
                        url={activeUrl}
                        width={w}
                        height={h}
                        refreshKey={refreshKey}
                        scripts={runScripts}
                      />
                    </DeviceFrame>
                  </div>
                );
              })}
            </div>
          )}

          <Card>
            <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Check for layout problems (optional)</CardTitle>
                <CardDescription>
                  Opens the page in a real browser at your selected device widths and looks for
                  sideways scrolling, cut-off content, tiny text and buttons that are hard to tap.
                </CardDescription>
              </div>
              <Button onClick={runAnalyzer} disabled={analyzing || devices.length === 0}>
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
                {analyzing ? "Checking…" : "Check layout"}
              </Button>
            </CardHeader>
            {results ? (
              <CardContent className="space-y-3">
                {results.map((r) => {
                  const problems = r.issues.filter((i) => i.status !== "PASS");
                  return (
                    <div key={r.width} className="rounded-md border border-[var(--border)] p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{r.width}px wide</span>
                        {Object.entries(r.summary).map(([k, v]) =>
                          v ? (
                            <Badge
                              key={k}
                              variant={
                                k === "FAIL" ? "danger" : k === "WARNING" ? "warning" : k === "PASS" ? "success" : "info"
                              }
                            >
                              {v} {k.toLowerCase()}
                            </Badge>
                          ) : null
                        )}
                      </div>
                      {problems.length === 0 ? (
                        <p className="text-xs text-[var(--muted-foreground)]">No problems at this width.</p>
                      ) : (
                        <ul className="space-y-2">
                          {problems.slice(0, 8).map((issue, idx) => (
                            <li key={idx} className="text-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  variant={
                                    issue.status === "FAIL" ? "danger" : issue.status === "WARNING" ? "warning" : "info"
                                  }
                                >
                                  {issue.status.toLowerCase()}
                                </Badge>
                                <span>{issue.description}</span>
                              </div>
                              {issue.selector ? (
                                <code className="mt-1 block truncate text-[11px] text-[var(--muted-foreground)]">
                                  {issue.selector}
                                </code>
                              ) : null}
                              {issue.suggestion ? (
                                <p className="text-[var(--muted-foreground)]">Tip: {issue.suggestion}</p>
                              ) : null}
                            </li>
                          ))}
                          {problems.length > 8 ? (
                            <li className="text-xs text-[var(--muted-foreground)]">
                              +{problems.length - 8} more
                            </li>
                          ) : null}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            ) : null}
          </Card>
        </>
      )}
    </div>
  );
}
