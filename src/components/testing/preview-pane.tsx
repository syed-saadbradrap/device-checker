"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Camera, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

type ProbeState =
  | { status: "loading" }
  | { status: "blocked"; reason: string }
  | { status: "ok" };

type ValidateResponse = {
  embedding?: { allowed?: boolean; reason?: string };
};

const probeCache = new Map<string, Promise<ProbeState>>();

function probeEmbedding(url: string, refreshKey: number): Promise<ProbeState> {
  const key = `${refreshKey}::${url}`;
  const cached = probeCache.get(key);
  if (cached) return cached;
  const promise = apiFetch<ValidateResponse>("/api/validate-url", {
    method: "POST",
    body: JSON.stringify({ url }),
  }).then<ProbeState>((res) => {
    if (!res.ok) return { status: "blocked", reason: res.error };
    const embedding = res.data.embedding;
    if (embedding && embedding.allowed === false) {
      return {
        status: "blocked",
        reason:
          embedding.reason ||
          "This website blocks being shown inside other pages (X-Frame-Options or CSP).",
      };
    }
    return { status: "ok" };
  });
  probeCache.set(key, promise);
  if (probeCache.size > 50) {
    const oldest = probeCache.keys().next().value;
    if (oldest !== undefined) probeCache.delete(oldest);
  }
  return promise;
}

export function PreviewPane({
  url,
  width,
  height,
  refreshKey = 0,
  onUseScreenshots,
}: {
  url: string;
  width: number;
  height: number;
  refreshKey?: number;
  onUseScreenshots?: () => void;
}) {
  const [probe, setProbe] = useState<{ key: string; state: ProbeState } | null>(null);
  const key = `${refreshKey}::${url}`;

  useEffect(() => {
    let cancelled = false;
    void probeEmbedding(url, refreshKey).then((state) => {
      if (!cancelled) setProbe({ key, state });
    });
    return () => {
      cancelled = true;
    };
  }, [url, refreshKey, key]);

  const state: ProbeState = probe && probe.key === key ? probe.state : { status: "loading" };

  if (state.status === "blocked") {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[var(--muted)] p-6 text-center"
        style={{ width, height }}
      >
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <p className="text-base font-medium">Live preview not allowed by this site</p>
        <p className="max-w-[320px] text-sm text-[var(--muted-foreground)]">{state.reason}</p>
        <p className="max-w-[320px] text-sm text-[var(--muted-foreground)]">
          This is normal for many big sites. Use real browser screenshots instead — we never fake a
          preview.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {onUseScreenshots ? (
            <Button onClick={onUseScreenshots}>
              <Camera className="h-4 w-4" />
              Take screenshots
            </Button>
          ) : null}
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline">
              <ExternalLink className="h-4 w-4" />
              Open in new tab
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ width, height }}>
      {state.status === "loading" ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--muted)] text-sm text-[var(--muted-foreground)]">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          Loading preview…
        </div>
      ) : (
        <iframe
          key={key}
          src={url}
          title={`Preview ${width}x${height}`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          className="h-full w-full border-0 bg-white"
          style={{ width, height }}
        />
      )}
    </div>
  );
}
