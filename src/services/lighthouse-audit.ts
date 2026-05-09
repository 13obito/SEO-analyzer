import { isUrlSafe } from "@/lib/security";

export type LighthouseSummary = {
  performanceScore: number;
  fcpMs: number | null;
  lcpMs: number | null;
  tbtMs: number | null;
  cls: number | null;
  speedIndexMs: number | null;
};

export function urlsMatch(a: string, b: string): boolean {
  try {
    const norm = (raw: string) => {
      const u = new URL(raw);
      u.hash = "";
      let path = u.pathname;
      if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
      u.pathname = path || "/";
      return `${u.origin}${u.pathname}${u.search}`;
    };
    return norm(a) === norm(b);
  } catch {
    return a === b;
  }
}

function heuristicPerformanceScore(loadTimeMs: number): number {
  if (loadTimeMs < 1000) return 100;
  if (loadTimeMs < 3000) return 70;
  if (loadTimeMs < 5000) return 40;
  return 20;
}

export function resolvePerformanceScore(
  loadTimeMs: number,
  lighthouse: LighthouseSummary | null
): number {
  if (lighthouse != null) return lighthouse.performanceScore;
  return heuristicPerformanceScore(loadTimeMs);
}

/**
 * Run Lighthouse (mobile / LR preset) for a URL. Requires Chrome/Chromium on the server.
 * Returns null on failure (Chrome missing, timeout, network, etc.) — callers should fall back.
 */
export async function runLighthouseSummary(
  url: string
): Promise<LighthouseSummary | null> {
  if (!isUrlSafe(url).safe) return null;

  type ChromeProc = Awaited<
    ReturnType<typeof import("chrome-launcher").launch>
  >;
  let chrome: ChromeProc | undefined;

  try {
    const { launch } = await import("chrome-launcher");
    const lighthouse = (await import("lighthouse")).default;
    const { default: mobileConfig } = await import(
      "lighthouse/core/config/lr-mobile-config.js"
    );

    chrome = await launch({
      chromePath: process.env.CHROME_PATH,
      chromeFlags: [
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--mute-audio",
      ],
    });

    const runnerResult = await lighthouse(
      url,
      {
        logLevel: "error",
        output: "json",
        onlyCategories: ["performance"],
        port: chrome.port,
      },
      mobileConfig
    );

    if (!runnerResult?.lhr) return null;

    const lhr = runnerResult.lhr;
    const perfCat = lhr.categories?.performance?.score;
    const performanceScore =
      perfCat != null ? Math.round(perfCat * 100) : 0;

    const num = (id: string): number | null => {
      const v = lhr.audits?.[id]?.numericValue;
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    };

    return {
      performanceScore,
      fcpMs: num("first-contentful-paint"),
      lcpMs: num("largest-contentful-paint"),
      tbtMs: num("total-blocking-time"),
      cls: num("cumulative-layout-shift"),
      speedIndexMs: num("speed-index"),
    };
  } catch (err) {
    console.error("[lighthouse]", err);
    return null;
  } finally {
    if (chrome) {
      try {
        await Promise.resolve(chrome.kill());
      } catch {
        /* ignore */
      }
    }
  }
}
