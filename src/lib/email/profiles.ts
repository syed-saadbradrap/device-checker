export type EmailPreviewProfile = {
  id: string;
  name: string;
  width: number;
  height: number;
  simulated: true;
  group: "latest-phone" | "email-app";
  notes: string;
  deviceId?: string;
  estimated?: boolean;
};

/**
 * Email previews use CSS viewport widths (simulated).
 * Latest lineup (as of Nov 2026): iPhone 18 Pro / Pro Max + iPhone Duo.
 */
export const EMAIL_CLIENT_PROFILES: EmailPreviewProfile[] = [
  // ——— Latest phones (2026) ———
  {
    id: "iphone-18-pro-max",
    name: "iPhone 18 Pro Max",
    width: 440,
    height: 956,
    simulated: true,
    group: "latest-phone",
    deviceId: "iphone-18-pro-max",
    estimated: true,
    notes: "Current flagship Pro Max (Sept 2026)",
  },
  {
    id: "iphone-18-pro",
    name: "iPhone 18 Pro",
    width: 402,
    height: 874,
    simulated: true,
    group: "latest-phone",
    deviceId: "iphone-18-pro",
    estimated: true,
    notes: "Current flagship Pro (Sept 2026) — default email preview",
  },
  {
    id: "iphone-duo",
    name: "iPhone Duo (unfolded)",
    width: 748,
    height: 1024,
    simulated: true,
    group: "latest-phone",
    deviceId: "iphone-duo",
    estimated: true,
    notes: "Foldable inner display (Oct 2026)",
  },
  {
    id: "iphone-duo-cover",
    name: "iPhone Duo (cover)",
    width: 376,
    height: 812,
    simulated: true,
    group: "latest-phone",
    deviceId: "iphone-duo-cover",
    estimated: true,
    notes: "Foldable cover display",
  },
  {
    id: "iphone-17",
    name: "iPhone 17",
    width: 402,
    height: 874,
    simulated: true,
    group: "latest-phone",
    deviceId: "iphone-17",
    estimated: true,
    notes: "Still in Apple’s current standard lineup",
  },
  {
    id: "iphone-air",
    name: "iPhone Air",
    width: 420,
    height: 912,
    simulated: true,
    group: "latest-phone",
    deviceId: "iphone-air",
    estimated: true,
    notes: "Slim iPhone Air",
  },
  {
    id: "iphone-16-pro-max",
    name: "iPhone 16 Pro Max",
    width: 440,
    height: 956,
    simulated: true,
    group: "latest-phone",
    deviceId: "iphone-16-pro-max",
    notes: "Previous generation Pro Max",
  },
  {
    id: "iphone-16-pro",
    name: "iPhone 16 Pro",
    width: 402,
    height: 874,
    simulated: true,
    group: "latest-phone",
    deviceId: "iphone-16-pro",
    notes: "Previous generation Pro",
  },
  {
    id: "galaxy-s25-ultra",
    name: "Galaxy S25 Ultra",
    width: 412,
    height: 915,
    simulated: true,
    group: "latest-phone",
    deviceId: "galaxy-s25-ultra",
    estimated: true,
    notes: "Samsung flagship CSS viewport (estimated)",
  },
  {
    id: "pixel-10-pro",
    name: "Pixel 10 Pro",
    width: 412,
    height: 915,
    simulated: true,
    group: "latest-phone",
    deviceId: "pixel-10-pro",
    estimated: true,
    notes: "Pixel Pro CSS viewport (estimated)",
  },
  {
    id: "ipad-pro-11-2024",
    name: "iPad Pro 11-inch (M4)",
    width: 834,
    height: 1210,
    simulated: true,
    group: "latest-phone",
    deviceId: "ipad-pro-11-2024",
    notes: "iPad Pro 11″ — tablet Mail",
  },

  // ——— Email apps ———
  {
    id: "gmail-desktop",
    name: "Gmail Desktop",
    width: 680,
    height: 900,
    simulated: true,
    group: "email-app",
    notes: "Simulated Gmail web clipping width (~680px)",
  },
  {
    id: "gmail-mobile",
    name: "Gmail Mobile",
    width: 375,
    height: 812,
    simulated: true,
    group: "email-app",
    notes: "Simulated mobile Gmail viewport",
  },
  {
    id: "apple-mail-macos",
    name: "Apple Mail macOS",
    width: 800,
    height: 1000,
    simulated: true,
    group: "email-app",
    notes: "Simulated — not actual Apple Mail engine",
  },
  {
    id: "apple-mail-ios",
    name: "Apple Mail iOS (legacy 390)",
    width: 390,
    height: 844,
    simulated: true,
    group: "email-app",
    notes: "Older width — prefer iPhone 18 Pro profiles for latest",
  },
  {
    id: "outlook-desktop",
    name: "Outlook Desktop",
    width: 600,
    height: 900,
    simulated: true,
    group: "email-app",
    notes: "Simulated Word-like constraints",
  },
  {
    id: "outlook-web",
    name: "Outlook Web",
    width: 680,
    height: 900,
    simulated: true,
    group: "email-app",
    notes: "Simulated Outlook on the web",
  },
  {
    id: "yahoo-mail",
    name: "Yahoo Mail",
    width: 600,
    height: 900,
    simulated: true,
    group: "email-app",
    notes: "Simulated Yahoo Mail content width",
  },
];

export const DEFAULT_EMAIL_PROFILE_ID = "iphone-18-pro";

export const LATEST_EMAIL_DEVICE_WIDTHS = [
  { width: 376, label: "iPhone Duo cover" },
  { width: 402, label: "iPhone 18 Pro" },
  { width: 412, label: "Galaxy / Pixel" },
  { width: 440, label: "iPhone 18 Pro Max" },
  { width: 748, label: "iPhone Duo unfolded" },
  { width: 680, label: "Gmail Desktop" },
] as const;

export type EmailClientProfileId = (typeof EMAIL_CLIENT_PROFILES)[number]["id"];
