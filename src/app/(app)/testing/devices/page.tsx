"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Play } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { UrlForm } from "@/components/shared/url-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DEVICE_PRESETS,
  DEFAULT_DEVICES,
  filterDevices,
  type DevicePreset,
} from "@/lib/devices/presets";
import { cn } from "@/lib/utils";

export default function DevicePreviewPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<string[]>(DEFAULT_DEVICES.slice(0, 3));
  const [previewUrl, setPreviewUrl] = useState("");
  const [activeUrl, setActiveUrl] = useState("");

  const devices = useMemo(
    () => filterDevices({ query, category }),
    [query, category]
  );

  const selectedDevices = useMemo(
    () =>
      selected
        .map((id) => DEVICE_PRESETS.find((d) => d.id === id))
        .filter(Boolean) as DevicePreset[],
    [selected]
  );

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 6)
    );
  }

  const workspaceHref =
    activeUrl && selected.length
      ? `/testing/responsive?url=${encodeURIComponent(activeUrl)}&devices=${selected.join(",")}`
      : "/testing/responsive";

  return (
    <div>
      <PageHeader
        title="Device Preview"
        description="Browse device presets and launch a multi-device workspace. Select up to 6 devices."
        actions={
          <Link
            href={workspaceHref}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs font-medium hover:bg-[var(--accent)]"
          >
            <ExternalLink className="h-4 w-4" />
            Open workspace
          </Link>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Launch preview</CardTitle>
          <CardDescription>
            Enter a public URL, then open the responsive workspace with your selected devices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <UrlForm
            defaultValue={previewUrl}
            submitLabel="Set URL"
            onSubmit={(url) => {
              setPreviewUrl(url);
              setActiveUrl(url);
            }}
          />
          {activeUrl ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-[var(--muted-foreground)]">Ready:</span>
              <code className="truncate rounded bg-[var(--secondary)] px-2 py-0.5 text-xs">
                {activeUrl}
              </code>
              <Link
                href={workspaceHref}
                className="inline-flex h-8 items-center gap-2 rounded-md bg-[var(--primary)] px-3 text-xs font-medium text-[var(--primary-foreground)] hover:opacity-90"
              >
                <Play className="h-3.5 w-3.5" />
                Launch
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Search devices…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
        >
          <option value="all">All categories</option>
          <option value="phone">Phone</option>
          <option value="tablet">Tablet</option>
          <option value="laptop">Laptop</option>
          <option value="desktop">Desktop</option>
          <option value="foldable">Foldable</option>
        </select>
        <p className="self-center text-xs text-[var(--muted-foreground)]">
          {selected.length} selected
        </p>
      </div>

      {selectedDevices.length > 0 && activeUrl ? (
        <div className="mb-6 overflow-x-auto">
          <div className="flex min-w-max gap-4 pb-2">
            {selectedDevices.map((d) => (
              <div key={d.id} className="device-frame p-3">
                <p className="mb-2 text-xs font-medium">
                  {d.name} · {d.width}×{d.height}
                </p>
                <iframe
                  title={d.name}
                  src={activeUrl}
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                  className="bg-white"
                  style={{ width: Math.min(d.width, 420), height: Math.min(d.height, 640) }}
                />
                <p className="mt-2 max-w-[420px] text-[10px] text-[var(--muted-foreground)]">
                  Some sites block iframes. Use Playwright screenshots if the frame is blank.
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {devices.map((d) => {
          const isOn = selected.includes(d.id);
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => toggle(d.id)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                isOn
                  ? "border-[var(--foreground)] bg-[var(--card)]"
                  : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--ring)]"
              )}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="font-medium">{d.name}</p>
                {isOn ? <Badge variant="info">Selected</Badge> : null}
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                {d.brand} · {d.category}
              </p>
              <p className="mt-2 text-sm tabular-nums">
                {d.width}×{d.height} @ {d.dpr}x
              </p>
              {d.estimated ? (
                <Badge variant="warning" className="mt-2">
                  Estimated
                </Badge>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
