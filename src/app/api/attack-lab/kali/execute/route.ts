import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { validateRequest } from "@/lib/validation";
import { errorResponse } from "@/lib/errors";
import { logAudit, getClientIp } from "@/lib/audit";
import { z } from "zod/v4";

const executeSchema = z.object({
  connectionId: z.string().min(1, "Connection ID is required"),
  command: z.string().min(1, "Command is required").max(2000),
  simulationId: z.string().optional(),
});

export const POST = requireRole("ADMIN")(async (request: AuthenticatedRequest) => {
  try {
    const validated = await validateRequest(executeSchema, request);
    if ("error" in validated) return validated.error;

    const { connectionId, command, simulationId } = validated.data;

    const connection = await prisma.kaliConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) return errorResponse("Connection not found", 404);
    if (!connection.isActive) return errorResponse("Connection is disabled", 400);

    // In a real implementation, this would execute via SSH.
    // Placeholder: returns a simulated output.
    const output = `[Kali@${connection.host}] $ ${command}\n\n(SSH execution not yet implemented. Configure a real Kali connection in Settings > API & Connections to enable command execution.)`;

    if (simulationId) {
      const sim = await prisma.attackSimulation.findUnique({ where: { id: simulationId } });
      if (sim) {
        const existingOutputs = JSON.parse(sim.commandOutputs || "[]");
        existingOutputs.push({ command, output, timestamp: new Date().toISOString() });
        await prisma.attackSimulation.update({
          where: { id: simulationId },
          data: { commandOutputs: JSON.stringify(existingOutputs) },
        });
      }
    }

    logAudit({
      userId: request.user.id,
      action: "KALI_EXECUTE",
      targetType: "kali_connection",
      targetId: connectionId,
      details: { command: command.substring(0, 100), simulationId },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ output, exitCode: 0 });
  } catch (e) {
    console.error("Kali execute failed:", e);
    return errorResponse("Execution failed", 500);
  }
});
