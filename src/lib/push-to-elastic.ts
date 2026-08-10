import { prisma } from "./prisma";
import { HttpError } from "./errors";
import { logAudit } from "./audit";
import { elasticFetch, type ElasticFetchResponse } from "./elastic-fetch";
import { deriveRequiredFields } from "./required-fields";
import { setElasticRuleEnabled } from "./elastic-rule-status";

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
  license?: string;
  timestamp_override?: string;
  related_integrations?: Array<{ package: string; version: string }>;
  required_fields?: Array<{ name: string; type: string }>;
  timeline_id?: string;
  timeline_title?: string;
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

export interface PushToElasticResult {
  success: true;
  elasticRuleId: string;
  action: "created" | "updated";
  duplicated: boolean;
  oldRuleDisabled: boolean;
  enabled: boolean;
}

// Shared by the single-rule push-elastic route and the batch review
// bulk-deploy endpoint.
export async function pushRuleToElastic(
  ruleId: string,
  connectionId: string,
  enabled: boolean,
  userId: string,
  ipAddress?: string
): Promise<PushToElasticResult> {
  const rule = await prisma.rule.findUnique({
    where: { id: ruleId },
    include: {
      mitreMappings: true,
      author: { select: { name: true } },
    },
  });
  if (!rule) throw new HttpError("Rule not found", 404);

  const connection = await prisma.elasticConnection.findUnique({ where: { id: connectionId } });
  if (!connection) throw new HttpError("Elastic connection not found", 404);
  if (!connection.isActive) throw new HttpError("Elastic connection is inactive", 400);

  const tags: string[] = JSON.parse(rule.tags || "[]");
  const falsePositives: string[] = JSON.parse(rule.falsePositives || "[]");
  const references: string[] = JSON.parse(rule.references || "[]");
  const relatedIntegrations: Array<{ package: string; version: string }> = JSON.parse(rule.relatedIntegrations || "[]");
  // Computed fresh from the current query rather than trusting the stored
  // column — guarantees this always reflects what the rule actually does,
  // never a stale or hand-typed value.
  const requiredFields = deriveRequiredFields(rule.query);
  const investigationFields: string[] = JSON.parse(rule.investigationFields || "[]");
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
    tags: ["Data Source: Odosian", ...tags],
    interval: rule.interval || "5m",
    from: `now-${rule.fromTime?.replace("now-", "") || "6m"}`,
    max_signals: rule.maxSignals || 100,
    threat: buildThreatArray(rule.mitreMappings),
    author: [rule.author?.name || "Odosian"].filter(Boolean),
    false_positives: falsePositives,
    references,
  };

  if (rule.investigationGuide) payload.note = rule.investigationGuide;
  if (rule.license) payload.license = rule.license;
  if (rule.timestampOverride) payload.timestamp_override = rule.timestampOverride;
  if (relatedIntegrations.length > 0) payload.related_integrations = relatedIntegrations;
  if (requiredFields.length > 0) payload.required_fields = requiredFields;
  if (rule.timelineId) payload.timeline_id = rule.timelineId;
  if (rule.timelineTitle) payload.timeline_title = rule.timelineTitle;
  if (investigationFields.length > 0) payload.investigation_fields = { field_names: investigationFields };

  const baseUrl = connection.kibanaUrl.replace(/\/+$/, "");
  const spacePrefix = connection.spaceId && connection.spaceId !== "default"
    ? `/s/${connection.spaceId}`
    : "";

  const url = `${baseUrl}${spacePrefix}/api/detection_engine/rules`;

  // Odosian only ever PUT-updates a rule it created itself (rule_id prefixed
  // "odosian-"). Anything pulled in from Elastic — prebuilt or otherwise —
  // is never edited in place: pushing it duplicates it into a new custom
  // rule instead, then disables the original so the duplicate is the one
  // that's live. This sidesteps Kibana's immutable-rule field restrictions
  // entirely and means Odosian never silently rewrites a rule someone else
  // (or Elastic itself) manages.
  const isOwnRule = !!rule.elasticRuleId?.startsWith("odosian-");
  const isDuplicating = !!rule.elasticRuleId && !isOwnRule;
  const method = rule.elasticRuleId && isOwnRule ? "PUT" : "POST";
  payload.rule_id = method === "PUT" ? rule.elasticRuleId! : `odosian-${rule.id}`;

  let res: ElasticFetchResponse;
  try {
    res = await elasticFetch(
      url,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `ApiKey ${connection.apiKey}`,
          "kbn-xsrf": "true",
        },
        body: JSON.stringify(payload),
        timeoutMs: 15000,
      },
      connection.verifySsl
    );
  } catch (fetchErr: unknown) {
    const msg = fetchErr instanceof Error ? fetchErr.message : "Connection failed";
    throw new HttpError(`Failed to reach Elastic: ${msg}`, 502);
  }

  const responseData = (await res.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
    rule_id?: string;
    id?: string;
  };

  if (!res.ok) {
    const errMsg = responseData.message || responseData.error || `Elastic returned ${res.status}`;
    throw new HttpError(errMsg, 502);
  }

  const elasticRuleId = responseData.rule_id || responseData.id || payload.rule_id!;

  let oldRuleDisabled = false;
  if (isDuplicating) {
    // Best-effort: Kibana allows toggling `enabled` via PATCH even when a
    // rule is immutable (unlike PUT, which rejects content-field changes
    // on prebuilt rules). Failure here doesn't fail the push; the new
    // duplicate was already created successfully.
    oldRuleDisabled = await setElasticRuleEnabled(
      baseUrl,
      spacePrefix,
      connection.apiKey,
      rule.elasticRuleId!,
      false,
      connection.verifySsl
    );
  }

  const analysisTypes = await prisma.analysis.findMany({
    where: { ruleId },
    select: { analysisType: true },
    distinct: ["analysisType"],
  });
  const types = new Set(analysisTypes.map((a) => a.analysisType));
  const autoCover = types.has("analyze") && types.has("enhance");

  await prisma.rule.update({
    where: { id: ruleId },
    data: {
      elasticRuleId,
      elasticEnabled: enabled,
      elasticConnectionId: connectionId,
      ...(autoCover ? { covered: true, coveredAt: new Date() } : {}),
    },
  });

  logAudit({
    userId,
    action: method === "POST" ? "RULE_PUSHED_TO_ELASTIC" : "RULE_UPDATED_IN_ELASTIC",
    targetType: "rule",
    targetId: ruleId,
    details: {
      elasticRuleId,
      connectionName: connection.name,
      enabled,
      duplicated: isDuplicating,
      oldRuleDisabled,
    },
    ipAddress,
  });

  return {
    success: true,
    elasticRuleId,
    action: method === "POST" ? "created" : "updated",
    duplicated: isDuplicating,
    oldRuleDisabled,
    enabled,
  };
}
