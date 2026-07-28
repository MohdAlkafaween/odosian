import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, type AuthenticatedRequest } from "@/lib/middleware";
import { rateLimit } from "@/lib/middleware";
import { callAIWithSystemPrompt } from "@/lib/ai";
import { errorResponse, aiErrorResponse } from "@/lib/errors";
import { logAudit, getClientIp } from "@/lib/audit";

interface SimulateResult {
  scenario: string;
  prerequisites: string[];
  steps: { stepNumber: number; action: string; command: string; expectedOutput: string; notes: string }[];
  expectedAlerts: string[];
  validationSteps: string[];
  cleanupCommands: string[];
}

const AI_RATE_LIMIT = parseInt(process.env.RATE_LIMIT_AI || "10");

export const POST = rateLimit("simulate", AI_RATE_LIMIT)(
  authenticate(async (request: AuthenticatedRequest, context) => {
    try {
      const { id } = await context.params as { id: string };

      const rule = await prisma.rule.findUnique({
        where: { id },
        include: {
          mitreMappings: {
            select: { tacticId: true, tacticName: true, techniqueId: true, techniqueName: true },
          },
        },
      });

      if (!rule) {
        return errorResponse("Rule not found", 404);
      }

      const tags = (() => {
        if (Array.isArray(rule.tags)) return rule.tags as string[];
        if (typeof rule.tags === "string") {
          try { return JSON.parse(rule.tags) as string[]; } catch { return []; }
        }
        return [];
      })();

      const falsePositives = (() => {
        if (Array.isArray(rule.falsePositives)) return rule.falsePositives as string[];
        if (typeof rule.falsePositives === "string") {
          try { return JSON.parse(rule.falsePositives) as string[]; } catch { return []; }
        }
        return [];
      })();

      const mitreContext = rule.mitreMappings.length > 0
        ? `\nMITRE ATT&CK Mappings:\n${rule.mitreMappings.map((m) => `- ${m.tacticName} (${m.tacticId}) > ${m.techniqueName} (${m.techniqueId})`).join("\n")}`
        : "";

      const systemPrompt = `You are a detection engineering attack simulation expert. Your job is to generate a realistic attack simulation plan that would trigger the given detection rule.

You will be given a complete detection rule including its query, type, severity, and other metadata. Based on these fields, generate a step-by-step attack simulation that would produce the exact events, logs, and artifacts that this rule's query is designed to detect.

IMPORTANT RULES:
- The simulation MUST be designed to trigger the specific query provided — analyze the query fields, operators, and conditions to determine what activity to simulate
- Commands should be realistic and executable in a controlled lab environment
- Include both the attack commands and how to verify the rule triggers
- Always include cleanup commands to reverse changes
- Consider the rule's language (KQL, EQL, Lucene, ES|QL) and index patterns when crafting the simulation

Respond with valid JSON only matching this schema:
{
  "scenario": "Brief description of the attack scenario being simulated",
  "prerequisites": ["List of tools, access, or setup needed before running the simulation"],
  "steps": [
    {
      "stepNumber": 1,
      "action": "What this step does",
      "command": "The command to execute",
      "expectedOutput": "What output to expect",
      "notes": "Any warnings or context"
    }
  ],
  "expectedAlerts": ["List of alerts/detections this simulation should trigger"],
  "validationSteps": ["Steps to verify the rule fired correctly"],
  "cleanupCommands": ["Commands to clean up after the simulation"]
}`;

      const userMessage = `Simulate an attack that triggers this detection rule:

Rule Title: ${rule.title}
Rule Type: ${rule.ruleType}
Severity: ${rule.severity}
Risk Score: ${rule.riskScore}
Language: ${rule.language}
Index Patterns: ${rule.index || "N/A"}
Interval: ${rule.interval || "5m"}
Status: ${rule.status}

Description:
${rule.description || "No description provided"}

Detection Query:
\`\`\`${rule.language}
${rule.query}
\`\`\`

Tags: ${tags.length > 0 ? tags.join(", ") : "None"}
Known False Positives: ${falsePositives.length > 0 ? falsePositives.join("; ") : "None"}
${mitreContext}
${rule.investigationGuide ? `\nInvestigation Guide:\n${rule.investigationGuide}` : ""}

Generate a simulation plan that produces the exact events this query would match.`;

      const { result, modelUsed, tokensUsed, latencyMs } =
        await callAIWithSystemPrompt<SimulateResult>(systemPrompt, userMessage);

      logAudit({
        userId: request.user.id,
        action: "SIMULATION_CREATED",
        targetType: "rule",
        targetId: rule.id,
        details: { ruleTitle: rule.title, modelUsed, tokensUsed, latencyMs },
        ipAddress: getClientIp(request),
      });

      return NextResponse.json({
        simulation: result,
        meta: { modelUsed, tokensUsed, latencyMs },
      });
    } catch (e) {
      console.error("Simulation failed:", e);
      return aiErrorResponse(e, "Simulation failed");
    }
  })
);
