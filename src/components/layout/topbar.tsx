"use client";

import { Play, Search } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function Topbar({ onOpenCommand }: { onOpenCommand: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--background)]/80 px-4 backdrop-blur">
      <button
        type="button"
        onClick={onOpenCommand}
        className="hidden h-9 max-w-md flex-1 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-left text-sm text-[var(--muted-foreground)] hover:bg-[var(--accent)] md:flex"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1">Search or jump to…</span>
        <kbd className="rounded border border-[var(--border)] px-1.5 text-[10px]">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/testing/responsive"
          className="inline-flex h-8 items-center gap-2 rounded-md bg-[var(--primary)] px-3 text-xs font-medium text-[var(--primary-foreground)] hover:opacity-90"
        >
          <Play className="h-3.5 w-3.5" />
          Test Website
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
