import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";
import { logAudit, getClientIp } from "@/lib/audit";

interface ElasticRulePayload {
  rule_id?: string;
  name: string;
  description: string;
  type: string;
  severity: string;
  risk_score: number;
  query: string;
  language: string;
  index: string[];
  enabled: boolean;
  tags: string[];
  interval: string;
  from: string;
  max_signals: number;
  threat: ElasticThreat[];
  author: string[];
  false_positives: string[];
  references: string[];
  investigation_fields?: { field_names: string[] };
  note?: string;
}

interface ElasticThreat {
  framework: string;
  tactic: { id: string; name: string; reference: string };
  technique: Array<{
    id: string;
    name: string;
    reference: string;
    subtechnique?: Array<{ id: string; name: string; reference: string }>;
  }>;
}

function mapLanguage(lang: string): string {
  const map: Record<string, string> = {
    kuery: "kuery",
    kql: "kuery",
    eql: "eql",
    esql: "esql",
    lucene: "lucene",
  };
  return map[lang.toLowerCase()] || "kuery";
}

function mapRuleType(ruleType: string, language: string): string {
  if (ruleType === "eql" || language === "eql") return "eql";
  if (ruleType === "esql" || language === "esql") return "esql";
  if (ruleType === "threshold") return "threshold";
  if (ruleType === "machine_learning") return "machine_learning";
  return "query";
}

function buildThreatArray(
  mitreMappings: Array<{
    tacticId: string;
    tacticName: string;
    techniqueId: string;
    techniqueName: string;
    subTechniqueId: string | null;
    subTechniqueName: string | null;
  }>
): ElasticThreat[] {
  const tacticMap = new Map<string, ElasticThreat>();

  for (const m of mitreMappings) {
    const tacticRef = `https://attack.mitre.org/tactics/${m.tacticId}/`;

    if (!tacticMap.has(m.tacticId)) {
      tacticMap.set(m.tacticId, {
        framework: "MITRE ATT&CK",
        tactic: { id: m.tacticId, name: m.tacticName, reference: tacticRef },
        technique: [],
      });
    }

    const threat = tacticMap.get(m.tacticId)!;
    const techRef = `https://attack.mitre.org/techniques/${m.techniqueId.replace(".", "/")}/`;

    let technique = threat.technique.find((t) => t.id === m.techniqueId);
    if (!technique) {
      technique = { id: m.techniqueId, name: m.techniqueName, reference: techRef };
      threat.technique.push(technique);
    }

    if (m.subTechniqueId && m.subTechniqueName) {
      if (!technique.subtechnique) technique.subtechnique = [];
      const subRef = `https://attack.mitre.org/techniques/${m.subTechniqueId.replace(".", "/")}/`;
      if (!technique.subtechnique.find((s) => s.id === m.subTechniqueId)) {
        technique.subtechnique.push({
          id: m.subTechniqueId,
          name: m.subTechniqueName,
          reference: subRef,
        });
      }
    }
  }

  return Array.from(tacticMap.values());
}

export const POST = requireRole("ANALYST", "ADMIN")(async (request: AuthenticatedRequest, context) => {
  try {
    const { id } = await context.params as { id: string };
    const body = await request.json();
    const { connectionId, enabled = false, overwrite = false } = body;

    const rule = await prisma.rule.findUnique({
      where: { id },
      include: {
        mitreMappings: true,
        author: { select: { name: true } },
      },
    });
    if (!rule) return errorResponse("Rule not found", 404);

    const connection = await prisma.elasticConnection.findUnique({
      where: { id: connectionId },
    });
    if (!connection) return errorResponse("Elastic connection not found", 404);
    if (!connection.isActive) return errorResponse("Elastic connection is inactive", 400);

    const tags: string[] = JSON.parse(rule.tags || "[]");
    const falsePositives: string[] = JSON.parse(rule.falsePositives || "[]");
    const references: string[] = JSON.parse(rule.references || "[]");
    const indexPatterns = rule.index
      ? rule.index.split(",").map((s) => s.trim()).filter(Boolean)
      : ["logs-*", "filebeat-*", "winlogbeat-*"];

    const elasticType = mapRuleType(rule.ruleType, rule.language);
    const elasticLang = mapLanguage(rule.language);

    const payload: ElasticRulePayload = {
      name: rule.title,
      description: rule.description || rule.title,
      type: elasticType,
      severity: rule.severity,
      risk_score: rule.riskScore,
      query: rule.query,
      language: elasticLang,
      index: indexPatterns,
      enabled,
      tags: ["Odosian", ...tags],
      interval: rule.interval || "5m",
      from: `now-${rule.fromTime?.replace("now-", "") || "6m"}`,
      max_signals: rule.maxSignals || 100,
      threat: buildThreatArray(rule.mitreMappings),
      author: [rule.author?.name || "Odosian"].filter(Boolean),
      false_positives: falsePositives,
      references,
    };

    if (rule.investigationGuide) {
      payload.note = rule.investigationGuide;
    }

    const baseUrl = connection.kibanaUrl.replace(/\/+$/, "");
    const spacePrefix = connection.spaceId && connection.spaceId !== "default"
      ? `/s/${connection.spaceId}`
      : "";

    let url: string;
    let method: string;

    if (rule.elasticRuleId && !overwrite) {
      url = `${baseUrl}${spacePrefix}/api/detection_engine/rules`;
      method = "PUT";
      payload.rule_id = rule.elasticRuleId;
    } else if (rule.elasticRuleId && overwrite) {
      url = `${baseUrl}${spacePrefix}/api/detection_engine/rules`;
      method = "PUT";
      payload.rule_id = rule.elasticRuleId;
    } else {
      url = `${baseUrl}${spacePrefix}/api/detection_engine/rules`;
      method = "POST";
      payload.rule_id = `odosian-${rule.id}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `ApiKey ${connection.apiKey}`,
          "kbn-xsrf": "true",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const responseData = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errMsg = responseData.message
          || responseData.error
          || `Elastic returned ${res.status}`;
        return errorResponse(errMsg, 502);
      }

      const elasticRuleId = responseData.rule_id || responseData.id || payload.rule_id;

      await prisma.rule.update({
        where: { id },
        data: { elasticRuleId },
      });

      logAudit({
        userId: request.user.id,
        action: method === "POST" ? "RULE_PUSHED_TO_ELASTIC" : "RULE_UPDATED_IN_ELASTIC",
        targetType: "rule",
        targetId: id,
        details: {
          elasticRuleId,
          connectionName: connection.name,
          enabled,
        },
        ipAddress: getClientIp(request),
      });

      return NextResponse.json({
        success: true,
        elasticRuleId,
        action: method === "POST" ? "created" : "updated",
        enabled,
      });
    } catch (fetchErr: unknown) {
      clearTimeout(timeout);
      const msg = fetchErr instanceof Error ? fetchErr.message : "Connection failed";
      return errorResponse(`Failed to reach Elastic: ${msg}`, 502);
    }
  } catch (e) {
    console.error("Push to Elastic failed:", e);
    return errorResponse("Failed to push rule to Elastic", 500);
  }
});
