import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import {
  analysisInputSchema,
  isUrlSafe,
  unauthorizedResponse,
  forbiddenResponse,
  badRequestResponse,
  rateLimitedResponse,
  checkRateLimit,
  rateLimitKey,
  tooManyConcurrentAnalysesResponse,
  analysisQueueBusyResponse,
  analysisQueueUnavailableResponse,
} from "@/lib/security";
import {
  analysisMaxPerUser,
  analysisQueueMaxBacklog,
  enqueueAnalysisJob,
  getAnalysisQueueBacklog,
} from "@/lib/analysis-queue";
import { runAnalysis } from "@/services/analyzer";

/** Vercel Hobby: keep as high as your plan allows; deep crawls + Lighthouse may still exceed limits. */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorizedResponse();

  const rl = checkRateLimit(rateLimitKey(userId, "analysis"), 5, 60_000);
  if (!rl.allowed) return rateLimitedResponse(rl.resetAt);

  try {
    const body = await request.json();
    const parsed = analysisInputSchema.safeParse(body);

    if (!parsed.success) {
      return badRequestResponse("Invalid input: check URL format and crawl depth (1-3)");
    }

    const { url, crawlDepth, projectId } = parsed.data;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return badRequestResponse("Project not found");
    if (project.userId !== userId) return forbiddenResponse();

    const urlCheck = isUrlSafe(url);
    if (!urlCheck.safe) {
      return badRequestResponse(`Blocked URL: ${urlCheck.reason}`);
    }

    const activeForUser = await prisma.analysis.count({
      where: {
        project: { userId },
        status: { in: ["pending", "crawling", "analyzing"] },
      },
    });
    if (activeForUser >= analysisMaxPerUser()) {
      return tooManyConcurrentAnalysesResponse();
    }

    const useQueue =
      process.env.ANALYSIS_USE_QUEUE === "1" ||
      process.env.ANALYSIS_USE_QUEUE === "true";

    const useInline =
      !useQueue &&
      (process.env.VERCEL === "1" ||
        process.env.ANALYSIS_USE_INLINE === "1" ||
        process.env.ANALYSIS_USE_INLINE === "true");

    if (!useInline) {
      try {
        const backlog = await getAnalysisQueueBacklog();
        if (backlog >= analysisQueueMaxBacklog()) {
          return analysisQueueBusyResponse();
        }
      } catch (err) {
        console.error("[analysis] Redis / queue check failed:", err);
        return analysisQueueUnavailableResponse();
      }
    }

    const analysis = await prisma.analysis.create({
      data: {
        projectId,
        url,
        crawlDepth,
        status: "pending",
      },
    });

    if (useInline) {
      const task = runAnalysis(analysis.id).catch(console.error);
      if (process.env.VERCEL === "1") {
        try {
          const { waitUntil } = await import("@vercel/functions");
          waitUntil(task);
        } catch {
          void task;
        }
      }
    } else {
      try {
        await enqueueAnalysisJob({ analysisId: analysis.id, userId });
      } catch (err) {
        console.error("[analysis] enqueue failed:", err);
        await prisma.analysis.delete({ where: { id: analysis.id } }).catch(() => {});
        return analysisQueueUnavailableResponse();
      }
    }

    return NextResponse.json(analysis, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
