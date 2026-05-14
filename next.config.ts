import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "lighthouse",
    "chrome-launcher",
    "@react-pdf/renderer",
    "pg",
    "@prisma/adapter-pg",
  ],
  /**
   * Lighthouse loads HTML/CSS from its package at runtime; output tracing often
   * omits these (ENOENT on Vercel). Include the full package for API routes that
   * run analysis (see analyzer → lighthouse-audit).
   */
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/lighthouse/**/*"],
  },
};

export default nextConfig;
