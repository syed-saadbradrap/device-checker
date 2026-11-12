"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const LOAD_TIMEOUT_MS = 60000;
const SLOW_AFTER_MS = 6000;
// A proxied page pings as soon as it starts; if none arrived by this long after `load`, it escaped the proxy.
const RENDERED_GRACE_MS = 4000;

function FailPanel({
  width,
  height,
  reason,
  url,
  onRetry,
}: {
  width: number;
  height: number;
  reason: string;
  url: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 bg-[var(--muted)] p-6 text-center"
      style={{ width, height }}
    >
      <AlertTriangle className="h-10 w-10 text-amber-500" />
      <p className="text-base font-medium">Live preview failed</p>
      <p className="max-w-[320px] text-sm text-[var(--muted-foreground)]">{reason}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
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

/**
 * Live, scrollable preview of a site at an exact CSS viewport size (width x height).
 * The iframe itself is rendered at the real device size so media queries match; DeviceFrame scales it visually.
 *
 * `scripts` = run the site's JavaScript (sandboxed). If the site's scripts break out of the proxy
 * (e.g. framework routers redirecting to the real origin, which sites often forbid framing), we detect that
 * and transparently reload in static mode (scripts off), which always renders.
 */
export function PreviewPane({
  url,
  width,
  height,
  refreshKey = 0,
  scripts = true,
}: {
  url: string;
  width: number;
  height: number;
  refreshKey?: number;
  scripts?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  const [fallbackStatic, setFallbackStatic] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const renderedAtRef = useRef(0);
  const lastLoadAtRef = useRef(0);

  const live = scripts && !fallbackStatic;

  const proxySrc = useMemo(() => {
    const q = new URLSearchParams({
      url,
      width: String(width),
      height: String(height),
      scripts: live ? "1" : "0",
      r: `${refreshKey}.${attempt}`,
    });
    return `/api/preview-proxy?${q.toString()}`;
  }, [url, width, height, refreshKey, live, attempt]);

  // New site / reload / mode switch: reset state
  useEffect(() => {
    setFailed(false);
    setLoading(true);
    setSlow(false);
    renderedAtRef.current = 0;
    lastLoadAtRef.current = 0;
  }, [proxySrc]);

  // Reset the automatic fallback whenever the user asks for something new
  useEffect(() => {
    setFallbackStatic(false);
  }, [url, refreshKey, scripts]);

  // Handshake from the proxied page (live mode only)
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data as { devicelab?: string; state?: string; textLength?: number } | null;
      if (!data || data.devicelab !== "preview") return;
      if (data.state === "loaded" || data.state === "rendered") renderedAtRef.current = Date.now();
      if (data.state === "rendered") {
        // Only fall back if scripts wiped the page; don't yank Interactive for short/landing sections.
        if (typeof data.textLength === "number" && data.textLength < 8) setFallbackStatic(true);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Give up only if the frame never finishes loading (cleared as soon as it loads)
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setFailed(true), LOAD_TIMEOUT_MS);
    const slowTimer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(slowTimer);
    };
  }, [loading, proxySrc]);

  const handleLoad = useCallback(() => {
    setLoading(false);
    const loadedAt = Date.now();
    lastLoadAtRef.current = loadedAt;
    if (!live) return;
    // A proxied page pings from its own `load` event (also after in-frame navigation), i.e. at about the same
    // moment as this handler. No ping means the frame went somewhere else (site scripts redirecting to the
    // real origin, which usually forbids framing / 404s) or the page died.
    window.setTimeout(() => {
      if (renderedAtRef.current < loadedAt - 1000) setFallbackStatic(true);
    }, RENDERED_GRACE_MS);
  }, [live]);

  const retry = useCallback(() => {
    setFallbackStatic(false);
    setAttempt((n) => n + 1);
  }, []);

  if (failed) {
    return (
      <FailPanel
        width={width}
        height={height}
        url={url}
        onRetry={retry}
        reason="The site took too long to load or blocked our preview. Try again, or open it in a new tab."
      />
    );
  }

  return (
    <div className="relative overflow-hidden bg-white" style={{ width, height }}>
      {loading ? (
        // After a few seconds the page is usually already painted and only slow images are pending:
        // become a see-through corner badge so the user can scroll and inspect right away.
        slow ? (
          <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Still loading…
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[var(--muted)] text-sm text-[var(--muted-foreground)]">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Loading preview…
          </div>
        )
      ) : null}
      <iframe
        ref={iframeRef}
        key={proxySrc}
        src={proxySrc}
        title={`Live preview ${width}x${height}`}
        // No allow-same-origin: preview is same-origin as DeviceLab; combining it with allow-scripts
        // would let the remote page script the parent app. Menus/popups still run in the opaque origin.
        sandbox={
          live
            ? "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-presentation"
            : "allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
        }
        allow="fullscreen; geolocation; accelerometer; gyroscope; clipboard-write"
        referrerPolicy="strict-origin-when-cross-origin"
        className="block border-0 bg-white"
        style={{ width, height }}
        onLoad={handleLoad}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
