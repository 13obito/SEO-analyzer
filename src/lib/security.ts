import { z } from "zod/v4";
import { NextResponse } from "next/server";

const BLOCKED_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./, // link-local / AWS metadata
  /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./, // carrier-grade NAT
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
    return { safe: false, reason: "URL 格式无效" };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { safe: false, reason: "仅允许 http 或 https 协议" };
  }

  const hostname = parsed.hostname.toLowerCase();

  for (const blocked of BLOCKED_HOSTNAMES) {
    if (hostname === blocked || hostname.endsWith("." + blocked)) {
      return { safe: false, reason: `禁止访问的主机名：${hostname}` };
    }
  }

  for (const pattern of BLOCKED_IP_RANGES) {
    if (pattern.test(hostname)) {
      return { safe: false, reason: `禁止访问的 IP / 网段：${hostname}` };
    }
  }

  if (!parsed.hostname || parsed.hostname.trim() === "") {
    return { safe: false, reason: "主机名为空" };
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

export function unauthorizedResponse(message = "未登录或登录已过期") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(message = "无权访问") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function badRequestResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function rateLimitedResponse(resetAt: number) {
  return NextResponse.json(
    { error: "请求过于频繁，请稍后再试。" },
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
        "当前进行中的分析已达上限。请等待任务结束；自建部署可调高 ANALYSIS_MAX_PER_USER。",
    },
    { status: 429 }
  );
}

export function analysisQueueBusyResponse() {
  return NextResponse.json(
    {
      error:
        "分析队列已满，请稍后重试。（如需更多吞吐，请扩容 Redis Worker。）",
    },
    { status: 503 }
  );
}

export function analysisQueueUnavailableResponse() {
  return NextResponse.json(
    {
      error:
        "无法使用分析队列。请确认 Redis 已运行（REDIS_URL）并执行 `npm run worker:analysis`。本地调试可设置 ANALYSIS_USE_INLINE=1。",
    },
    { status: 503 }
  );
}
