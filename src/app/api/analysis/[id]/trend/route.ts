import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { unauthorizedResponse, forbiddenResponse } from "@/lib/security";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorizedResponse();

  const { id } = await params;

  const analysis = await prisma.analysis.findUnique({
    where: { id },
    select: { projectId: true, project: { select: { userId: true } } },
  });

  if (!analysis) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (analysis.project.userId !== userId) {
    return forbiddenResponse();
  }

  const allAnalyses = await prisma.analysis.findMany({
    where: {
      projectId: analysis.projectId,
      status: "completed",
      overallScore: { not: null },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      overallScore: true,
      createdAt: true,
    },
  });

  return NextResponse.json(allAnalyses);
}
