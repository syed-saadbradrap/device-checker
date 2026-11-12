"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { Onboarding } from "@/components/layout/onboarding";
import { MobileNav } from "@/components/layout/mobile-nav";

const SIDEBAR_KEY = "devicelab-sidebar-collapsed";

function subscribeSidebar(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    getSidebarCollapsed,
    () => false
  );
  const [commandOpen, setCommandOpen] = useState(false);

  const toggle = useCallback(() => {
    const next = !getSidebarCollapsed();
    localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
    window.dispatchEvent(new Event("storage"));
  }, []);

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} onToggle={toggle} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenCommand={() => setCommandOpen(true)} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <MobileNav />
      <Onboarding />
    </div>
  );
}
