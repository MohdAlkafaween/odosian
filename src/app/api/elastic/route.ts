import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";
import { logAudit, getClientIp } from "@/lib/audit";
import { z } from "zod/v4";
import { v4 as uuidv4 } from "uuid";

export const GET = requireRole("ADMIN")(async (_request: AuthenticatedRequest) => {
  try {
    const connections = await prisma.elasticConnection.findMany({
      orderBy: { createdAt: "desc" },
    });
    const masked = connections.map((c) => ({
      ...c,
      apiKey: c.apiKey ? `${c.apiKey.slice(0, 8)}...` : "",
      apiKeySet: !!c.apiKey,
    }));
    return NextResponse.json({ connections: masked });
  } catch (e) {
    console.error("Failed to fetch Elastic connections:", e);
    return errorResponse("Failed to fetch connections", 500);
  }
});

const elasticSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  kibanaUrl: z.string().min(1, "Kibana URL is required").url("Must be a valid URL"),
  apiKey: z.string().optional(),
  spaceId: z.string().default("default"),
  cloudId: z.string().default(""),
  verifySsl: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export const PUT = requireRole("ADMIN")(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const parsed = elasticSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || "Validation failed", 400);
    }

    const { id, name, kibanaUrl, apiKey, spaceId, cloudId, verifySsl, isActive } = parsed.data;

    const data: Record<string, unknown> = {
      name,
      kibanaUrl: kibanaUrl.replace(/\/+$/, ""),
      spaceId,
      cloudId,
      verifySsl,
      isActive,
    };

    if (apiKey) {
      data.apiKey = apiKey;
    }

    let connection;
    if (id) {
      connection = await prisma.elasticConnection.update({
        where: { id },
        data,
      });
    } else {
      if (!apiKey) {
        return errorResponse("API key is required for new connections", 400);
      }
      data.apiKey = apiKey;
      connection = await prisma.elasticConnection.create({
        data: { id: uuidv4(), ...data } as never,
      });
    }

    logAudit({
      userId: request.user.id,
      action: id ? "ELASTIC_CONNECTION_UPDATED" : "ELASTIC_CONNECTION_CREATED",
      targetType: "elastic_connection",
      targetId: connection.id,
      details: { kibanaUrl, spaceId },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      connection: {
        ...connection,
        apiKey: connection.apiKey ? `${connection.apiKey.slice(0, 8)}...` : "",
        apiKeySet: !!connection.apiKey,
      },
    });
  } catch (e) {
    console.error("Failed to save Elastic connection:", e);
    return errorResponse("Failed to save connection", 500);
  }
});

export const DELETE = requireRole("ADMIN")(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return errorResponse("Connection ID required", 400);

    await prisma.elasticConnection.delete({ where: { id } });

    logAudit({
      userId: request.user.id,
      action: "ELASTIC_CONNECTION_DELETED",
      targetType: "elastic_connection",
      targetId: id,
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Failed to delete Elastic connection:", e);
    return errorResponse("Failed to delete connection", 500);
  }
});
