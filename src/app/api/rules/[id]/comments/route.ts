import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";
import { logAudit, getClientIp } from "@/lib/audit";

export const GET = authenticate(async (_request: AuthenticatedRequest, context) => {
  try {
    const { id } = await context.params as { id: string };

    const comments = await prisma.comment.findMany({
      where: { ruleId: id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ comments });
  } catch (e) {
    console.error("Failed to fetch comments:", e);
    return errorResponse("Failed to fetch comments", 500);
  }
});

export const POST = requireRole("DETECTION_ENG", "ADMIN")(async (request: AuthenticatedRequest, context) => {
  try {
    const { id } = await context.params as { id: string };

    let body: { content?: string };
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid request body", 400);
    }

    const content = body.content?.trim();
    if (!content) return errorResponse("Content is required", 400);
    if (content.length > 2000) return errorResponse("Content must be 2000 characters or less", 400);

    const rule = await prisma.rule.findUnique({
      where: { id },
      select: { authorId: true, title: true },
    });
    if (!rule) return errorResponse("Rule not found", 404);

    const comment = await prisma.comment.create({
      data: {
        ruleId: id,
        userId: request.user.id,
        content,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (rule.authorId !== request.user.id) {
      await prisma.notification.create({
        data: {
          userId: rule.authorId,
          type: "comment",
          title: `New comment on "${rule.title}"`,
          message: content.slice(0, 100),
          targetType: "rule",
          targetId: id,
        },
      });
    }

    logAudit({
      userId: request.user.id,
      action: "COMMENT_ADDED",
      targetType: "rule",
      targetId: id,
      details: { commentId: comment.id },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (e) {
    console.error("Failed to create comment:", e);
    return errorResponse("Failed to create comment", 500);
  }
});
