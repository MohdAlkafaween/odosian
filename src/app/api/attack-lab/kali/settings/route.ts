import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { validateRequest } from "@/lib/validation";
import { errorResponse } from "@/lib/errors";
import { logAudit, getClientIp } from "@/lib/audit";
import { z } from "zod/v4";
import { v4 as uuidv4 } from "uuid";

export const GET = requireRole("ADMIN")(async (_request: AuthenticatedRequest) => {
  try {
    const connections = await prisma.kaliConnection.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ connections });
  } catch (e) {
    console.error("Failed to fetch Kali settings:", e);
    return errorResponse("Failed to fetch connections", 500);
  }
});

const kaliSettingsSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  host: z.string().min(1, "Host is required"),
  port: z.number().int().min(1).max(65535).default(22),
  username: z.string().min(1).default("kali"),
  authType: z.enum(["password", "key"]).default("password"),
  isActive: z.boolean().default(true),
});

export const PUT = requireRole("ADMIN")(async (request: AuthenticatedRequest) => {
  try {
    const validated = await validateRequest(kaliSettingsSchema, request);
    if ("error" in validated) return validated.error;

    const { id, name, host, port, username, authType, isActive } = validated.data;

    let connection;
    if (id) {
      connection = await prisma.kaliConnection.update({
        where: { id },
        data: { name, host, port, username, authType, isActive },
      });
    } else {
      connection = await prisma.kaliConnection.create({
        data: { id: uuidv4(), name, host, port, username, authType, isActive },
      });
    }

    logAudit({
      userId: request.user.id,
      action: id ? "KALI_SETTINGS_UPDATED" : "KALI_SETTINGS_CREATED",
      targetType: "kali_connection",
      targetId: connection.id,
      details: { host, port },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ connection });
  } catch (e) {
    console.error("Failed to save Kali settings:", e);
    return errorResponse("Failed to save connection", 500);
  }
});
