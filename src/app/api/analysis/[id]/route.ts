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
    include: {
      pages: true,
      seoIssues: { orderBy: { severity: "asc" } },
      keywords: { orderBy: { density: "desc" } },
      project: { select: { userId: true, name: true } },
    },
  });

  if (!analysis) {
    return NextResponse.json({ error: "资源不存在" }, { status: 404 });
  }

  if (analysis.project.userId !== userId) {
    return forbiddenResponse();
  }

  return NextResponse.json(analysis);
}
