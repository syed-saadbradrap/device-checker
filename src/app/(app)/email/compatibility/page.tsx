"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EMAIL_CLIENT_PROFILES } from "@/lib/email/sanitize";
import { apiFetch } from "@/lib/api/client";

type EmailIssue = {
  id: string;
  severity: string;
  category: string;
  message: string;
  suggestion?: string;
};

type AnalyzePayload = {
  analysis?: {
    issues: EmailIssue[];
    unsupportedCss: string[];
    simulatedNote: string;
    stats: Record<string, unknown>;
  };
  issues?: EmailIssue[];
  unsupportedCss?: string[];
  simulatedNote?: string;
};

export default function EmailCompatibilityPage() {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<EmailIssue[]>([]);
  const [unsupportedCss, setUnsupportedCss] = useState<string[]>([]);
  const [note, setNote] = useState("");

  async function analyze() {
    if (!html.trim()) {
      toast.error("Paste HTML first");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await apiFetch<AnalyzePayload>("/api/email/analyze", {
      method: "POST",
      body: JSON.stringify({ html }),
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    const data = res.data;
    setIssues(data.analysis?.issues ?? data.issues ?? []);
    setUnsupportedCss(data.analysis?.unsupportedCss ?? data.unsupportedCss ?? []);
    setNote(
      data.analysis?.simulatedNote ??
        data.simulatedNote ??
        "Compatibility guidance is heuristic; client rows below are simulated profiles."
    );
    toast.success("Compatibility report ready");
  }

  return (
    <div>
      <PageHeader
        title="Email Compatibility"
        description="Heuristic HTML/CSS checks plus a simulated client profile matrix. Not live Outlook/Gmail rendering."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Analyze HTML</CardTitle>
          <CardDescription>Uses /api/email/analyze — no JavaScript execution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder="Paste email HTML…"
            className="min-h-[160px] font-mono text-xs"
          />
          <Button onClick={analyze} disabled={loading || !html.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Run compatibility report
          </Button>
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Simulated client profiles</CardTitle>
          <CardDescription>
            Viewport widths used for preview only — not real email rendering engines.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
              <tr>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Width</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {EMAIL_CLIENT_PROFILES.map((p) => (
                <tr key={p.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-5 py-3 font-medium">{p.name}</td>
                  <td className="px-5 py-3 tabular-nums">
                    {p.width}×{p.height}
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant="warning">Simulated</Badge>
                  </td>
                  <td className="px-5 py-3 text-[var(--muted-foreground)]">{p.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {!issues.length && !unsupportedCss.length ? (
        <EmptyState
          title="No report yet"
          description="Run analysis to list HTML/CSS compatibility findings."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Findings</CardTitle>
            <CardDescription>{note}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {unsupportedCss.length ? (
              <div className="flex flex-wrap gap-1">
                {unsupportedCss.map((c) => (
                  <Badge key={c} variant="outline">
                    {c}
                  </Badge>
                ))}
              </div>
            ) : null}
            <ul className="divide-y divide-[var(--border)]">
              {issues.map((issue) => (
                <li key={issue.id} className="py-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <StatusBadge status={issue.severity} />
                    <span className="text-xs text-[var(--muted-foreground)]">{issue.category}</span>
                  </div>
                  <p className="text-sm">{issue.message}</p>
                  {issue.suggestion ? (
                    <p className="text-xs text-[var(--muted-foreground)]">{issue.suggestion}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
