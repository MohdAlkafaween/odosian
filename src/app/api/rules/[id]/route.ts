import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { ruleUpdateSchema, validateRequest } from "@/lib/validation";
import { logAudit, getClientIp } from "@/lib/audit";
import { errorResponse } from "@/lib/errors";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatcher";
import { syncRuleCategoryProject } from "@/lib/category-projects";

function parseJsonFields(rule: Record<string, unknown>) {
  return {
    ...rule,
    tags: JSON.parse((rule.tags as string) || "[]"),
    falsePositives: JSON.parse((rule.falsePositives as string) || "[]"),
    references: JSON.parse((rule.references as string) || "[]"),
  };
}

export const GET = authenticate(async (request: AuthenticatedRequest, context) => {
  try {
    const { id } = await context.params as { id: string };

    const rule = await prisma.rule.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, email: true } },
        mitreMappings: true,
        customFields: { select: { fieldName: true, fieldValue: true, fieldType: true } },
        _count: { select: { analyses: true } },
      },
    });

    if (!rule) return errorResponse("Rule not found", 404);

    return NextResponse.json({ rule: parseJsonFields(rule as unknown as Record<string, unknown>) });
  } catch (e) {
    console.error("Failed to fetch rule:", e);
    return errorResponse("Failed to fetch rule", 500);
  }
});

export const PUT = requireRole("ANALYST", "ADMIN")(async (request: AuthenticatedRequest, context) => {
  try {
    const { id } = await context.params as { id: string };

    const existing = await prisma.rule.findUnique({ where: { id } });
    if (!existing) return errorResponse("Rule not found", 404);

    if (existing.authorId !== request.user.id && request.user.role !== "ADMIN") {
      return errorResponse("You can only edit your own rules", 403);
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid request body", 400);
    }

    const customFields = body.customFields as Array<{ fieldName: string; fieldValue: string; fieldType?: string }> | undefined;
    delete body.customFields;

    const ruleBody = new Request(request.url, {
      method: "PUT",
      headers: request.headers,
      body: JSON.stringify(body),
    });

    const validated = await validateRequest(ruleUpdateSchema, ruleBody);
    if ("error" in validated) return validated.error;

    const { tags, falsePositives, references, ...rest } = validated.data;
    const data: Record<string, unknown> = { ...rest, version: existing.version + 1 };

    if (tags !== undefined) data.tags = JSON.stringify(tags);
    if (falsePositives !== undefined) data.falsePositives = JSON.stringify(falsePositives);
    if (references !== undefined) data.references = JSON.stringify(references);

    const rule = await prisma.rule.update({
      where: { id },
      data,
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    if (customFields && Array.isArray(customFields)) {
      for (const cf of customFields) {
        await prisma.ruleCustomField.upsert({
          where: { ruleId_fieldName: { ruleId: id, fieldName: cf.fieldName } },
          update: { fieldValue: cf.fieldValue, fieldType: cf.fieldType || "text" },
          create: { ruleId: id, fieldName: cf.fieldName, fieldValue: cf.fieldValue, fieldType: cf.fieldType || "text" },
        });
      }
    }

    if (rule.category) {
      await syncRuleCategoryProject(rule.id, rule.category, request.user.id);
    }

    logAudit({
      userId: request.user.id,
      action: "RULE_UPDATED",
      targetType: "rule",
      targetId: id,
      details: { fields: Object.keys(validated.data) },
      ipAddress: getClientIp(request),
    });

    dispatchWebhookEvent("rule.updated", { ruleId: id, title: rule.title });

    return NextResponse.json({ rule: parseJsonFields(rule as Record<string, unknown>) });
  } catch (e) {
    console.error("Failed to update rule:", e);
    return errorResponse("Failed to update rule", 500);
  }
});

export const DELETE = requireRole("ANALYST", "ADMIN")(async (request: AuthenticatedRequest, context) => {
  try {
    const { id } = await context.params as { id: string };

    const existing = await prisma.rule.findUnique({ where: { id } });
    if (!existing) return errorResponse("Rule not found", 404);

    if (existing.authorId !== request.user.id && request.user.role !== "ADMIN") {
      return errorResponse("You can only delete your own rules", 403);
    }

    await prisma.rule.delete({ where: { id } });

    logAudit({
      userId: request.user.id,
      action: "RULE_DELETED",
      targetType: "rule",
      targetId: id,
      details: { title: existing.title },
      ipAddress: getClientIp(request),
    });

    dispatchWebhookEvent("rule.deleted", { ruleId: id, title: existing.title });

    return NextResponse.json({ message: "Rule deleted" });
  } catch (e) {
    console.error("Failed to delete rule:", e);
    return errorResponse("Failed to delete rule", 500);
  }
});
