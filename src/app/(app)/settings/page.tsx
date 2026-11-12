"use client";

import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  function resetOnboarding() {
    localStorage.removeItem("devicelab-onboarded");
    window.dispatchEvent(new Event("storage"));
    toast.success("Welcome guide will show again");
  }

  return (
    <div>
      <PageHeader title="Settings" description="A few basics for DeviceLab." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>DeviceLab uses a light interface only.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--muted-foreground)]">
              Dark mode has been removed from the app UI so the layout stays clear and consistent.
            </p>
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
            <p>
              Only public websites can be tested — localhost and private network addresses are blocked
              for safety.
            </p>
            <p>
              Screenshots and audits run in real Playwright browsers (Chromium, Firefox, WebKit
              engines), not branded Chrome or Safari builds.
            </p>
            <p>
              Email client previews are simulated widths, not the real Gmail/Outlook/Apple Mail
              engines. Email “Dark preview” only affects the template preview, not the app chrome.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
