import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";

const ACTION_META: Record<string, { icon: string; label: string; level: "info" | "success" | "warning" | "danger" }> = {
  RULE_CREATED: { icon: "plus", label: "New rule created", level: "success" },
  RULE_UPDATED: { icon: "edit", label: "Rule updated", level: "info" },
  RULE_DELETED: { icon: "trash", label: "Rule deleted", level: "danger" },
  ANALYSIS_RUN: { icon: "shield", label: "Analysis completed", level: "info" },
  ENHANCEMENT_RUN: { icon: "zap", label: "Enhancement completed", level: "success" },
  RULE_GENERATED: { icon: "sparkle", label: "Rule generated", level: "success" },
  FEEDBACK_RUN: { icon: "message", label: "Feedback received", level: "info" },
  LOGIN: { icon: "login", label: "User signed in", level: "info" },
  LOGOUT: { icon: "logout", label: "User signed out", level: "info" },
  PROVIDER_UPDATED: { icon: "settings", label: "Provider updated", level: "warning" },
  SETTING_UPDATED: { icon: "settings", label: "Setting changed", level: "warning" },
  ATTACK_SIMULATION: { icon: "crosshair", label: "Attack simulated", level: "warning" },
};

export const GET = authenticate(async (request: AuthenticatedRequest) => {
  try {
    const url = new URL(request.url);
    const limit = Math.min(30, Math.max(1, parseInt(url.searchParams.get("limit") || "15")));

    const logs = await prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true } } },
    });

    const notifications = logs.map((log) => {
      const meta = ACTION_META[log.action] || { icon: "info", label: log.action, level: "info" as const };
      let details: Record<string, unknown> = {};
      try { details = JSON.parse(log.details); } catch { /* */ }

      const title = details.title || details.name || details.ruleName || "";

      return {
        id: log.id,
        action: log.action,
        icon: meta.icon,
        label: meta.label,
        level: meta.level,
        title: typeof title === "string" ? title : "",
        userName: log.user.name,
        createdAt: log.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ notifications });
  } catch (e) {
    console.error("Failed to fetch notifications:", e);
    return errorResponse("Failed to fetch notifications", 500);
  }
});
