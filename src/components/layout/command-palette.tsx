"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Camera, Gauge, GitCompare, Mail, Smartphone, type LucideIcon } from "lucide-react";
import { ALL_NAV_ITEMS } from "@/lib/navigation";
import { DEVICE_PRESETS } from "@/lib/devices/presets";

const QUICK_ACTIONS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Test a website", href: "/testing/responsive", icon: Smartphone },
  { label: "Test an email", href: "/email/tester", icon: Mail },
  { label: "Run a full website audit", href: "/audits", icon: Gauge },
  { label: "Take a screenshot", href: "/visual/screenshots", icon: Camera },
  { label: "Compare two screenshots", href: "/visual/screenshots?tab=compare", icon: GitCompare },
];

const ITEM_CLASS =
  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-[var(--foreground)] aria-selected:bg-[var(--accent)]";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const devices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return DEVICE_PRESETS.filter((d) => d.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query]);

  if (!open) return null;

  const go = (href: string) => {
    router.push(href);
    onOpenChange(false);
    setQuery("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]">
      <button
        className="absolute inset-0 cursor-default"
        aria-label="Close command palette"
        onClick={() => onOpenChange(false)}
      />
      <Command
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
        shouldFilter
      >
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="What do you want to do? Try “email” or “iPhone”…"
          className="h-12 w-full border-b border-[var(--border)] bg-transparent px-4 text-sm outline-none"
          autoFocus
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-[var(--muted-foreground)]">
            No results found.
          </Command.Empty>
          <Command.Group heading="Quick actions" className="px-1 text-xs text-[var(--muted-foreground)]">
            {QUICK_ACTIONS.map((a) => (
              <Command.Item key={a.href} value={a.label} onSelect={() => go(a.href)} className={ITEM_CLASS}>
                <a.icon className="h-4 w-4" />
                {a.label}
              </Command.Item>
            ))}
          </Command.Group>
          <Command.Group heading="Pages" className="mt-2 px-1 text-xs text-[var(--muted-foreground)]">
            {ALL_NAV_ITEMS.map((item) => (
              <Command.Item
                key={item.href}
                value={`${item.title} ${item.description ?? ""}`}
                onSelect={() => go(item.href)}
                className={ITEM_CLASS}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Command.Item>
            ))}
          </Command.Group>
          {devices.length > 0 && (
            <Command.Group heading="Test on device" className="mt-2 px-1 text-xs text-[var(--muted-foreground)]">
              {devices.map((d) => (
                <Command.Item
                  key={d.id}
                  value={`device ${d.name}`}
                  onSelect={() => go(`/testing/responsive?device=${encodeURIComponent(d.id)}`)}
                  className={ITEM_CLASS}
                >
                  <Smartphone className="h-4 w-4" />
                  {d.name} · {d.width}×{d.height}
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
        <div className="border-t border-[var(--border)] px-3 py-2 text-[10px] text-[var(--muted-foreground)]">
          Press <kbd className="rounded border border-[var(--border)] px-1">Ctrl</kbd>/
          <kbd className="rounded border border-[var(--border)] px-1">⌘</kbd>+
          <kbd className="rounded border border-[var(--border)] px-1">K</kbd> to open or close
        </div>
      </Command>
    </div>
  );
}
