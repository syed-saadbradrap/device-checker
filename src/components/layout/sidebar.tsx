"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, FlaskConical } from "lucide-react";
import { NAV_SECTIONS } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 flex h-screen flex-col border-r border-[var(--border)] bg-[var(--sidebar)] text-[var(--sidebar-foreground)] transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      <div className="flex h-14 items-center justify-between gap-2 border-b border-[var(--border)] px-3">
        <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]">
            <FlaskConical className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight">DeviceLab</div>
              <div className="truncate text-[10px] text-[var(--muted-foreground)]">
                Website & Email QA
              </div>
            </div>
          )}
        </Link>
        <Button variant="ghost" size="icon" onClick={onToggle} aria-label="Toggle sidebar">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            {!collapsed && (
              <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {section.title}
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.title : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                        active
                          ? "bg-[var(--accent)] font-medium text-[var(--foreground)]"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                        collapsed && "justify-center"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.title}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
