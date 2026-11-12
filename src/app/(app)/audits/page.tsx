"use client";

import { use, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { UrlForm } from "@/components/shared/url-form";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api/client";
import { cn, formatDate, formatScore, scoreColor } from "@/lib/utils";

type AuditKind = "performance" | "accessibility" | "seo";

type LighthouseItem = {
  id: string;
  title: string;
  description: string;
  score: number | null;
  displayValue?: string;
};

type PerformanceReport = {
  url: string;
  finalUrl: string;
  lighthouseVersion: string;
  scores: {
    performance: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    seo: number | null;
    fcp: number | null;
    lcp: number | null;
    cls: number | null;
    si: number | null;
    tbt: number | null;
    tti: number | null;
  };
  opportunities: LighthouseItem[];
  note?: string;
};

type A11yReport = {
  url: string;
  violations: Array<{
    id: string;
    impact: string | null;
    description: string;
    help: string;
    helpUrl: string;
    nodes: Array<{ html: string; target: string[]; failureSummary?: string }>;
  }>;
  passes: number;
  incomplete: number;
  engine: string;
  scannedAt: string;
};

type SeoCheck = {
  id: string;
  status: string;
  category: string;
  message: string;
  detail?: string;
  suggestion?: string;
};

type SeoReport = {
  url: string;
  finalUrl: string;
  title: string | null;
  checks: SeoCheck[];
  fetchedAt: string;
};

type Reports = {
  performance: PerformanceReport;
  accessibility: A11yReport;
  seo: SeoReport;
};

type AuditState<T> = { loading: boolean; error: string | null; report: T | null };

const TABS: { id: AuditKind; label: string; help: string; duration: string }[] = [
  {
    id: "performance",
    label: "Performance",
    help: "How fast the page loads (Google Lighthouse, desktop).",
    duration: "Takes 30–90 seconds.",
  },
  {
    id: "accessibility",
    label: "Accessibility",
    help: "Problems that make the page hard to use with a screen reader or keyboard (axe-core).",
    duration: "Takes 10–30 seconds.",
  },
  {
    id: "seo",
    label: "SEO & Links",
    help: "Title, description, headings, social tags, robots/sitemap and a sample of broken links.",
    duration: "Takes 5–20 seconds.",
  },
];

const ENDPOINTS: Record<AuditKind, string> = {
  performance: "/api/analyze/performance",
  accessibility: "/api/analyze/accessibility",
  seo: "/api/analyze/seo",
};

const EMPTY: AuditState<never> = { loading: false, error: null, report: null };

function isTab(value: unknown): value is AuditKind {
  return value === "performance" || value === "accessibility" || value === "seo";
}

export default function AuditsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = use(searchParams);
  const initialTab = isTab(params.tab) ? params.tab : "performance";
  const initialUrl = typeof params.url === "string" ? params.url : "";

  const [tab, setTab] = useState<AuditKind>(initialTab);
  const [lastUrl, setLastUrl] = useState("");
  const [state, setState] = useState<{ [K in AuditKind]: AuditState<Reports[K]> }>({
    performance: EMPTY,
    accessibility: EMPTY,
    seo: EMPTY,
  });

  const anyLoading = Object.values(state).some((s) => s.loading);

  async function runOne<K extends AuditKind>(kind: K, url: string) {
    setState((prev) => ({ ...prev, [kind]: { loading: true, error: null, report: null } }));
    const res = await apiFetch<Reports[K]>(ENDPOINTS[kind], {
      method: "POST",
      body: JSON.stringify({ url }),
    });
    const label = TABS.find((t) => t.id === kind)?.label ?? kind;
    if (!res.ok) {
      setState((prev) => ({ ...prev, [kind]: { loading: false, error: res.error, report: null } }));
      toast.error(`${label}: ${res.error}`);
      return;
    }
    setState((prev) => ({ ...prev, [kind]: { loading: false, error: null, report: res.data } }));
    toast.success(`${label} check finished`);
  }

  function runAll(url: string) {
    setLastUrl(url);
    void Promise.allSettled(TABS.map((t) => runOne(t.id, url)));
  }

  function runCurrent(url: string) {
    setLastUrl(url);
    void runOne(tab, url);
  }

  const current = TABS.find((t) => t.id === tab)!;

  function tabBadge(kind: AuditKind) {
    const s = state[kind];
    if (s.loading) return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    if (s.error) return <Badge variant="danger">!</Badge>;
    if (!s.report) return null;
    if (kind === "performance") {
      const score = (s.report as PerformanceReport).scores.performance;
      return score == null ? null : <Badge variant="outline">{formatScore(score)}</Badge>;
    }
    if (kind === "accessibility") {
      const n = (s.report as A11yReport).violations.length;
      return <Badge variant={n ? "warning" : "success"}>{n}</Badge>;
    }
    const failing = (s.report as SeoReport).checks.filter((c) => c.status !== "pass" && c.status !== "info").length;
    return <Badge variant={failing ? "warning" : "success"}>{failing}</Badge>;
  }

  return (
    <div>
      <PageHeader
        title="Website Audit"
        description="Enter a public URL once, then run all three checks or just the one you need."
      />

      <Card className="mb-6">
        <CardContent className="space-y-2 p-5">
          <UrlForm
            defaultValue={initialUrl}
            onSubmit={runAll}
            onSecondary={runCurrent}
            loading={anyLoading}
            submitLabel="Run all checks"
            secondaryLabel={`Run ${current.label} only`}
          />
          <p className="text-xs text-[var(--muted-foreground)]">
            Only public websites work (no localhost or private IPs). All results come from real scans.
          </p>
        </CardContent>
      </Card>

      <Tabs
        className="mb-2"
        value={tab}
        onChange={setTab}
        tabs={TABS.map((t) => ({ id: t.id, label: t.label, badge: tabBadge(t.id) }))}
      />
      <p className="mb-4 text-sm text-[var(--muted-foreground)]">
        {current.help} {current.duration}
      </p>

      <AuditPanel state={state[tab]} lastUrl={lastUrl} label={current.label}>
        {tab === "performance" && state.performance.report ? (
          <PerformanceView report={state.performance.report} />
        ) : null}
        {tab === "accessibility" && state.accessibility.report ? (
          <AccessibilityView report={state.accessibility.report} />
        ) : null}
        {tab === "seo" && state.seo.report ? <SeoView report={state.seo.report} /> : null}
      </AuditPanel>
    </div>
  );
}

function AuditPanel({
  state,
  lastUrl,
  label,
  children,
}: {
  state: AuditState<unknown>;
  lastUrl: string;
  label: string;
  children: React.ReactNode;
}) {
  if (state.loading) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Running {label} check on {lastUrl}…
        </p>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
        <p className="font-medium">{label} check failed</p>
        <p>{state.error}</p>
        <p className="mt-1 text-xs opacity-80">
          Check the URL is public and reachable, then try again.
        </p>
      </div>
    );
  }
  if (!state.report) {
    return (
      <EmptyState
        title={`No ${label} results yet`}
        description="Type a website above (for example example.com) and press “Run all checks”."
      />
    );
  }
  return <>{children}</>;
}

function PerformanceView({ report }: { report: PerformanceReport }) {
  const scoreCards = [
    { label: "Performance", value: report.scores.performance },
    { label: "Accessibility", value: report.scores.accessibility },
    { label: "Best Practices", value: report.scores.bestPractices },
    { label: "SEO", value: report.scores.seo },
  ];
  const metrics: Array<[string, string, number | null, string]> = [
    ["First Contentful Paint", "First text or image appears", report.scores.fcp, "ms"],
    ["Largest Contentful Paint", "Main content is visible", report.scores.lcp, "ms"],
    ["Cumulative Layout Shift", "How much the layout jumps (lower is better)", report.scores.cls, ""],
    ["Speed Index", "How quickly content fills the screen", report.scores.si, "ms"],
    ["Total Blocking Time", "Time the page can't respond to input", report.scores.tbt, "ms"],
    ["Time to Interactive", "Page is fully usable", report.scores.tti, "ms"],
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {scoreCards.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className={cn("text-3xl font-semibold tabular-nums", s.value != null && scoreColor(s.value))}>
                {formatScore(s.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">
        Scores are out of 100. 90+ is good, 50–89 needs work, below 50 is poor.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Key timings</CardTitle>
          <CardDescription>
            {report.finalUrl} · Lighthouse {report.lighthouseVersion}
            {report.note ? ` · ${report.note}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map(([label, help, value, unit]) => (
            <div key={label} className="rounded-md border border-[var(--border)] px-3 py-2">
              <p className="text-xs font-medium">{label}</p>
              <p className="text-[11px] text-[var(--muted-foreground)]">{help}</p>
              <p className="mt-1 font-semibold tabular-nums">
                {value == null
                  ? "—"
                  : unit
                    ? `${Math.round(value)}${unit}`
                    : value.toFixed(3)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How to make it faster</CardTitle>
          <CardDescription>Suggestions from this Lighthouse run</CardDescription>
        </CardHeader>
        <CardContent>
          {report.opportunities.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No suggestions returned — nice.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {report.opportunities.map((o) => (
                <li key={o.id} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{o.title}</p>
                    {o.displayValue ? (
                      <span className="text-xs text-[var(--muted-foreground)]">{o.displayValue}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{o.description}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AccessibilityView({ report }: { report: A11yReport }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Problems found", value: report.violations.length },
          { label: "Rules passed", value: report.passes },
          { label: "Need manual review", value: report.incomplete },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Problems to fix</CardTitle>
          <CardDescription>
            {report.engine} · {formatDate(report.scannedAt)} · {report.url}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report.violations.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              No automatic problems found. Automated tools catch roughly a third of issues, so a
              quick keyboard and screen-reader check is still worth doing.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {report.violations.map((v) => (
                <li key={v.id} className="space-y-2 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{v.help}</p>
                    {v.impact ? <StatusBadge status={v.impact} /> : null}
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {v.nodes.length} element{v.nodes.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--muted-foreground)]">{v.description}</p>
                  {v.nodes[0] ? (
                    <pre className="overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--secondary)] p-2 text-[11px]">
                      {v.nodes[0].html}
                    </pre>
                  ) : null}
                  <a
                    href={v.helpUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline underline-offset-4"
                  >
                    How to fix this
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SeoView({ report }: { report: SeoReport }) {
  const linkChecks = report.checks.filter((c) => c.category === "Links");
  const otherChecks = report.checks.filter((c) => c.category !== "Links");
  const order: Record<string, number> = { fail: 0, warning: 1, info: 2, pass: 3 };
  const sorted = [...otherChecks].sort(
    (a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9)
  );
  const counts = report.checks.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["fail", "danger", "failed"],
            ["warning", "warning", "warnings"],
            ["pass", "success", "passed"],
            ["info", "info", "info"],
          ] as const
        ).map(([k, variant, label]) =>
          counts[k] ? (
            <Badge key={k} variant={variant}>
              {counts[k]} {label}
            </Badge>
          ) : null
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Broken links</CardTitle>
          <CardDescription>
            We test up to 15 links found on the page — a sample, not a full crawl.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {linkChecks.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No link checks were returned.</p>
          ) : (
            <CheckList checks={linkChecks} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{report.title || "Untitled page"}</CardTitle>
          <CardDescription>
            {report.finalUrl} · {formatDate(report.fetchedAt)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CheckList checks={sorted} />
        </CardContent>
      </Card>
    </div>
  );
}

function CheckList({ checks }: { checks: SeoCheck[] }) {
  return (
    <ul className="divide-y divide-[var(--border)]">
      {checks.map((c) => (
        <li key={c.id} className="py-3">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <StatusBadge status={c.status} />
            <span className="text-xs text-[var(--muted-foreground)]">{c.category}</span>
          </div>
          <p className="text-sm font-medium">{c.message}</p>
          {c.detail ? (
            <p className="mt-1 break-words text-xs text-[var(--muted-foreground)]">{c.detail}</p>
          ) : null}
          {c.suggestion && c.status !== "pass" ? (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Tip: {c.suggestion}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
