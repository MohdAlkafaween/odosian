import { prisma } from "./prisma";
import { logAudit } from "./audit";
import { HttpError } from "./errors";

const ODOSIAN_PREFIX = "#odosian ";

export interface ApplyEnhancementInput {
  enhancedTitle?: string;
  enhancedDescription?: string;
  enhancedQuery?: string;
  newSeverity?: string;
  newRiskScore?: number;
  investigationGuide?: string;
  falsePositives?: string[];
  references?: string[];
  indexPatterns?: string[];
}

// Shared by the single-rule apply-enhancement route and the batch review
// bulk-apply endpoint — writes an Enhance result onto its rule (a rule is
// never touched by an enhancement until this runs; enhance itself only ever
// produces a preview). Rules that originated from an AI "Generate" get
// "#odosian " prepended to their title here, once, marking them as
// AI-authored content that's been through a human-reviewed enhancement pass.
export async function applyEnhancementToRule(
  ruleId: string,
  userId: string,
  isAdmin: boolean,
  body: ApplyEnhancementInput,
  ipAddress?: string
): Promise<{ title: string }> {
  const existing = await prisma.rule.findUnique({ where: { id: ruleId } });
  if (!existing) throw new HttpError("Rule not found", 404);

  if (existing.authorId !== userId && !isAdmin) {
    throw new HttpError("You can only edit your own rules", 403);
  }

  await prisma.ruleVersion.create({
    data: {
      ruleId,
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
      changedBy: userId,
    },
  });

  let title = body.enhancedTitle?.trim() || existing.title;
  if (existing.source === "generated" && !title.startsWith(ODOSIAN_PREFIX)) {
    title = `${ODOSIAN_PREFIX}${title}`;
  }

  const data: Record<string, unknown> = {
    title,
    version: existing.version + 1,
  };

  if (body.enhancedDescription !== undefined) data.description = String(body.enhancedDescription);
  if (body.enhancedQuery !== undefined) data.query = String(body.enhancedQuery);
  if (body.newSeverity !== undefined) data.severity = String(body.newSeverity);
  if (body.newRiskScore !== undefined) {
    const riskScore = Math.round(Number(body.newRiskScore));
    if (Number.isFinite(riskScore)) {
      data.riskScore = Math.min(100, Math.max(0, riskScore));
    }
  }
  if (body.investigationGuide !== undefined) data.investigationGuide = String(body.investigationGuide);
  if (body.falsePositives !== undefined) data.falsePositives = JSON.stringify(Array.isArray(body.falsePositives) ? body.falsePositives : []);
  if (body.references !== undefined) data.references = JSON.stringify(Array.isArray(body.references) ? body.references : []);
  if (body.indexPatterns !== undefined && Array.isArray(body.indexPatterns)) data.index = body.indexPatterns.join(", ");

  const rule = await prisma.rule.update({ where: { id: ruleId }, data });

  logAudit({
    userId,
    action: "RULE_ENHANCEMENT_APPLIED",
    targetType: "rule",
    targetId: ruleId,
    details: { title },
    ipAddress,
  });

  return { title: rule.title };
}
