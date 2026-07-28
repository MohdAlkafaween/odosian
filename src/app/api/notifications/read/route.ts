import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";

export const POST = authenticate(async (request: AuthenticatedRequest) => {
  try {
    let body: { id?: string };
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    if (body.id) {
      await prisma.notification.updateMany({
        where: { id: body.id, userId: request.user.id },
        data: { isRead: true },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId: request.user.id, isRead: false },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Failed to mark notifications as read:", e);
    return errorResponse("Failed to mark notifications as read", 500);
  }
});
