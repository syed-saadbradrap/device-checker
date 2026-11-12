"use client";

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const KEY = "devicelab-onboarded";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getOnboarded() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

export function Onboarding() {
  const onboarded = useSyncExternalStore(subscribe, getOnboarded, () => true);

  const dismiss = useCallback(() => {
    localStorage.setItem(KEY, "1");
    window.dispatchEvent(new Event("storage"));
  }, []);

  if (onboarded) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Welcome to DeviceLab</CardTitle>
          <CardDescription>
            Test any public website or email HTML across devices, browsers, themes, and audits —
            with real browser automation, not fake metrics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--muted-foreground)]">
            <li>Paste a URL in Responsive Tester to open a multi-device workspace.</li>
            <li>If a site blocks iframes, use Playwright screenshot / browser testing instead.</li>
            <li>Run Performance, Accessibility, and SEO audits for actionable reports.</li>
            <li>Press ⌘/Ctrl+K anytime for the command palette.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button onClick={dismiss}>Get started</Button>
            <Link
              href="/testing/responsive"
              className="inline-flex h-9 items-center rounded-md border border-[var(--border)] px-4 text-sm font-medium hover:bg-[var(--accent)]"
              onClick={dismiss}
            >
              Test a website
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
