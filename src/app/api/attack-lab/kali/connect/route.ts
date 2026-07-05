import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { validateRequest } from "@/lib/validation";
import { errorResponse } from "@/lib/errors";
import { logAudit, getClientIp } from "@/lib/audit";
import { z } from "zod/v4";

const connectSchema = z.object({
  connectionId: z.string().min(1, "Connection ID is required"),
});

export const POST = requireRole("ADMIN")(async (request: AuthenticatedRequest) => {
  try {
    const validated = await validateRequest(connectSchema, request);
    if ("error" in validated) return validated.error;

    const connection = await prisma.kaliConnection.findUnique({
      where: { id: validated.data.connectionId },
    });

    if (!connection) return errorResponse("Connection not found", 404);
    if (!connection.isActive) return errorResponse("Connection is disabled", 400);

    // In a real implementation, this would attempt an SSH connection.
    // For now, we validate the connection exists and update lastUsed.
    await prisma.kaliConnection.update({
      where: { id: connection.id },
      data: { lastUsed: new Date() },
    });

    logAudit({
      userId: request.user.id,
      action: "KALI_CONNECT",
      targetType: "kali_connection",
      targetId: connection.id,
      details: { host: connection.host, port: connection.port },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      status: "connected",
      connection: {
        id: connection.id,
        name: connection.name,
        host: connection.host,
        port: connection.port,
        username: connection.username,
      },
    });
  } catch (e) {
    console.error("Kali connect failed:", e);
    return errorResponse("Connection failed", 500);
  }
});
