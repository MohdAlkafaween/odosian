import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";
import { logAudit, getClientIp } from "@/lib/audit";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatcher";
import { deriveCategoryFromTags } from "@/lib/rule-category";
import { syncRuleCategoryProject } from "@/lib/category-projects";

const PER_PAGE = 100;
const RULE_TYPE_MAP: Record<string, string> = {
  threat_match: "indicator_match",
  saved_query: "query",
};

interface ElasticThreatTechnique {
  id: string;
  name: string;
  subtechnique?: Array<{ id: string; name: string }>;
}

interface ElasticThreat {
  tactic: { id: string; name: string };
  technique?: ElasticThreatTechnique[];
}

interface ElasticRule {
  rule_id: string;
  name: string;
  description?: string;
  type: string;
  severity: string;
  risk_score: number;
  query?: string;
  language?: string;
  index?: string[];
  tags?: string[];
  enabled: boolean;
  interval?: string;
  from?: string;
  max_signals?: number;
  false_positives?: string[];
  references?: string[];
  note?: string;
  threat?: ElasticThreat[];
}

interface FindRulesResponse {
  data: ElasticRule[];
  total: number;
  page: number;
  per_page: number;
}

function mapRuleType(elasticType: string): string {
  return RULE_TYPE_MAP[elasticType] || elasticType || "query";
}

function flattenMitre(threat: ElasticThreat[] | undefined) {
  const mappings: {
    tacticId: string;
    tacticName: string;
    techniqueId: string;
    techniqueName: string;
    subTechniqueId: string | null;
    subTechniqueName: string | null;
  }[] = [];

  for (const t of threat || []) {
    if (!t.technique || t.technique.length === 0) {
      mappings.push({
        tacticId: t.tactic.id,
        tacticName: t.tactic.name,
        techniqueId: "",
        techniqueName: "",
        subTechniqueId: null,
        subTechniqueName: null,
      });
      continue;
    }
    for (const tech of t.technique) {
      if (!tech.subtechnique || tech.subtechnique.length === 0) {
        mappings.push({
          tacticId: t.tactic.id,
          tacticName: t.tactic.name,
          techniqueId: tech.id,
          techniqueName: tech.name,
          subTechniqueId: null,
          subTechniqueName: null,
        });
      } else {
        for (const sub of tech.subtechnique) {
          mappings.push({
            tacticId: t.tactic.id,
            tacticName: t.tactic.name,
            techniqueId: tech.id,
            techniqueName: tech.name,
            subTechniqueId: sub.id,
            subTechniqueName: sub.name,
          });
        }
      }
    }
  }

  return mappings;
}

export const POST = requireRole("ADMIN")(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { connectionId } = body as { connectionId?: string };

    const connection = connectionId
      ? await prisma.elasticConnection.findUnique({ where: { id: connectionId } })
      : await prisma.elasticConnection.findFirst({ where: { isActive: true } });

    if (!connection) return errorResponse("Elastic connection not found", 404);
    if (!connection.isActive) return errorResponse("Elastic connection is inactive", 400);

    const baseUrl = connection.kibanaUrl.replace(/\/+$/, "");
    const spacePrefix = connection.spaceId && connection.spaceId !== "default"
      ? `/s/${connection.spaceId}`
      : "";

    let imported = 0;
    let updated = 0;
    const errors: string[] = [];
    let page = 1;
    let total = Infinity;
    const categoryProjectCache = new Map<string, string>();

    while ((page - 1) * PER_PAGE < total) {
      const url = `${baseUrl}${spacePrefix}/api/detection_engine/rules/_find?page=${page}&per_page=${PER_PAGE}&sort_field=created_at&sort_order=asc`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      let res: Response;
      try {
        res = await fetch(url, {
          headers: {
            Authorization: `ApiKey ${connection.apiKey}`,
            "kbn-xsrf": "true",
          },
          signal: controller.signal,
        });
      } catch (fetchErr: unknown) {
        clearTimeout(timeout);
        const msg = fetchErr instanceof Error ? fetchErr.message : "Connection failed";
        return errorResponse(`Failed to reach Kibana: ${msg}`, 502);
      }
      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return errorResponse(`Kibana returned ${res.status}: ${errText.slice(0, 200)}`, 502);
      }

      const page_data: FindRulesResponse = await res.json();
      total = page_data.total;

      for (const er of page_data.data) {
        try {
          const existing = await prisma.rule.findFirst({
            where: { elasticRuleId: er.rule_id },
            select: { id: true },
          });

          const mitreMappings = flattenMitre(er.threat);

          const data = {
            title: er.name,
            description: er.description || "",
            ruleType: mapRuleType(er.type),
            severity: er.severity || "medium",
            riskScore: er.risk_score ?? 50,
            query: er.query || "",
            language: er.language || "kuery",
            index: (er.index || []).join(","),
            tags: JSON.stringify(er.tags || []),
            category: deriveCategoryFromTags(er.tags || []),
            status: er.enabled ? "production" : "draft",
            interval: er.interval || "5m",
            fromTime: er.from || "now-6m",
            maxSignals: er.max_signals ?? 100,
            falsePositives: JSON.stringify(er.false_positives || []),
            references: JSON.stringify(er.references || []),
            investigationGuide: er.note || "",
            elasticRuleId: er.rule_id,
          };

          let ruleId: string;
          if (existing) {
            await prisma.rule.update({ where: { id: existing.id }, data });
            ruleId = existing.id;
            await prisma.mitreMapping.deleteMany({ where: { ruleId } });
            updated++;
          } else {
            const created = await prisma.rule.create({
              data: { ...data, authorId: request.user.id },
            });
            ruleId = created.id;
            imported++;
          }

          if (mitreMappings.length > 0) {
            await prisma.mitreMapping.createMany({
              data: mitreMappings.map((m) => ({ ...m, ruleId })),
            });
          }

          await syncRuleCategoryProject(ruleId, data.category, request.user.id, categoryProjectCache);
        } catch (e) {
          errors.push(`${er.rule_id}: ${e instanceof Error ? e.message : "Database error"}`);
        }
      }

      page++;
    }

    await prisma.elasticConnection.update({
      where: { id: connection.id },
      data: { lastTestedAt: new Date(), lastStatus: "ok" },
    });

    logAudit({
      userId: request.user.id,
      action: "RULES_PULLED_FROM_ELASTIC",
      targetType: "rule",
      targetId: "",
      details: { imported, updated, failed: errors.length, total, connectionName: connection.name },
      ipAddress: getClientIp(request),
    });

    if (imported > 0 || updated > 0) {
      dispatchWebhookEvent("rule.created", { bulk: true, count: imported + updated, source: "elastic" });
    }

    return NextResponse.json({
      imported,
      updated,
      total,
      failed: errors.length,
      errors: errors.slice(0, 20),
    });
  } catch (e) {
    console.error("Failed to pull rules from Elastic:", e);
    return errorResponse("Failed to pull rules from Elastic", 500);
  }
});
