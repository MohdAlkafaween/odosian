import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { ruleCreateSchema } from "@/lib/validation";
import { logAudit, getClientIp } from "@/lib/audit";
import { errorResponse } from "@/lib/errors";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatcher";
import { deriveRequiredFields } from "@/lib/required-fields";

const MAX_IMPORT = 100;

export const POST = requireRole("ANALYST", "ADMIN")(async (request: AuthenticatedRequest) => {
  try {
    const contentType = request.headers.get("content-type") || "";
    let rawRules: unknown[];

    if (contentType.includes("application/x-ndjson")) {
      const text = await request.text();
      rawRules = text
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          try { return JSON.parse(line); } catch { return null; }
        })
        .filter(Boolean);
    } else {
      const body = await request.json();
      rawRules = Array.isArray(body) ? body : body.rules;
      if (!Array.isArray(rawRules)) {
        return errorResponse("Expected { rules: [...] } or an array of rules", 400);
      }
    }

    if (rawRules.length === 0) {
      return errorResponse("No rules to import", 400);
    }
    if (rawRules.length > MAX_IMPORT) {
      return errorResponse(`Maximum ${MAX_IMPORT} rules per import`, 400);
    }

    let imported = 0;
    const errors: string[] = [];

    for (let i = 0; i < rawRules.length; i++) {
      const raw = rawRules[i];
      const result = ruleCreateSchema.safeParse(raw);

      if (!result.success) {
        const msg = result.error.issues.map((issue) => issue.message).join(", ");
        errors.push(`Rule ${i + 1}: ${msg}`);
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tags, falsePositives, references, relatedIntegrations, requiredFields: _requiredFields, investigationFields, ...rest } = result.data;

      try {
        await prisma.rule.create({
          data: {
            ...rest,
            tags: JSON.stringify(tags),
            falsePositives: JSON.stringify(falsePositives),
            references: JSON.stringify(references),
            relatedIntegrations: JSON.stringify(relatedIntegrations),
            requiredFields: JSON.stringify(deriveRequiredFields(result.data.query)),
            investigationFields: JSON.stringify(investigationFields),
            authorId: request.user.id,
          },
        });
        imported++;
      } catch (e) {
        errors.push(`Rule ${i + 1}: ${e instanceof Error ? e.message : "Database error"}`);
      }
    }

    logAudit({
      userId: request.user.id,
      action: "RULES_IMPORTED",
      targetType: "rule",
      targetId: "",
      details: { imported, failed: errors.length, total: rawRules.length },
      ipAddress: getClientIp(request),
    });

    if (imported > 0) {
      dispatchWebhookEvent("rule.created", { bulk: true, count: imported });
    }

    return NextResponse.json({
      imported,
      failed: errors.length,
      total: rawRules.length,
      errors: errors.slice(0, 20),
    });
  } catch (e) {
    console.error("Failed to import rules:", e);
    return errorResponse("Failed to import rules", 500);
  }
});
