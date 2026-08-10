import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";
import { applyEnhancementToRule, type ApplyEnhancementInput } from "@/lib/apply-enhancement";
import { pushRuleToElastic } from "@/lib/push-to-elastic";
import { getClientIp } from "@/lib/audit";

interface EnhanceResultShape {
  enhancedQuery?: string;
  enhancedTitle?: string;
  enhancedDescription?: string;
  newSeverity?: string;
  newRiskScore?: number;
  changelog?: { change: string; reason: string }[];
  investigationGuide?: string;
  falsePositives?: string[];
  references?: string[];
  indexPatterns?: string[];
}

// Lists every completed item from an "enhance" batch alongside the rule's
// current state, so a reviewer can see original vs. enhanced side by side
// and decide what to apply/deploy and what to leave alone — nothing here
// changes any rule; this is read-only.
export const GET = requireRole("DETECTION_ENG", "ADMIN")(async (request, context) => {
  const { id } = await context.params as { id: string };

  const batch = await prisma.analysisBatch.findUnique({ where: { id } });
  if (!batch) return errorResponse("Batch not found", 404);
  if (batch.operation !== "enhance") {
    return errorResponse("Review is only available for batches created with the Enhance operation", 400);
  }

  const items = await prisma.analysisBatchItem.findMany({
    where: { batchId: id, status: "completed" },
    include: {
      rule: {
        select: {
          id: true,
          title: true,
          query: true,
          severity: true,
          riskScore: true,
          elasticRuleId: true,
          elasticEnabled: true,
        },
      },
      analysis: { select: { id: true, inputQuery: true, enhanceResult: true } },
    },
    orderBy: { id: "asc" },
  });

  const reviewItems = items
    .filter((item) => item.analysis?.enhanceResult)
    .map((item) => {
      let enhance: EnhanceResultShape = {};
      try {
        enhance = JSON.parse(item.analysis!.enhanceResult) as EnhanceResultShape;
      } catch {
        /* leave empty — rendered as no-op below */
      }

      // A rule's query changes the moment an enhancement is applied to it —
      // used here (rather than a stored flag) so "already applied" stays
      // correct even if it happened outside this page (e.g. from the AI tab).
      const applied = !!enhance.enhancedQuery && item.rule.query === enhance.enhancedQuery;
      const deployed = applied && !!item.rule.elasticRuleId;

      return {
        itemId: item.id,
        analysisId: item.analysisId,
        ruleId: item.ruleId,
        ruleTitle: item.rule.title,
        originalQuery: item.analysis!.inputQuery,
        originalSeverity: item.rule.severity,
        currentQuery: item.rule.query,
        enhancedQuery: enhance.enhancedQuery ?? "",
        enhancedTitle: enhance.enhancedTitle ?? "",
        enhancedDescription: enhance.enhancedDescription ?? "",
        newSeverity: enhance.newSeverity ?? item.rule.severity,
        newRiskScore: enhance.newRiskScore ?? item.rule.riskScore,
        changelog: enhance.changelog ?? [],
        applied,
        deployed,
      };
    });

  return NextResponse.json({ batchId: id, items: reviewItems });
});

interface ReviewActionBody {
  itemIds: string[];
  action: "apply" | "apply_and_deploy";
  connectionId?: string;
  enabled?: boolean;
}

// Bulk-applies (and optionally deploys) a reviewer's selection from the
// review page. Sequential, like the other bulk rule endpoints — these are
// synchronous per-item writes, not AI calls, so there's no need for the
// AnalysisBatch machinery.
export const POST = requireRole("DETECTION_ENG", "ADMIN")(async (request, context) => {
  const { id } = await context.params as { id: string };
  const body = (await request.json().catch(() => ({}))) as ReviewActionBody;

  const itemIds = Array.isArray(body.itemIds) ? body.itemIds : [];
  if (itemIds.length === 0) return errorResponse("No items selected", 400);
  if (body.action !== "apply" && body.action !== "apply_and_deploy") {
    return errorResponse("Invalid action", 400);
  }
  if (body.action === "apply_and_deploy") {
    if (request.user.role !== "ADMIN") return errorResponse("Only admins can deploy to Elastic", 403);
    if (!body.connectionId) return errorResponse("connectionId is required to deploy", 400);
  }

  const batch = await prisma.analysisBatch.findUnique({ where: { id } });
  if (!batch) return errorResponse("Batch not found", 404);

  const items = await prisma.analysisBatchItem.findMany({
    where: { id: { in: itemIds }, batchId: id, status: "completed" },
    include: { analysis: { select: { enhanceResult: true } } },
  });

  const ip = getClientIp(request);
  const results: Array<{ itemId: string; ruleId: string; applied: boolean; deployed: boolean; error?: string }> = [];

  for (const item of items) {
    let enhance: EnhanceResultShape = {};
    try {
      enhance = item.analysis?.enhanceResult ? (JSON.parse(item.analysis.enhanceResult) as EnhanceResultShape) : {};
    } catch {
      /* falls through to the missing-enhancedQuery error below */
    }

    if (!enhance.enhancedQuery) {
      results.push({ itemId: item.id, ruleId: item.ruleId, applied: false, deployed: false, error: "No enhancement content found" });
      continue;
    }

    try {
      const applyInput: ApplyEnhancementInput = {
        enhancedTitle: enhance.enhancedTitle,
        enhancedDescription: enhance.enhancedDescription,
        enhancedQuery: enhance.enhancedQuery,
        newSeverity: enhance.newSeverity,
        newRiskScore: enhance.newRiskScore,
        investigationGuide: enhance.investigationGuide,
        falsePositives: enhance.falsePositives,
        references: enhance.references,
        indexPatterns: enhance.indexPatterns,
      };
      await applyEnhancementToRule(item.ruleId, request.user.id, request.user.role === "ADMIN", applyInput, ip);

      let deployed = false;
      if (body.action === "apply_and_deploy") {
        await pushRuleToElastic(item.ruleId, body.connectionId!, !!body.enabled, request.user.id, ip);
        deployed = true;
      }

      results.push({ itemId: item.id, ruleId: item.ruleId, applied: true, deployed });
    } catch (e) {
      results.push({
        itemId: item.id,
        ruleId: item.ruleId,
        applied: false,
        deployed: false,
        error: e instanceof Error ? e.message : "Failed",
      });
    }
  }

  const appliedCount = results.filter((r) => r.applied).length;
  const deployedCount = results.filter((r) => r.deployed).length;

  return NextResponse.json({ results, appliedCount, deployedCount });
});
