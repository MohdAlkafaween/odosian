import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, rateLimit, type AuthenticatedRequest } from "@/lib/middleware";
import { enhanceSchema, validateRequest } from "@/lib/validation";
import { callAI, type EnhanceResult } from "@/lib/ai";
import { logAudit, getClientIp } from "@/lib/audit";
import { errorResponse, aiErrorResponse } from "@/lib/errors";

const AI_RATE_LIMIT = parseInt(process.env.RATE_LIMIT_AI || "10");

export const POST = rateLimit("analysis", AI_RATE_LIMIT)(
  requireRole("DETECTION_ENG", "ADMIN")(async (request: AuthenticatedRequest) => {
    try {
      const validated = await validateRequest(enhanceSchema, request);
      if ("error" in validated) return validated.error;

      const rule = await prisma.rule.findUnique({
        where: { id: validated.data.ruleId },
        include: { mitreMappings: true },
      });
      if (!rule) return errorResponse("Rule not found", 404);

      const latestAnalysis = await prisma.analysis.findFirst({
        where: { ruleId: rule.id, analysisType: "analyze" },
        orderBy: { createdAt: "desc" },
      });

      if (!latestAnalysis) {
        return errorResponse("Please analyze the rule first before enhancing it", 400);
      }

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
          userId: request.user.id,
        },
      });

      logAudit({
        userId: request.user.id,
        action: "ANALYSIS_CREATED",
        targetType: "analysis",
        targetId: analysis.id,
        details: { analysisType: "enhance", ruleId: rule.id },
        ipAddress: getClientIp(request),
      });

      return NextResponse.json({ analysis: { ...analysis, ...result } }, { status: 201 });
    } catch (e) {
      console.error("Enhancement failed:", e);
      return aiErrorResponse(e, "Enhancement failed");
    }
  })
);
