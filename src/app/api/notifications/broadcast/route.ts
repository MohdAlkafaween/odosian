import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";

export const POST = requireRole("ADMIN")(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { title, message, priority, ruleId } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return errorResponse("Title is required", 400);
    }
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return errorResponse("Message is required", 400);
    }

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const notificationType = priority === "urgent" ? "urgent_broadcast" : "broadcast";

    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: notificationType,
        title: title.trim(),
        message: message.trim(),
        targetType: ruleId ? "rule" : "",
        targetId: ruleId || "",
      })),
    });

    await prisma.auditLog.create({
      data: {
        userId: request.user.id,
        action: "NOTIFICATION_BROADCAST",
        details: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          priority: priority || "normal",
          recipientCount: users.length,
          ruleId: ruleId || null,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      recipientCount: users.length,
    });
  } catch (e) {
    console.error("Failed to broadcast notification:", e);
    return errorResponse("Failed to broadcast notification", 500);
  }
});
