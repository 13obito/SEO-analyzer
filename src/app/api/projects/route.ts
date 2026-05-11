import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { unauthorizedResponse, badRequestResponse } from "@/lib/security";

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url().max(2048),
});

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorizedResponse();

  const projects = await prisma.project.findMany({
    where: { userId },
    include: {
      analyses: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          overallScore: true,
          status: true,
          createdAt: true,
        },
      },
      _count: { select: { analyses: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorizedResponse();

  try {
    const body = await request.json();
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return badRequestResponse("输入无效");
    }

    const project = await prisma.project.create({
      data: {
        ...parsed.data,
        userId,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}
