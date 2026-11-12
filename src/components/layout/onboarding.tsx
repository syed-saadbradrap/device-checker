"use client";

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { Camera, Gauge, Mail, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const KEY = "devicelab-onboarded";

const FEATURES = [
  { icon: Smartphone, title: "Test Website", text: "Paste a URL and see it on phone, tablet and laptop." },
  { icon: Mail, title: "Test Email", text: "Paste email HTML, preview it and find problems." },
  { icon: Gauge, title: "Website Audit", text: "Check speed, accessibility and SEO in one place." },
  { icon: Camera, title: "Screenshots", text: "Real browser screenshots, plus before/after compare." },
];

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
            Check how your website or email looks and performs. Here&apos;s everything you can do:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--secondary)]">
                  <f.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{f.title}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[var(--muted-foreground)]">
            Tip: press Ctrl+K (⌘K on Mac) to jump anywhere.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/testing/responsive" onClick={dismiss}>
              <Button>
                <Smartphone className="h-4 w-4" />
                Test a website now
              </Button>
            </Link>
            <Button variant="outline" onClick={dismiss}>
              Look around first
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
