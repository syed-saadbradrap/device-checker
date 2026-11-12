"use client";

import { useTheme } from "next-themes";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  function resetOnboarding() {
    localStorage.removeItem("devicelab-onboarded");
    window.dispatchEvent(new Event("storage"));
    toast.success("Welcome guide will show again");
  }

  return (
    <div>
      <PageHeader title="Settings" description="Appearance and a few basics." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Theme</CardTitle>
            <CardDescription>Choose light, dark, or follow your computer.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {[
              { id: "light", label: "Light" },
              { id: "dark", label: "Dark" },
              { id: "system", label: "System" },
            ].map((opt) => (
              <Button
                key={opt.id}
                variant={theme === opt.id ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme(opt.id)}
              >
                {opt.label}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Welcome guide</CardTitle>
            <CardDescription>Show the short intro again.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={resetOnboarding}>
              Show welcome guide
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Good to know</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--muted-foreground)]">
            <p>Only public websites can be tested — localhost and private network addresses are blocked for safety.</p>
            <p>Screenshots and audits run in real Playwright browsers (Chromium, Firefox, WebKit engines), not branded Chrome or Safari builds.</p>
            <p>Email client previews are simulated widths, not the real Gmail/Outlook/Apple Mail engines.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
