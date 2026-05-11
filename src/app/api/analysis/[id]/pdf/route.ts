import { NextRequest, NextResponse } from "next/server";
import { Document, renderToBuffer } from "@react-pdf/renderer";
import React, { type ComponentProps } from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { unauthorizedResponse, forbiddenResponse } from "@/lib/security";
import {
  AnalysisReportPdf,
  type AnalysisPdfInput,
} from "@/lib/analysis-report-pdf";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorizedResponse();

  const { id } = await params;

  const analysis = await prisma.analysis.findUnique({
    where: { id },
    include: {
      pages: true,
      seoIssues: { orderBy: { severity: "asc" } },
      keywords: { orderBy: { density: "desc" }, take: 20 },
      project: { select: { userId: true, name: true, url: true } },
    },
  });

  if (!analysis) {
    return NextResponse.json({ error: "资源不存在" }, { status: 404 });
  }

  if (analysis.project.userId !== userId) {
    return forbiddenResponse();
  }

  const data: AnalysisPdfInput = {
    analysisId: analysis.id,
    url: analysis.url,
    createdAt: analysis.createdAt,
    crawlDepth: analysis.crawlDepth,
    overallScore: analysis.overallScore,
    projectName: analysis.project.name,
    pages: analysis.pages.map((p) => ({
      url: p.url,
      statusCode: p.statusCode,
      title: p.title,
      loadTimeMs: p.loadTimeMs,
      wordCount: p.wordCount,
      isMobileFriendly: p.isMobileFriendly,
      performanceScore: p.performanceScore,
    })),
    seoIssues: analysis.seoIssues.map((i) => ({
      severity: i.severity,
      category: i.category,
      message: i.message,
      suggestion: i.suggestion,
    })),
    keywords: analysis.keywords.map((k) => ({
      keyword: k.keyword,
      count: k.count,
      density: k.density,
      isStuffing: k.isStuffing,
    })),
  };

  try {
    const buffer = await renderToBuffer(
      React.createElement(AnalysisReportPdf, { data }) as React.ReactElement<
        ComponentProps<typeof Document>
      >
    );
    const filename = `seo-report-${id}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[analysis/pdf]", err);
    return NextResponse.json(
      { error: "PDF 生成失败" },
      { status: 500 }
    );
  }
}
