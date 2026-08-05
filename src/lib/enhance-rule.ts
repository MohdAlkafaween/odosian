import { prisma } from "./prisma";
import { callAI, type EnhanceResult } from "./ai";
import { analyzeRule } from "./analyze-rule";

// Mirrors the single-rule enhance route, but auto-runs an analysis first
// when the rule hasn't been analyzed yet instead of asking the caller to
// retry — the old two-step client-side fallback (see ai-tab-content.tsx)
// only worked for one rule at a time and can't drive a batch.
export async function enhanceRule(ruleId: string, userId: string) {
  const rule = await prisma.rule.findUnique({
    where: { id: ruleId },
    include: { mitreMappings: true },
  });
  if (!rule) throw new Error("Rule not found");

  let latestAnalysis = await prisma.analysis.findFirst({
    where: { ruleId: rule.id, analysisType: "analyze" },
    orderBy: { createdAt: "desc" },
  });

  if (!latestAnalysis) {
    await analyzeRule(ruleId, userId);
    latestAnalysis = await prisma.analysis.findFirst({
      where: { ruleId: rule.id, analysisType: "analyze" },
      orderBy: { createdAt: "desc" },
    });
  }
  if (!latestAnalysis) throw new Error("Could not analyze rule before enhancing it");

  const findings = JSON.parse(latestAnalysis.findings || "[]");
  const suggestions = JSON.parse(latestAnalysis.suggestions || "[]");
  const weaknesses = JSON.parse(latestAnalysis.weaknesses || "[]");

  const parse = (v: string | null) => JSON.parse(v || "[]");
  const tags: string[] = parse(rule.tags);
  const fps: string[] = parse(rule.falsePositives);
  const refs: string[] = parse(rule.references);
  const relatedIntegrations: { package: string; version: string }[] = parse(rule.relatedIntegrations);
  const requiredFields: { name: string; type: string }[] = parse(rule.requiredFields);
  const investigationFields: string[] = parse(rule.investigationFields);

  const mitreLines = rule.mitreMappings.map((m) => {
    let line = `  - ${m.tacticName} (${m.tacticId})`;
    if (m.techniqueId) line += ` > ${m.techniqueName} (${m.techniqueId})`;
    if (m.subTechniqueId) line += ` > ${m.subTechniqueName} (${m.subTechniqueId})`;
    return line;
  });

  const userMessage = `Original Rule:
Title: ${rule.title}
Description: ${rule.description}
Rule Type: ${rule.ruleType}
Severity: ${rule.severity}
Risk Score: ${rule.riskScore}
Language: ${rule.language}
Index: ${rule.index || "Not specified"}
Interval: ${rule.interval}
From Time: ${rule.fromTime}
Max Signals: ${rule.maxSignals}
Status: ${rule.status}
Category: ${rule.category || "Uncategorized"}
Source: ${rule.source}
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
${rule.query}

Analysis Score: ${latestAnalysis.score}/100 (${latestAnalysis.rating})

Findings:
${findings.map((f: { severity: string; title: string; detail: string }) => `- [${f.severity}] ${f.title}: ${f.detail}`).join("\n")}

Suggestions:
${suggestions.map((s: { priority: number; title: string; description: string }) => `- [P${s.priority}] ${s.title}: ${s.description}`).join("\n")}

Weaknesses:
${weaknesses.map((w: string) => `- ${w}`).join("\n")}`;

  const { result, modelUsed, tokensUsed, latencyMs } = await callAI<EnhanceResult>("enhance", userMessage);

  const analysis = await prisma.analysis.create({
    data: {
      ruleId: rule.id,
      analysisType: "enhance",
      inputQuery: rule.query,
      outputQuery: result.enhancedQuery || "",
      score: 0,
      rating: "",
      feedback: JSON.stringify(result.changelog || []),
      mitreMappings: JSON.stringify(result.newMitreMappings || []),
      modelUsed,
      tokensUsed,
      latencyMs,
      userId,
    },
  });

  return { analysis, result };
}
