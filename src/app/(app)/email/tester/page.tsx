"use client";

import { useMemo, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
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
import { downloadBlob } from "@/lib/utils";

type EmailIssue = {
  id: string;
  severity: string;
  category: string;
  message: string;
  suggestion?: string;
};

type EmailAnalysis = {
  issues: EmailIssue[];
  stats: {
    imageCount: number;
    linkCount: number;
    tableCount: number;
    hasDoctype: boolean;
    hasViewportMeta: boolean;
    approxHtmlBytes: number;
    maxWidthHint: number | null;
  };
  unsupportedCss: string[];
  simulatedNote: string;
  sanitizedHtml?: string;
};

type AnalyzeResponse = {
  analysis?: EmailAnalysis;
  sanitizedHtml?: string;
  issues?: EmailIssue[];
  stats?: EmailAnalysis["stats"];
  unsupportedCss?: string[];
  simulatedNote?: string;
};

export default function EmailTesterPage() {
  const [html, setHtml] = useState("");
  const [sanitized, setSanitized] = useState("");
  const [analysis, setAnalysis] = useState<EmailAnalysis | null>(null);
  const [profileId, setProfileId] = useState<string>(EMAIL_CLIENT_PROFILES[0].id);
  const [darkPreview, setDarkPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = EMAIL_CLIENT_PROFILES.find((p) => p.id === profileId) ?? EMAIL_CLIENT_PROFILES[0];

  const previewHtml = useMemo(() => {
    const body = sanitized || html;
    if (!body) return "";
    if (!darkPreview) return body;
    return `<div style="background:#111;color:#f5f5f5;min-height:100%;padding:8px">${body}</div>`;
  }, [sanitized, html, darkPreview]);

  async function analyze() {
    if (!html.trim()) {
      toast.error("Paste or upload HTML first");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await apiFetch<AnalyzeResponse | EmailAnalysis>("/api/email/analyze", {
      method: "POST",
      body: JSON.stringify({ html }),
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }

    const data = res.data as AnalyzeResponse;
    const nextAnalysis: EmailAnalysis = data.analysis ?? {
      issues: data.issues ?? [],
      stats: data.stats ?? {
        imageCount: 0,
        linkCount: 0,
        tableCount: 0,
        hasDoctype: false,
        hasViewportMeta: false,
        approxHtmlBytes: html.length,
        maxWidthHint: null,
      },
      unsupportedCss: data.unsupportedCss ?? [],
      simulatedNote: data.simulatedNote ?? "Client profiles are simulated viewports.",
      sanitizedHtml: data.sanitizedHtml,
    };

    const clean = data.sanitizedHtml ?? nextAnalysis.sanitizedHtml ?? html;
    setSanitized(clean);
    setAnalysis(nextAnalysis);
    toast.success("Email analyzed");
  }

  function onUpload(file: File | null) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large (max 2MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setHtml(String(reader.result || ""));
      setSanitized("");
      setAnalysis(null);
    };
    reader.readAsText(file);
  }

  function downloadHtml() {
    const content = sanitized || html;
    if (!content) return;
    downloadBlob(new Blob([content], { type: "text/html;charset=utf-8" }), "email-preview.html");
  }

  return (
    <div>
      <PageHeader
        title="HTML Email Tester"
        description="Paste or upload email HTML. Preview runs in a sandboxed iframe without scripts. Client profiles are simulated widths only."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Source HTML</CardTitle>
            <CardDescription>Scripts are never executed in the preview iframe.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              placeholder="<!DOCTYPE html>..."
              className="min-h-[280px] font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm hover:bg-[var(--accent)]">
                <Upload className="h-4 w-4" />
                Upload HTML
                <input
                  type="file"
                  accept=".html,.htm,text/html"
                  className="hidden"
                  onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
                />
              </label>
              <Button onClick={analyze} disabled={loading || !html.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Analyze
              </Button>
              <Button variant="outline" onClick={downloadHtml} disabled={!html && !sanitized}>
                <Download className="h-4 w-4" />
                Download HTML
              </Button>
            </div>
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Preview</CardTitle>
                <CardDescription>sandbox without allow-scripts</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={profileId}
                  onChange={(e) => setProfileId(e.target.value)}
                  className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-sm"
                >
                  {EMAIL_CLIENT_PROFILES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (simulated)
                    </option>
                  ))}
                </select>
                <Button
                  variant={darkPreview ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDarkPreview((v) => !v)}
                >
                  {darkPreview ? "Dark preview on" : "Dark preview"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="warning">Simulated client</Badge>
              <span className="text-xs text-[var(--muted-foreground)]">
                {profile.width}×{profile.height} · {profile.notes}
              </span>
            </div>
            {previewHtml ? (
              <div className="overflow-auto rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-3">
                <iframe
                  title="Email preview"
                  srcDoc={previewHtml}
                  sandbox="allow-same-origin"
                  className="mx-auto block bg-white"
                  style={{ width: profile.width, height: Math.min(profile.height, 720), maxWidth: "100%" }}
                />
              </div>
            ) : (
              <EmptyState title="No HTML yet" description="Paste email HTML to preview safely." />
            )}
          </CardContent>
        </Card>
      </div>

      {analysis ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Analysis</CardTitle>
            <CardDescription>{analysis.simulatedNote}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <span>Images: {analysis.stats.imageCount}</span>
              <span>Links: {analysis.stats.linkCount}</span>
              <span>Tables: {analysis.stats.tableCount}</span>
              <span>~{analysis.stats.approxHtmlBytes} bytes</span>
            </div>
            {analysis.unsupportedCss.length ? (
              <div>
                <p className="mb-2 text-sm font-medium">Possibly unsupported CSS</p>
                <div className="flex flex-wrap gap-1">
                  {analysis.unsupportedCss.map((c) => (
                    <Badge key={c} variant="outline">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            <ul className="divide-y divide-[var(--border)]">
              {analysis.issues.map((issue) => (
                <li key={issue.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <StatusBadge status={issue.severity} />
                      <span className="text-xs text-[var(--muted-foreground)]">{issue.category}</span>
                    </div>
                    <p className="text-sm">{issue.message}</p>
                    {issue.suggestion ? (
                      <p className="text-xs text-[var(--muted-foreground)]">{issue.suggestion}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
