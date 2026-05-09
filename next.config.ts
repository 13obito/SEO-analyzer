import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "lighthouse",
    "chrome-launcher",
    "@react-pdf/renderer",
    "pg",
    "@prisma/adapter-pg",
  ],
};

export default nextConfig;
