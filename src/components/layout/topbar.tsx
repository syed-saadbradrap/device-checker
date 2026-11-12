"use client";

import { Bell, Command, Search, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Tooltip } from "@/components/ui/tooltip";

export function Topbar({ onOpenCommand }: { onOpenCommand: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--background)]/80 px-4 backdrop-blur">
      <div className="relative hidden max-w-md flex-1 md:block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <Input
          readOnly
          placeholder="Search pages, devices, projects…"
          className="cursor-pointer pl-9"
          onClick={onOpenCommand}
          onFocus={onOpenCommand}
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Tooltip content="Quick test">
          <Link
            href="/testing/responsive"
            className="hidden h-8 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs font-medium hover:bg-[var(--accent)] sm:inline-flex"
          >
            <Zap className="h-3.5 w-3.5" />
            Quick Test
          </Link>
        </Tooltip>
        <Button variant="ghost" size="icon" onClick={onOpenCommand} aria-label="Command palette">
          <Command className="h-4 w-4" />
        </Button>
        <ThemeToggle />
        <Tooltip content="Notifications">
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>
        </Tooltip>
        <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--secondary)] text-xs font-semibold">
          DL
        </div>
      </div>
    </header>
  );
}
