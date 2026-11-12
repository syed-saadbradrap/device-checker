"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EMAIL_CLIENT_PROFILES } from "@/lib/email/sanitize";

const WIDTHS = [320, 375, 414, 600, 680, 800] as const;

export default function EmailResponsivePage() {
  const [html, setHtml] = useState("");

  const profiles = useMemo(
    () =>
      WIDTHS.map((width) => {
        const match = EMAIL_CLIENT_PROFILES.find((p) => p.width === width);
        return {
          width,
          label: match ? `${match.name} · ${width}px` : `${width}px`,
          simulated: true,
        };
      }),
    []
  );

  return (
    <div>
      <PageHeader
        title="Email Responsive Preview"
        description="Multi-width iframe previews of pasted HTML. Client labels are simulated viewport widths — not real email engines."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>HTML source</CardTitle>
          <CardDescription>
            Preview iframes use <code className="text-xs">sandbox=&quot;allow-same-origin&quot;</code> without scripts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder="Paste email HTML…"
            className="min-h-[180px] font-mono text-xs"
          />
        </CardContent>
      </Card>

      {!html.trim() ? (
        <EmptyState title="Paste HTML to preview" description="Widths mirror common email content columns." />
      ) : (
        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-4 pb-2">
            {profiles.map((p) => (
              <div key={p.width} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <p className="text-sm font-medium">{p.label}</p>
                  <Badge variant="warning">Simulated</Badge>
                </div>
                <iframe
                  title={`Email ${p.width}`}
                  srcDoc={html}
                  sandbox="allow-same-origin"
                  className="block bg-white"
                  style={{ width: p.width, height: 640 }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
