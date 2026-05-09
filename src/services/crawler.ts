import * as cheerio from "cheerio";
import { isUrlSafe } from "@/lib/security";

export interface CrawlResult {
  url: string;
  statusCode: number;
  html: string;
  headers: Record<string, string>;
  loadTimeMs: number;
  pageSize: number;
  error?: string;
}

export interface LinkInfo {
  href: string;
  text: string;
  isExternal: boolean;
  statusCode?: number;
  isBroken: boolean;
}

export interface PageSeoData {
  url: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  headings: { tag: string; text: string }[];
  h1Count: number;
  h2Count: number;
  h3Count: number;
  h4Count: number;
  h5Count: number;
  h6Count: number;
  imgTotal: number;
  imgWithoutAlt: number;
  images: { src: string; alt: string | null }[];
  internalLinks: number;
  externalLinks: number;
  brokenLinks: number;
  linkDetails: LinkInfo[];
  loadTimeMs: number;
  pageSize: number;
  wordCount: number;
  bodyText: string;
  metaViewport: string | null;
  canonicalUrl: string | null;
  metaRobots: string | null;
  ogTags: Record<string, string>;
}

const MAX_CONCURRENT_REQUESTS = 5;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_PAGE_SIZE = 10 * 1024 * 1024; // 10MB

async function fetchPage(url: string): Promise<CrawlResult> {
  const safeCheck = isUrlSafe(url);
  if (!safeCheck.safe) {
    return {
      url,
      statusCode: 0,
      html: "",
      headers: {},
      loadTimeMs: 0,
      pageSize: 0,
      error: safeCheck.reason,
    };
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "SEOAnalyzerBot/1.0 (+https://seo-analyzer.example.com/bot)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    const contentLength = parseInt(
      response.headers.get("content-length") || "0"
    );
    if (contentLength > MAX_PAGE_SIZE) {
      return {
        url,
        statusCode: response.status,
        html: "",
        headers: {},
        loadTimeMs: Date.now() - start,
        pageSize: contentLength,
        error: "Page too large",
      };
    }

    const html = await response.text();
    const loadTimeMs = Date.now() - start;

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      url,
      statusCode: response.status,
      html,
      headers,
      loadTimeMs,
      pageSize: new TextEncoder().encode(html).length,
    };
  } catch (err) {
    return {
      url,
      statusCode: 0,
      html: "",
      headers: {},
      loadTimeMs: Date.now() - start,
      pageSize: 0,
      error: err instanceof Error ? err.message : "Unknown fetch error",
    };
  }
}

function extractLinks(
  $: cheerio.CheerioAPI,
  baseUrl: string
): LinkInfo[] {
  const links: LinkInfo[] = [];
  const base = new URL(baseUrl);

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    try {
      const resolved = new URL(href, baseUrl);
      if (!["http:", "https:"].includes(resolved.protocol)) return;

      const isExternal = resolved.hostname !== base.hostname;
      links.push({
        href: resolved.href,
        text: $(el).text().trim().slice(0, 200),
        isExternal,
        isBroken: false,
      });
    } catch {
      // skip malformed URLs
    }
  });

  return links;
}

export function parsePage(url: string, crawlResult: CrawlResult): PageSeoData {
  const $ = cheerio.load(crawlResult.html);

  const headings: { tag: string; text: string }[] = [];
  const hCounts = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };

  for (const tag of ["h1", "h2", "h3", "h4", "h5", "h6"] as const) {
    $(tag).each((_, el) => {
      const text = $(el).text().trim();
      headings.push({ tag, text });
      hCounts[tag]++;
    });
  }

  const images: { src: string; alt: string | null }[] = [];
  let imgWithoutAlt = 0;
  $("img").each((_, el) => {
    const src = $(el).attr("src") || "";
    const alt = $(el).attr("alt") ?? null;
    images.push({ src, alt });
    if (alt === null || alt.trim() === "") imgWithoutAlt++;
  });

  const linkDetails = extractLinks($, url);
  const internalLinks = linkDetails.filter((l) => !l.isExternal).length;
  const externalLinks = linkDetails.filter((l) => l.isExternal).length;

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  const ogTags: Record<string, string> = {};
  $("meta[property^='og:']").each((_, el) => {
    const property = $(el).attr("property");
    const content = $(el).attr("content");
    if (property && content) ogTags[property] = content;
  });

  return {
    url,
    statusCode: crawlResult.statusCode,
    title: $("title").first().text().trim() || null,
    metaDescription:
      $('meta[name="description"]').attr("content")?.trim() || null,
    headings,
    h1Count: hCounts.h1,
    h2Count: hCounts.h2,
    h3Count: hCounts.h3,
    h4Count: hCounts.h4,
    h5Count: hCounts.h5,
    h6Count: hCounts.h6,
    imgTotal: images.length,
    imgWithoutAlt,
    images,
    internalLinks,
    externalLinks,
    brokenLinks: 0,
    linkDetails,
    loadTimeMs: crawlResult.loadTimeMs,
    pageSize: crawlResult.pageSize,
    wordCount,
    bodyText,
    metaViewport: $('meta[name="viewport"]').attr("content") || null,
    canonicalUrl: $('link[rel="canonical"]').attr("href") || null,
    metaRobots: $('meta[name="robots"]').attr("content") || null,
    ogTags,
  };
}

async function checkBrokenLinks(links: LinkInfo[]): Promise<LinkInfo[]> {
  const checked: LinkInfo[] = [];
  const batches: LinkInfo[][] = [];

  for (let i = 0; i < links.length; i += MAX_CONCURRENT_REQUESTS) {
    batches.push(links.slice(i, i + MAX_CONCURRENT_REQUESTS));
  }

  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map(async (link) => {
        const safe = isUrlSafe(link.href);
        if (!safe.safe) return { ...link, statusCode: 0, isBroken: true };

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(link.href, {
            method: "HEAD",
            signal: controller.signal,
            redirect: "follow",
          });
          clearTimeout(timeout);
          return {
            ...link,
            statusCode: res.status,
            isBroken: res.status >= 400,
          };
        } catch {
          return { ...link, statusCode: 0, isBroken: true };
        }
      })
    );

    for (const r of results) {
      checked.push(
        r.status === "fulfilled"
          ? r.value
          : { ...batch[0], statusCode: 0, isBroken: true }
      );
    }
  }

  return checked;
}

export async function crawlSite(
  startUrl: string,
  maxDepth: number
): Promise<PageSeoData[]> {
  const visited = new Set<string>();
  const results: PageSeoData[] = [];
  const maxPages = 20;

  async function crawl(url: string, depth: number) {
    if (depth > maxDepth || visited.size >= maxPages) return;

    const normalized = new URL(url).href;
    if (visited.has(normalized)) return;
    visited.add(normalized);

    const safe = isUrlSafe(normalized);
    if (!safe.safe) return;

    const crawlResult = await fetchPage(normalized);
    // Give up only on hard transport failure. Allow empty body on 2xx (still parseable).
    if (crawlResult.statusCode === 0) return;
    if (!crawlResult.html && crawlResult.statusCode >= 400) return;

    const pageData = parsePage(normalized, crawlResult);

    const checkedLinks = await checkBrokenLinks(
      pageData.linkDetails.slice(0, 50)
    );
    pageData.linkDetails = checkedLinks;
    pageData.brokenLinks = checkedLinks.filter((l) => l.isBroken).length;

    results.push(pageData);

    if (depth < maxDepth) {
      const base = new URL(startUrl);
      const internalUrls = pageData.linkDetails
        .filter((l) => !l.isExternal && !l.isBroken)
        .map((l) => l.href)
        .filter((href) => {
          try {
            return new URL(href).hostname === base.hostname;
          } catch {
            return false;
          }
        });

      for (const nextUrl of internalUrls.slice(0, 10)) {
        if (visited.size >= maxPages) break;
        await crawl(nextUrl, depth + 1);
      }
    }
  }

  await crawl(startUrl, 1);
  return results;
}
