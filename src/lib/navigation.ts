import {
  LayoutDashboard,
  Smartphone,
  Monitor,
  Mail,
  Gauge,
  Camera,
  History,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description?: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Start",
    items: [
      { title: "Home", href: "/dashboard", icon: LayoutDashboard, description: "Start a test and see recent activity" },
    ],
  },
  {
    title: "Test",
    items: [
      { title: "Test Website", href: "/testing/responsive", icon: Smartphone, description: "Preview a URL on several devices" },
      { title: "Test Email", href: "/email/tester", icon: Mail, description: "Preview and check HTML email" },
      { title: "Website Audit", href: "/audits", icon: Gauge, description: "Performance, accessibility and SEO" },
      { title: "Screenshots", href: "/visual/screenshots", icon: Camera, description: "Capture or compare screenshots" },
      { title: "Devices", href: "/devices", icon: Monitor, description: "Browse screen sizes" },
    ],
  },
  {
    title: "More",
    items: [
      { title: "History", href: "/history", icon: History, description: "Your recent tests" },
      { title: "Settings", href: "/settings", icon: Settings, description: "Theme and preferences" },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);
