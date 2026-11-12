"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { NAV_SECTIONS } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="md:hidden">
      <Button
        variant="outline"
        size="icon"
        className="fixed bottom-4 right-4 z-40 h-11 w-11 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50">
          <div className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-[var(--card)] shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-[var(--border)] px-3">
              <span className="text-sm font-semibold">DeviceLab</span>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              {NAV_SECTIONS.map((section) => (
                <div key={section.title} className="mb-4">
                  <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    {section.title}
                  </div>
                  <ul className="space-y-0.5">
                    {section.items.map((item) => {
                      const active =
                        pathname === item.href || pathname.startsWith(item.href + "/");
                      const Icon = item.icon;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-2 text-sm",
                              active
                                ? "bg-[var(--accent)] font-medium"
                                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            {item.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
