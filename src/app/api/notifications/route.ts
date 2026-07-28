import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";

export const GET = authenticate(async (request: AuthenticatedRequest) => {
  try {
    const url = new URL(request.url);
    const limit = Math.min(30, Math.max(1, parseInt(url.searchParams.get("limit") || "15")));

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: request.user.id },
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.count({
        where: { userId: request.user.id, isRead: false },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (e) {
    console.error("Failed to fetch notifications:", e);
    return errorResponse("Failed to fetch notifications", 500);
  }
});
