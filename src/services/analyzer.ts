import { prisma } from "@/lib/prisma";
import { crawlSite } from "./crawler";
import { scorePages } from "./seo-scorer";
import { analyzeKeywords } from "./keyword-analyzer";
import {
  runLighthouseSummary,
  runPageSpeedInsightsSummary,
  urlsMatch,
  resolvePerformanceScore,
  type LabPerformanceSource,
  type LighthouseSummary,
} from "./lighthouse-audit";

const ERROR_UI_MAX = 800;

function formatAnalysisError(err: unknown): string {
  if (!(err instanceof Error)) return "发生未知错误";
  const msg = err.message.trim();
  if (msg.length <= ERROR_UI_MAX) return msg;
  return `${msg.slice(0, ERROR_UI_MAX)}…（完整信息请查看服务器日志）`;
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

    if (!analysis) throw new Error("未找到分析任务");

    const pages = await crawlSite(analysis.url, analysis.crawlDepth);

    if (pages.length === 0) {
      await prisma.analysis.update({
        where: { id: analysisId },
        data: {
          status: "failed",
          errorMessage: "未能从该 URL 抓取到任何页面",
        },
      });
      return;
    }

    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: "analyzing" },
    });

    let lab: {
      summary: LighthouseSummary;
      source: LabPerformanceSource;
    } | null = null;
    if (process.env.LIGHTHOUSE_DISABLED !== "1") {
      try {
        const local = await runLighthouseSummary(analysis.url);
        if (local) lab = { summary: local, source: "local" };
      } catch (lhErr) {
        console.error("[analyzer] Lighthouse failed (continuing without it):", lhErr);
      }
    }
    if (!lab) {
      const psi = await runPageSpeedInsightsSummary(analysis.url);
      if (psi) lab = { summary: psi, source: "pagespeed" };
    }
    const hasEntryMatch = pages.some((p) => urlsMatch(p.url, analysis.url));

    const { overallScore, issues } = scorePages(pages);
    const keywords = analyzeKeywords(pages);

    for (const page of pages) {
      const lhForRow =
        lab &&
        (urlsMatch(page.url, analysis.url) ||
          (!hasEntryMatch && page.url === pages[0]?.url))
          ? lab
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
                labSource: lhForRow.source,
                performanceScore: lhForRow.summary.performanceScore,
                metrics: {
                  fcpMs: lhForRow.summary.fcpMs,
                  lcpMs: lhForRow.summary.lcpMs,
                  tbtMs: lhForRow.summary.tbtMs,
                  cls: lhForRow.summary.cls,
                  speedIndexMs: lhForRow.summary.speedIndexMs,
                },
              })
            : null,
          performanceScore: resolvePerformanceScore(
            page.loadTimeMs,
            lhForRow?.summary ?? null
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
