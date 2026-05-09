import { z } from "zod/v4";
import { NextResponse } from "next/server";

const BLOCKED_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,         // link-local / AWS metadata
  /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./,  // carrier-grade NAT
  /^::1$/,
  /^fc00:/i,
  /^fd00:/i,
  /^fe80:/i,
  /^ff00:/i,
];

const BLOCKED_HOSTNAMES = [
  "localhost",
  "metadata.google.internal",
  "metadata.google",
  "169.254.169.254",
  "metadata",
  "[::1]",
];

export function isUrlSafe(urlString: string): { safe: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { safe: false, reason: "Invalid URL format" };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { safe: false, reason: "Only HTTP and HTTPS protocols are allowed" };
  }

  const hostname = parsed.hostname.toLowerCase();

  for (const blocked of BLOCKED_HOSTNAMES) {
    if (hostname === blocked || hostname.endsWith("." + blocked)) {
      return { safe: false, reason: `Blocked hostname: ${hostname}` };
    }
  }

  for (const pattern of BLOCKED_IP_RANGES) {
    if (pattern.test(hostname)) {
      return { safe: false, reason: `Blocked IP range: ${hostname}` };
    }
  }

  if (!parsed.hostname || parsed.hostname.trim() === "") {
    return { safe: false, reason: "Empty hostname" };
  }

  return { safe: true };
}

export const urlSchema = z.string().url().max(2048);

export const crawlDepthSchema = z.number().int().min(1).max(3);

export const analysisInputSchema = z.object({
  url: urlSchema,
  crawlDepth: crawlDepthSchema.default(1),
  projectId: z.string().uuid(),
});

export function sanitizeHtml(dirty: string): string {
  return dirty
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function rateLimitKey(userId: string, action: string): string {
  return `rate_limit:${action}:${userId}`;
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

export function unauthorizedResponse(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function badRequestResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function rateLimitedResponse(resetAt: number) {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
      },
    }
  );
}

export function tooManyConcurrentAnalysesResponse() {
  return NextResponse.json(
    {
      error:
        "You have reached the maximum number of concurrent analyses. Wait for one to finish or increase ANALYSIS_MAX_PER_USER for self-hosted deployments.",
    },
    { status: 429 }
  );
}

export function analysisQueueBusyResponse() {
  return NextResponse.json(
    {
      error:
        "The analysis queue is at capacity. Please try again shortly. (Redis worker fleet may need scaling up.)",
    },
    { status: 503 }
  );
}

export function analysisQueueUnavailableResponse() {
  return NextResponse.json(
    {
      error:
        "Could not use the analysis queue. Ensure Redis is running (REDIS_URL), then start a worker with `npm run worker:analysis`. For local debugging only, set ANALYSIS_USE_INLINE=1.",
    },
    { status: 503 }
  );
}
