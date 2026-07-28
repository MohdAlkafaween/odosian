import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";
import { logAudit, getClientIp } from "@/lib/audit";

export const DELETE = requireRole("DETECTION_ENG", "ADMIN")(async (request: AuthenticatedRequest, context) => {
  try {
    const { id, commentId } = await context.params as { id: string; commentId: string };

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) return errorResponse("Comment not found", 404);
    if (comment.ruleId !== id) return errorResponse("Comment does not belong to this rule", 404);

    if (comment.userId !== request.user.id && request.user.role !== "ADMIN") {
      return errorResponse("You can only delete your own comments", 403);
    }

    await prisma.comment.delete({ where: { id: commentId } });

    logAudit({
      userId: request.user.id,
      action: "COMMENT_DELETED",
      targetType: "rule",
      targetId: id,
      details: { commentId },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ message: "Comment deleted" });
  } catch (e) {
    console.error("Failed to delete comment:", e);
    return errorResponse("Failed to delete comment", 500);
  }
});
