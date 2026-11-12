import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "playwright",
    "lighthouse",
    "chrome-launcher",
    "sharp",
    "@prisma/client",
    "prisma",
  ],
};

export default nextConfig;
