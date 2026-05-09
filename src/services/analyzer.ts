import { prisma } from "@/lib/prisma";
import { crawlSite } from "./crawler";
import { scorePages } from "./seo-scorer";
import { analyzeKeywords } from "./keyword-analyzer";
import {
  runLighthouseSummary,
  urlsMatch,
  resolvePerformanceScore,
} from "./lighthouse-audit";

const ERROR_UI_MAX = 800;

function formatAnalysisError(err: unknown): string {
  if (!(err instanceof Error)) return "Unknown error occurred";
  const msg = err.message.trim();
  if (msg.length <= ERROR_UI_MAX) return msg;
  return `${msg.slice(0, ERROR_UI_MAX)}… (see terminal for full log)`;
}

export async function runAnalysis(analysisId: string) {
  try {
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: "crawling" },
    });

    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
    });

    if (!analysis) throw new Error("Analysis not found");

    const pages = await crawlSite(analysis.url, analysis.crawlDepth);

    if (pages.length === 0) {
      await prisma.analysis.update({
        where: { id: analysisId },
        data: {
          status: "failed",
          errorMessage: "Failed to crawl any pages from the provided URL",
        },
      });
      return;
    }

    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: "analyzing" },
    });

    let lh: Awaited<ReturnType<typeof runLighthouseSummary>> = null;
    if (process.env.LIGHTHOUSE_DISABLED !== "1") {
      try {
        lh = await runLighthouseSummary(analysis.url);
      } catch (lhErr) {
        console.error("[analyzer] Lighthouse failed (continuing without it):", lhErr);
      }
    }
    const hasEntryMatch = pages.some((p) => urlsMatch(p.url, analysis.url));

    const { overallScore, issues } = scorePages(pages);
    const keywords = analyzeKeywords(pages);

    for (const page of pages) {
      const lhForRow =
        lh &&
        (urlsMatch(page.url, analysis.url) ||
          (!hasEntryMatch && page.url === pages[0]?.url))
          ? lh
          : null;

      await prisma.pageResult.create({
        data: {
          analysisId,
          url: page.url,
          statusCode: page.statusCode,
          title: page.title,
          metaDescription: page.metaDescription,
          h1Count: page.h1Count,
          h2Count: page.h2Count,
          h3Count: page.h3Count,
          h4Count: page.h4Count,
          h5Count: page.h5Count,
          h6Count: page.h6Count,
          headingStructure: JSON.stringify(page.headings),
          imgTotal: page.imgTotal,
          imgWithoutAlt: page.imgWithoutAlt,
          internalLinks: page.internalLinks,
          externalLinks: page.externalLinks,
          brokenLinks: page.brokenLinks,
          linkDetails: JSON.stringify(page.linkDetails.slice(0, 100)),
          loadTimeMs: page.loadTimeMs,
          pageSize: page.pageSize,
          wordCount: page.wordCount,
          isMobileFriendly: !!page.metaViewport,
          mobileFriendlyDetails: lhForRow
            ? JSON.stringify({
                lighthouse: true,
                performanceScore: lhForRow.performanceScore,
                metrics: {
                  fcpMs: lhForRow.fcpMs,
                  lcpMs: lhForRow.lcpMs,
                  tbtMs: lhForRow.tbtMs,
                  cls: lhForRow.cls,
                  speedIndexMs: lhForRow.speedIndexMs,
                },
              })
            : null,
          performanceScore: resolvePerformanceScore(
            page.loadTimeMs,
            lhForRow
          ),
          pageScore: null,
        },
      });
    }

    for (const issue of issues) {
      await prisma.seoIssue.create({
        data: {
          analysisId,
          pageUrl: issue.pageUrl,
          severity: issue.severity,
          category: issue.category,
          message: issue.message,
          suggestion: issue.suggestion,
        },
      });
    }

    for (const kw of keywords) {
      await prisma.keywordResult.create({
        data: {
          analysisId,
          keyword: kw.keyword,
          count: kw.count,
          density: kw.density,
          isStuffing: kw.isStuffing,
          locations: JSON.stringify(kw.locations),
        },
      });
    }

    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: "completed",
        overallScore: Number.isFinite(overallScore) ? overallScore : 0,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("Analysis failed:", err);
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: "failed",
        errorMessage: formatAnalysisError(err),
      },
    });
  }
}
