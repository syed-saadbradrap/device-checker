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
    toast.success("Onboarding reset — reload to see the welcome dialog");
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Appearance preferences and read-only environment / security notes."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Theme</CardTitle>
            <CardDescription>Controlled via next-themes (class on html).</CardDescription>
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
            <CardTitle>Onboarding</CardTitle>
            <CardDescription>Clears the localStorage flag used by the welcome modal.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={resetOnboarding}>
              Reset onboarding
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Environment notes</CardTitle>
            <CardDescription>Read-only — configure these in your deployment, not here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--muted-foreground)]">
            <p>
              <code className="text-xs">DATABASE_URL</code> — Prisma SQLite (or configured DB) connection.
            </p>
            <p>
              <code className="text-xs">NEXT_PUBLIC_APP_URL</code> — public origin for absolute links.
            </p>
            <p>
              <code className="text-xs">PLAYWRIGHT_TIMEOUT_MS</code> — navigation timeout for captures.
            </p>
            <p>
              <code className="text-xs">SCREENSHOT_DIR</code> — filesystem directory for saved PNGs.
            </p>
            <p>Playwright browsers must be installed on the host for capture and Lighthouse routes.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security notes</CardTitle>
            <CardDescription>Read-only operational guidance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--muted-foreground)]">
            <p>Outbound fetches validate public URLs and block private / link-local targets.</p>
            <p>Mutation APIs are rate-limited per client key.</p>
            <p>
              Email previews use sanitized HTML in iframes with{" "}
              <code className="text-xs">sandbox</code> and without <code className="text-xs">allow-scripts</code>.
            </p>
            <p>
              Browser / theme labels refer to Playwright Chromium, Firefox, and WebKit engines — not
              branded Safari or Chrome builds.
            </p>
            <p>Email client profiles are simulated viewport widths, not live client rendering.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
