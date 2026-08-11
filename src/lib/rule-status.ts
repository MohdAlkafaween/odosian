import { prisma } from "./prisma";

const STATUS_RANK: Record<string, number> = { draft: 0, reviewed: 1, production: 2 };

// Automatic status transitions, confirmed scope: analysis completing bumps
// a rule to "reviewed", and the same condition the green "Deployed" AI-stage
// badge already uses (analyzed + enhanced + pushed + enabled in Elastic)
// bumps it to "production". Never runs against "deprecated" — that's a
// terminal state only markRuleDeprecated sets — and never moves status
// backward, so a rule someone already pushed forward manually (or that's
// already further along than what just happened) is left alone.
export async function maybeAdvanceRuleStatus(ruleId: string): Promise<void> {
  const rule = await prisma.rule.findUnique({
    where: { id: ruleId },
    select: { status: true, elasticRuleId: true, elasticEnabled: true },
  });
  if (!rule || rule.status === "deprecated") return;

  const currentRank = STATUS_RANK[rule.status] ?? 0;

  const analysisTypes = await prisma.analysis.findMany({
    where: { ruleId },
    select: { analysisType: true },
    distinct: ["analysisType"],
  });
  const types = new Set(analysisTypes.map((a) => a.analysisType));
  // Matches the existing "Analyzed"/"Deployed" AI-stage badge definitions
  // exactly (types.has("analyze") && types.has("enhance")) — deliberately
  // not counting post_enhance/generate/simulate here, for the same reason
  // those badges don't either.
  const hasAnalyzed = types.has("analyze");
  const isProduction = hasAnalyzed && types.has("enhance") && !!rule.elasticRuleId && rule.elasticEnabled;

  const target = isProduction ? "production" : hasAnalyzed ? "reviewed" : null;
  if (target && STATUS_RANK[target] > currentRank) {
    await prisma.rule.update({ where: { id: ruleId }, data: { status: target } });
  }
}

// Explicit removal from Elastic is a strong, deliberate signal — unlike the
// forward-only bumps above, this always sets the terminal state (a no-op if
// it's already there) regardless of current status.
export async function markRuleDeprecated(ruleId: string): Promise<void> {
  await prisma.rule.update({ where: { id: ruleId }, data: { status: "deprecated" } });
}
