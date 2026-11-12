"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { ALL_NAV_ITEMS } from "@/lib/navigation";
import { DEVICE_PRESETS } from "@/lib/devices/presets";

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

  const devices = useMemo(
    () =>
      DEVICE_PRESETS.filter((d) =>
        d.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8),
    [query]
  );

  if (!open) return null;

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
          placeholder="Jump to a page, start a test, find a device…"
          className="h-12 w-full border-b border-[var(--border)] bg-transparent px-4 text-sm outline-none"
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-[var(--muted-foreground)]">
            No results found.
          </Command.Empty>
          <Command.Group heading="Navigation" className="px-1 text-xs text-[var(--muted-foreground)]">
            {ALL_NAV_ITEMS.map((item) => (
              <Command.Item
                key={item.href}
                value={item.title}
                onSelect={() => {
                  router.push(item.href);
                  onOpenChange(false);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-[var(--foreground)] aria-selected:bg-[var(--accent)]"
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Command.Item>
            ))}
          </Command.Group>
          <Command.Group heading="Quick actions" className="mt-2 px-1 text-xs text-[var(--muted-foreground)]">
            <Command.Item
              value="Test a website"
              onSelect={() => {
                router.push("/testing/responsive");
                onOpenChange(false);
              }}
              className="cursor-pointer rounded-md px-2 py-2 text-sm aria-selected:bg-[var(--accent)]"
            >
              Test a website
            </Command.Item>
            <Command.Item
              value="Test an email"
              onSelect={() => {
                router.push("/email/tester");
                onOpenChange(false);
              }}
              className="cursor-pointer rounded-md px-2 py-2 text-sm aria-selected:bg-[var(--accent)]"
            >
              Test an email
            </Command.Item>
            <Command.Item
              value="Run full audit"
              onSelect={() => {
                router.push("/audits/performance");
                onOpenChange(false);
              }}
              className="cursor-pointer rounded-md px-2 py-2 text-sm aria-selected:bg-[var(--accent)]"
            >
              Run performance audit
            </Command.Item>
          </Command.Group>
          {devices.length > 0 && (
            <Command.Group heading="Devices" className="mt-2 px-1 text-xs text-[var(--muted-foreground)]">
              {devices.map((d) => (
                <Command.Item
                  key={d.id}
                  value={d.name}
                  onSelect={() => {
                    router.push(`/devices?q=${encodeURIComponent(d.name)}`);
                    onOpenChange(false);
                  }}
                  className="cursor-pointer rounded-md px-2 py-2 text-sm aria-selected:bg-[var(--accent)]"
                >
                  {d.name} · {d.width}×{d.height}
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
        <div className="border-t border-[var(--border)] px-3 py-2 text-[10px] text-[var(--muted-foreground)]">
          Press <kbd className="rounded border border-[var(--border)] px-1">⌘</kbd>/
          <kbd className="rounded border border-[var(--border)] px-1">Ctrl</kbd>+
          <kbd className="rounded border border-[var(--border)] px-1">K</kbd> to toggle
        </div>
      </Command>
    </div>
  );
}
