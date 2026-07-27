import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { rateLimit } from "@/lib/middleware";
import { analyzeSchema, validateRequest } from "@/lib/validation";
import { callAI, type AnalyzeResult } from "@/lib/ai";
import { logAudit, getClientIp } from "@/lib/audit";
import { errorResponse, aiErrorResponse } from "@/lib/errors";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatcher";

const AI_RATE_LIMIT = parseInt(process.env.RATE_LIMIT_AI || "10");

interface MitreRow {
  tacticId: string;
  tacticName: string;
  techniqueId: string;
  techniqueName: string;
  subTechniqueId: string | null;
  subTechniqueName: string | null;
}

function buildRuleMessage(rule: Record<string, unknown>, mitreMappings: MitreRow[]): string {
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

export const POST = rateLimit("analysis", AI_RATE_LIMIT)(
  requireRole("DETECTION_ENG", "ADMIN")(async (request: AuthenticatedRequest) => {
    try {
      const validated = await validateRequest(analyzeSchema, request);
      if ("error" in validated) return validated.error;

      let userMessage: string;
      let ruleId: string | null = null;

      if (validated.data.ruleId) {
        const rule = await prisma.rule.findUnique({
          where: { id: validated.data.ruleId },
          include: { mitreMappings: true },
        });
        if (!rule) return errorResponse("Rule not found", 404);
        ruleId = rule.id;
        userMessage = buildRuleMessage(rule as unknown as Record<string, unknown>, rule.mitreMappings);
      } else {
        userMessage = `Detection Query (${validated.data.language || "kuery"}, ${validated.data.ruleType || "query"}):\n${validated.data.query}`;
      }

      const { result, modelUsed, tokensUsed, latencyMs } = await callAI<AnalyzeResult>("analyze", userMessage);

      const analysisType = validated.data.postEnhancement ? "post_enhance" : "analyze";

      const analysis = await prisma.analysis.create({
        data: {
          ruleId,
          analysisType,
          inputQuery: validated.data.query || "",
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
          userId: request.user.id,
        },
      });

      if (ruleId && result.mitreMappings?.length > 0) {
        await prisma.mitreMapping.deleteMany({ where: { ruleId } });
        await prisma.mitreMapping.createMany({
          data: result.mitreMappings.map((m) => ({
            ruleId: ruleId!,
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

      logAudit({
        userId: request.user.id,
        action: "ANALYSIS_CREATED",
        targetType: "analysis",
        targetId: analysis.id,
        details: { analysisType, ruleId, score: result.score },
        ipAddress: getClientIp(request),
      });

      dispatchWebhookEvent("analysis.completed", {
        analysisId: analysis.id,
        ruleId,
        score: result.score,
        rating: result.rating,
      });

      return NextResponse.json({
        analysis: {
          ...analysis,
          findings: result.findings,
          suggestions: result.suggestions,
          strengths: result.strengths,
          weaknesses: result.weaknesses,
          evasionRisks: result.evasionRisks,
          mitreMappings: result.mitreMappings,
        },
      }, { status: 201 });
    } catch (e) {
      console.error("Analysis failed:", e);
      return aiErrorResponse(e, "Analysis failed");
    }
  })
);
