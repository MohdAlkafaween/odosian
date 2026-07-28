import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";
import { logAudit, getClientIp } from "@/lib/audit";

const JSON_FIELDS = ["variables", "tags", "mitreTactics"];

function parseJsonFields(t: Record<string, unknown>) {
  const parsed = { ...t };
  for (const field of JSON_FIELDS) {
    if (typeof parsed[field] === "string") {
      try { parsed[field] = JSON.parse(parsed[field] as string); } catch { /* keep string */ }
    }
  }
  return parsed;
}

export const GET = authenticate(async (_request: AuthenticatedRequest, context) => {
  try {
    const { id } = await context.params as { id: string };

    const template = await prisma.ruleTemplate.findUnique({ where: { id } });
    if (!template) return errorResponse("Template not found", 404);

    return NextResponse.json({
      template: parseJsonFields(template as unknown as Record<string, unknown>),
    });
  } catch (e) {
    console.error("Failed to fetch template:", e);
    return errorResponse("Failed to fetch template", 500);
  }
});

export const PUT = requireRole("ADMIN")(async (request: AuthenticatedRequest, context) => {
  try {
    const { id } = await context.params as { id: string };

    const existing = await prisma.ruleTemplate.findUnique({ where: { id } });
    if (!existing) return errorResponse("Template not found", 404);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid request body", 400);
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.category !== undefined) data.category = body.category;
    if (body.severity !== undefined) data.severity = body.severity;
    if (body.ruleType !== undefined) data.ruleType = body.ruleType;
    if (body.language !== undefined) data.language = body.language;
    if (body.baseQuery !== undefined) data.baseQuery = body.baseQuery;
    if (body.tags !== undefined) data.tags = JSON.stringify(body.tags);
    if (body.variables !== undefined) data.variables = JSON.stringify(body.variables);
    if (body.mitreTactics !== undefined) data.mitreTactics = JSON.stringify(body.mitreTactics);

    const template = await prisma.ruleTemplate.update({ where: { id }, data });

    logAudit({
      userId: request.user.id,
      action: "TEMPLATE_UPDATED",
      targetType: "template",
      targetId: id,
      details: { fields: Object.keys(data) },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ template: parseJsonFields(template as unknown as Record<string, unknown>) });
  } catch (e) {
    console.error("Failed to update template:", e);
    return errorResponse("Failed to update template", 500);
  }
});

export const DELETE = requireRole("ADMIN")(async (request: AuthenticatedRequest, context) => {
  try {
    const { id } = await context.params as { id: string };

    const existing = await prisma.ruleTemplate.findUnique({ where: { id } });
    if (!existing) return errorResponse("Template not found", 404);

    await prisma.ruleTemplate.delete({ where: { id } });

    logAudit({
      userId: request.user.id,
      action: "TEMPLATE_DELETED",
      targetType: "template",
      targetId: id,
      details: { name: existing.name },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ message: "Template deleted" });
  } catch (e) {
    console.error("Failed to delete template:", e);
    return errorResponse("Failed to delete template", 500);
  }
});
