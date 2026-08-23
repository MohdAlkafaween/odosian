import { prisma } from "./prisma";
import { callAI, type AnalyzeResult } from "./ai";
import { engineAnalyze, EngineUnavailableError } from "./engine-client";
import { maybeAdvanceRuleStatus } from "./rule-status";

interface MitreRow {
  tacticId: string;
  tacticName: string;
  techniqueId: string;
  techniqueName: string;
  subTechniqueId: string | null;
  subTechniqueName: string | null;
}

// Serialize a Prisma rule into the JSON format the engine's Elastic parser expects.
export function buildRuleJson(rule: Record<string, unknown>, mitreMappings: MitreRow[]): string {
  const parse = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v || []);
  const tags: string[] = parse(rule.tags);
  const fps: string[] = parse(rule.falsePositives);
  const refs: string[] = parse(rule.references);
  const indexRaw = rule.index as string | undefined;
  const indices = indexRaw ? indexRaw.split(",").map((s: string) => s.trim()).filter(Boolean) : [];

  // Build Elastic-format threat array from MITRE mappings
  const tacticGroups = new Map<string, { tactic: { id: string; name: string }; techniques: Map<string, { id: string; name: string; subtechniques: { id: string; name: string }[] }> }>();
  for (const m of mitreMappings) {
    if (!tacticGroups.has(m.tacticId)) {
      tacticGroups.set(m.tacticId, { tactic: { id: m.tacticId, name: m.tacticName }, techniques: new Map() });
    }
    const group = tacticGroups.get(m.tacticId)!;
    if (m.techniqueId && !group.techniques.has(m.techniqueId)) {
      group.techniques.set(m.techniqueId, { id: m.techniqueId, name: m.techniqueName, subtechniques: [] });
    }
    if (m.techniqueId && m.subTechniqueId) {
      group.techniques.get(m.techniqueId)!.subtechniques.push({ id: m.subTechniqueId, name: m.subTechniqueName || "" });
    }
  }
  const threat = Array.from(tacticGroups.values()).map((g) => ({
    tactic: g.tactic,
    technique: Array.from(g.techniques.values()).map((t) => ({
      id: t.id,
      name: t.name,
      subtechnique: t.subtechniques.length > 0 ? t.subtechniques : undefined,
    })),
  }));

  return JSON.stringify({
    name: rule.title,
    description: rule.description || "",
    rule_id: rule.elasticRuleId || rule.id,
    type: rule.ruleType,
    severity: rule.severity,
    risk_score: rule.riskScore,
    query: rule.query,
    language: rule.language,
    index: indices,
    tags,
    false_positives: fps,
    references: refs,
    threat: threat.length > 0 ? threat : undefined,
  });
}

export function buildRuleMessage(rule: Record<string, unknown>, mitreMappings: MitreRow[]): string {
  const parse = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v || []);
  const tags: string[] = parse(rule.tags);
  const fps: string[] = parse(rule.falsePositives);
  const refs: string[] = parse(rule.references);
  const relatedIntegrations: { package: string; version: string }[] = parse(rule.relatedIntegrations);
  const requiredFields: { name: string; type: string }[] = parse(rule.requiredFields);
  const investigationFields: string[] = parse(rule.investigationFields);

  const mitreLines = mitreMappings.map((m) => {
    let line = `  - ${m.tacticName} (${m.tacticId})`;
    if (m.techniqueId) line += ` > ${m.techniqueName} (${m.techniqueId})`;
    if (m.subTechniqueId) line += ` > ${m.subTechniqueName} (${m.subTechniqueId})`;
    return line;
  });

  return `Rule Title: ${rule.title}
Description: ${rule.description || "None"}
Rule Type: ${rule.ruleType}
Severity: ${rule.severity}
Risk Score: ${rule.riskScore}
Language: ${rule.language}
Index Patterns: ${rule.index || "Not specified"}
Interval: ${rule.interval}
From Time: ${rule.fromTime}
Max Signals: ${rule.maxSignals}
Status: ${rule.status || "draft"}
Category: ${rule.category || "Uncategorized"}
Source: ${rule.source || "manual"}
License: ${rule.license || "None"}
Timestamp Override: ${rule.timestampOverride || "None"}
Tags: ${tags.length > 0 ? tags.join(", ") : "None"}
Investigation Guide: ${rule.investigationGuide || "None"}
False Positives: ${fps.length > 0 ? fps.join("; ") : "None documented"}
References: ${refs.length > 0 ? refs.join(", ") : "None"}
Related Integrations: ${relatedIntegrations.length > 0 ? relatedIntegrations.map((i) => `${i.package}@${i.version}`).join(", ") : "None"}
Required Fields: ${requiredFields.length > 0 ? requiredFields.map((f) => `${f.name} (${f.type})`).join(", ") : "None"}
Investigation Fields: ${investigationFields.length > 0 ? investigationFields.join(", ") : "None"}
Timeline: ${rule.timelineTitle || "None"}
Elastic Rule ID: ${rule.elasticRuleId || "Not deployed"}
MITRE ATT&CK Mappings:
${mitreLines.length > 0 ? mitreLines.join("\n") : "  None"}

Detection Query:
${rule.query}`;
}

async function persistAnalysis(
  ruleId: string,
  userId: string,
  analysisType: "analyze" | "post_enhance",
  inputQuery: string,
  result: AnalyzeResult,
  modelUsed: string,
  tokensUsed: number,
  latencyMs: number
) {
  const analysis = await prisma.analysis.create({
    data: {
      ruleId,
      analysisType,
      inputQuery,
      score: result.score || 0,
      rating: result.rating || "",
      feedback: result.feedback || "",
      findings: JSON.stringify(result.findings || []),
      suggestions: JSON.stringify(result.suggestions || []),
      strengths: JSON.stringify(result.strengths || []),
      weaknesses: JSON.stringify(result.weaknesses || []),
      evasionRisks: JSON.stringify(result.evasionRisks || []),
      mitreMappings: JSON.stringify(result.mitreMappings || []),
      fpRisk: result.fpRisk || "low",
      modelUsed,
      tokensUsed,
      latencyMs,
      userId,
    },
  });

  if (result.mitreMappings?.length > 0) {
    await prisma.mitreMapping.deleteMany({ where: { ruleId } });
    await prisma.mitreMapping.createMany({
      data: result.mitreMappings.map((m) => ({
        ruleId,
        tacticId: m.tacticId,
        tacticName: m.tacticName,
        techniqueId: m.techniqueId,
        techniqueName: m.techniqueName,
        subTechniqueId: m.subTechniqueId,
        subTechniqueName: m.subTechniqueName,
        confidence: m.confidence,
      })),
    });
  }

  if (analysisType === "analyze") await maybeAdvanceRuleStatus(ruleId);

  return analysis;
}

// Runs a full "analyze" pass against an existing rule and persists the
// Analysis row + MITRE mappings. Shared by the single-rule analyze route and
// the batch processor so both stay in sync.
export async function analyzeRule(ruleId: string, userId: string) {
  const rule = await prisma.rule.findUnique({
    where: { id: ruleId },
    include: { mitreMappings: true },
  });
  if (!rule) throw new Error("Rule not found");

  const ruleObj = rule as unknown as Record<string, unknown>;
  const ruleJson = buildRuleJson(ruleObj, rule.mitreMappings);
  const ruleMessage = buildRuleMessage(ruleObj, rule.mitreMappings);

  let result: AnalyzeResult;
  let modelUsed: string;
  let tokensUsed: number;
  let latencyMs: number;

  try {
    const engineResult = await engineAnalyze({
      user_id: userId,
      rule_text: ruleJson,
      rule_id: ruleId,
    });
    result = engineResult.result;
    modelUsed = engineResult.modelUsed;
    tokensUsed = engineResult.tokensUsed;
    latencyMs = engineResult.latencyMs;
  } catch (e) {
    if (e instanceof EngineUnavailableError) {
      const fallback = await callAI<AnalyzeResult>("analyze", ruleMessage);
      result = fallback.result;
      modelUsed = fallback.modelUsed;
      tokensUsed = fallback.tokensUsed;
      latencyMs = fallback.latencyMs;
    } else {
      throw e;
    }
  }

  const analysis = await persistAnalysis(rule.id, userId, "analyze", rule.query, result, modelUsed, tokensUsed, latencyMs);
  return { analysis, result };
}

// Compares a rule's original query against an already-enhanced one and
// scores the improvement. Shared by the single-rule "Analyze After
// Enhancement" action and the batch equivalent.
export async function postEnhanceAnalyzeRule(ruleId: string, userId: string, enhancedQuery: string) {
  const rule = await prisma.rule.findUnique({
    where: { id: ruleId },
    include: { mitreMappings: true },
  });
  if (!rule) throw new Error("Rule not found");

  const originalQuery = rule.query;
  const ruleObj = { ...(rule as unknown as Record<string, unknown>), query: enhancedQuery };
  const ruleJson = buildRuleJson(ruleObj, rule.mitreMappings);
  const postEnhanceMessage = `This is a POST-ENHANCEMENT analysis. Compare the original query against the enhanced query and evaluate the improvements.

${buildRuleMessage(ruleObj, rule.mitreMappings)}

Original Query (before enhancement):
${originalQuery}`;

  let result: AnalyzeResult;
  let modelUsed: string;
  let tokensUsed: number;
  let latencyMs: number;

  try {
    const engineResult = await engineAnalyze({
      user_id: userId,
      rule_text: ruleJson,
      rule_id: ruleId,
    });
    result = engineResult.result;
    modelUsed = engineResult.modelUsed;
    tokensUsed = engineResult.tokensUsed;
    latencyMs = engineResult.latencyMs;
  } catch (e) {
    if (e instanceof EngineUnavailableError) {
      const fallback = await callAI<AnalyzeResult>("analyze", postEnhanceMessage);
      result = fallback.result;
      modelUsed = fallback.modelUsed;
      tokensUsed = fallback.tokensUsed;
      latencyMs = fallback.latencyMs;
    } else {
      throw e;
    }
  }

  const analysis = await persistAnalysis(rule.id, userId, "post_enhance", enhancedQuery, result, modelUsed, tokensUsed, latencyMs);
  return { analysis, result };
}
