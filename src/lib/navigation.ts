import {
  LayoutDashboard,
  Smartphone,
  Monitor,
  Globe,
  SunMoon,
  Mail,
  MailOpen,
  Inbox,
  Gauge,
  Accessibility,
  Search,
  Link2,
  Camera,
  GitCompare,
  Eye,
  FolderKanban,
  History,
  FileText,
  TabletSmartphone,
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
    title: "Dashboard",
    items: [
      { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { title: "Recent Tests", href: "/dashboard/recent", icon: History },
    ],
  },
  {
    title: "Website Testing",
    items: [
      { title: "Responsive Tester", href: "/testing/responsive", icon: Smartphone },
      { title: "Device Preview", href: "/testing/devices", icon: TabletSmartphone },
      { title: "Browser Tester", href: "/testing/browsers", icon: Globe },
      { title: "Theme Tester", href: "/testing/themes", icon: SunMoon },
    ],
  },
  {
    title: "Email Testing",
    items: [
      { title: "HTML Email Tester", href: "/email/tester", icon: Mail },
      { title: "Email Responsive Preview", href: "/email/responsive", icon: MailOpen },
      { title: "Email Compatibility", href: "/email/compatibility", icon: Inbox },
    ],
  },
  {
    title: "Website Audits",
    items: [
      { title: "Performance", href: "/audits/performance", icon: Gauge },
      { title: "Accessibility", href: "/audits/accessibility", icon: Accessibility },
      { title: "SEO Analyzer", href: "/audits/seo", icon: Search },
      { title: "Broken Links", href: "/audits/links", icon: Link2 },
    ],
  },
  {
    title: "Visual Testing",
    items: [
      { title: "Screenshot Capture", href: "/visual/screenshots", icon: Camera },
      { title: "Screenshot Comparison", href: "/visual/compare", icon: GitCompare },
      { title: "Visual Regression", href: "/visual/regression", icon: Eye },
    ],
  },
  {
    title: "Management",
    items: [
      { title: "Projects", href: "/projects", icon: FolderKanban },
      { title: "Test History", href: "/history", icon: History },
      { title: "Saved Reports", href: "/reports", icon: FileText },
      { title: "Device Presets", href: "/devices", icon: Monitor },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);
