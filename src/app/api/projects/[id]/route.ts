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

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      analyses: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          url: true,
          status: true,
          overallScore: true,
          errorMessage: true,
          createdAt: true,
          completedAt: true,
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "资源不存在" }, { status: 404 });
  }

  if (project.userId !== userId) {
    return forbiddenResponse();
  }

  return NextResponse.json(project);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorizedResponse();

  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id } });

  if (!project) {
    return NextResponse.json({ error: "资源不存在" }, { status: 404 });
  }

  if (project.userId !== userId) {
    return forbiddenResponse();
  }

  await prisma.project.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
