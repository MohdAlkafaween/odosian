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

export const GET = authenticate(async (request: AuthenticatedRequest) => {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const category = url.searchParams.get("category") || "";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }
    if (category) where.category = category;

    const templates = await prisma.ruleTemplate.findMany({
      where,
      orderBy: { category: "asc" },
    });

    const categories = [...new Set(templates.map((t) => t.category))].sort();

    return NextResponse.json({
      templates: templates.map((t) => parseJsonFields(t as unknown as Record<string, unknown>)),
      categories,
    });
  } catch (e) {
    console.error("Failed to fetch templates:", e);
    return errorResponse("Failed to fetch templates", 500);
  }
});

export const POST = requireRole("ADMIN")(async (request: AuthenticatedRequest) => {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid request body", 400);
    }

    const name = (body.name as string)?.trim();
    const baseQuery = (body.baseQuery as string)?.trim();
    if (!name) return errorResponse("name is required", 400);
    if (!baseQuery) return errorResponse("baseQuery is required", 400);

    const data: Record<string, unknown> = {
      name,
      baseQuery,
    };
    if (body.description !== undefined) data.description = body.description;
    if (body.category !== undefined) data.category = body.category;
    if (body.severity !== undefined) data.severity = body.severity;
    if (body.ruleType !== undefined) data.ruleType = body.ruleType;
    if (body.language !== undefined) data.language = body.language;
    if (body.tags !== undefined) data.tags = JSON.stringify(body.tags);
    if (body.variables !== undefined) data.variables = JSON.stringify(body.variables);
    if (body.mitreTactics !== undefined) data.mitreTactics = JSON.stringify(body.mitreTactics);

    const template = await prisma.ruleTemplate.create({
      data: data as { name: string; baseQuery: string },
    });

    logAudit({
      userId: request.user.id,
      action: "TEMPLATE_CREATED",
      targetType: "template",
      targetId: template.id,
      details: { name },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ template: parseJsonFields(template as unknown as Record<string, unknown>) }, { status: 201 });
  } catch (e) {
    console.error("Failed to create template:", e);
    return errorResponse("Failed to create template", 500);
  }
});
