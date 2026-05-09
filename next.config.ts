import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "lighthouse",
    "chrome-launcher",
    "better-sqlite3",
    "@prisma/adapter-better-sqlite3",
    "@react-pdf/renderer",
  ],
};

export default nextConfig;
