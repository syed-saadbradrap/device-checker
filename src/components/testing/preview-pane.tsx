"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ProbeState =
  | { status: "idle" | "loading" }
  | { status: "blocked"; reason: string }
  | { status: "ok" };

export function PreviewPane({
  url,
  width,
  height,
  syncScroll,
  scrollTop,
  refreshKey,
}: {
  url: string;
  width: number;
  height: number;
  syncScroll?: boolean;
  scrollTop?: number;
  onScroll?: (top: number) => void;
  refreshKey?: number;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [probe, setProbe] = useState<ProbeState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/validate-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (!json.ok) {
          setProbe({ status: "blocked", reason: json.error || "URL validation failed" });
          return;
        }
        const embedding = json.data?.embedding;
        if (embedding && embedding.allowed === false) {
          setProbe({
            status: "blocked",
            reason:
              embedding.reason ||
              "This website blocks iframe embedding (X-Frame-Options or CSP).",
          });
          return;
        }
        setProbe({ status: "ok" });
      } catch {
        if (!cancelled) {
          setProbe({ status: "blocked", reason: "Could not validate URL for preview." });
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [url, refreshKey]);

  useEffect(() => {
    if (!syncScroll || scrollTop == null || !iframeRef.current) return;
    try {
      iframeRef.current.contentWindow?.scrollTo({ top: scrollTop });
    } catch {
      /* cross-origin */
    }
  }, [scrollTop, syncScroll]);

  if (probe.status === "blocked") {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[var(--muted)] p-4 text-center"
        style={{ width, height }}
      >
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-xs font-medium">Iframe preview unavailable</p>
        <p className="max-w-[240px] text-[11px] text-[var(--muted-foreground)]">{probe.reason}</p>
        <p className="max-w-[260px] text-[11px] text-[var(--muted-foreground)]">
          Use Playwright screenshot capture or Browser Tester for a real rendered result.
          DeviceLab never pretends a blocked iframe is rendering.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Badge variant="warning">X-Frame / CSP</Badge>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">
              <ExternalLink className="h-3 w-3" />
              Open tab
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ width, height }}>
      {probe.status !== "ok" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--muted)] text-xs text-[var(--muted-foreground)]">
          <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
          Checking embed…
        </div>
      )}
      {probe.status === "ok" && (
        <iframe
          key={`${url}-${refreshKey}`}
          ref={iframeRef}
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
