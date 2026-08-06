import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { ruleUpdateSchema, validateRequest } from "@/lib/validation";
import { logAudit, getClientIp } from "@/lib/audit";
import { errorResponse } from "@/lib/errors";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatcher";
import { syncRuleCategoryProject } from "@/lib/category-projects";
import { deriveRequiredFields } from "@/lib/required-fields";

function parseJsonFields(rule: Record<string, unknown>) {
  return {
    ...rule,
    tags: JSON.parse((rule.tags as string) || "[]"),
    falsePositives: JSON.parse((rule.falsePositives as string) || "[]"),
    references: JSON.parse((rule.references as string) || "[]"),
    relatedIntegrations: JSON.parse((rule.relatedIntegrations as string) || "[]"),
    requiredFields: JSON.parse((rule.requiredFields as string) || "[]"),
    investigationFields: JSON.parse((rule.investigationFields as string) || "[]"),
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
        analyses: { select: { analysisType: true }, distinct: ["analysisType"] },
        _count: { select: { analyses: true } },
      },
    });

    if (!rule) return errorResponse("Rule not found", 404);

    const types = new Set(rule.analyses.map((a) => a.analysisType));
    const { analyses: _a, ...rest } = rule;
    void _a;

    return NextResponse.json({
      rule: {
        ...parseJsonFields(rest as unknown as Record<string, unknown>),
        aiFlags: {
          analyzed: types.has("analyze"),
          enhanced: types.has("enhance"),
          feedback: types.has("feedback"),
          generated: rule.source === "generated",
          deployed: types.has("analyze") && types.has("enhance") && !!rule.elasticRuleId && rule.elasticEnabled,
        },
      },
    });
  } catch (e) {
    console.error("Failed to fetch rule:", e);
    return errorResponse("Failed to fetch rule", 500);
  }
});

export const PUT = requireRole("DETECTION_ENG", "ADMIN")(async (request: AuthenticatedRequest, context) => {
  try {
    const { id } = await context.params as { id: string };

    const existing = await prisma.rule.findUnique({ where: { id } });
    if (!existing) return errorResponse("Rule not found", 404);

    if (existing.authorId !== request.user.id && request.user.role !== "ADMIN") {
      return errorResponse("You can only edit your own rules", 403);
    }

    await prisma.ruleVersion.create({
      data: {
        ruleId: id,
        version: existing.version,
        title: existing.title,
        description: existing.description,
        query: existing.query,
        severity: existing.severity,
        riskScore: existing.riskScore,
        ruleType: existing.ruleType,
        language: existing.language,
        index: existing.index,
        tags: existing.tags,
        status: existing.status,
        interval: existing.interval,
        fromTime: existing.fromTime,
        maxSignals: existing.maxSignals,
        investigationGuide: existing.investigationGuide,
        falsePositives: existing.falsePositives,
        references: existing.references,
        changedBy: request.user.id,
      },
    });

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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tags, falsePositives, references, relatedIntegrations, requiredFields: _requiredFields, investigationFields, ...rest } = validated.data;
    const data: Record<string, unknown> = { ...rest, version: existing.version + 1 };

    if (tags !== undefined) data.tags = JSON.stringify(tags);
    if (falsePositives !== undefined) data.falsePositives = JSON.stringify(falsePositives);
    if (references !== undefined) data.references = JSON.stringify(references);
    if (relatedIntegrations !== undefined) data.relatedIntegrations = JSON.stringify(relatedIntegrations);
    if (investigationFields !== undefined) data.investigationFields = JSON.stringify(investigationFields);
    // Never trust a client-supplied value — always the real, current fields
    // the (possibly just-updated) query actually references.
    data.requiredFields = JSON.stringify(deriveRequiredFields((rest.query as string | undefined) ?? existing.query));

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

export const DELETE = requireRole("DETECTION_ENG", "ADMIN")(async (request: AuthenticatedRequest, context) => {
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
