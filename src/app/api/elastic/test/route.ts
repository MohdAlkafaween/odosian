import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";
import { elasticFetch } from "@/lib/elastic-fetch";

export const POST = requireRole("ADMIN")(async (request: AuthenticatedRequest) => {
  try {
    const { connectionId } = await request.json();
    if (!connectionId) return errorResponse("Connection ID required", 400);

    const connection = await prisma.elasticConnection.findUnique({
      where: { id: connectionId },
    });
    if (!connection) return errorResponse("Connection not found", 404);

    const baseUrl = connection.kibanaUrl.replace(/\/+$/, "");
    const spacePrefix = connection.spaceId && connection.spaceId !== "default"
      ? `/s/${connection.spaceId}`
      : "";

    const statusUrl = `${baseUrl}${spacePrefix}/api/status`;

    try {
      const res = await elasticFetch(
        statusUrl,
        {
          headers: {
            Authorization: `ApiKey ${connection.apiKey}`,
            "kbn-xsrf": "true",
          },
          timeoutMs: 10000,
        },
        connection.verifySsl
      );

      if (res.ok) {
        const data = (await res.json()) as { version?: { number?: string }; status?: { overall?: { level?: string } } };
        await prisma.elasticConnection.update({
          where: { id: connectionId },
          data: { lastTestedAt: new Date(), lastStatus: "ok" },
        });
        return NextResponse.json({
          success: true,
          version: data.version?.number || "unknown",
          status: data.status?.overall?.level || "available",
        });
      }

      const errorText = await res.text().catch(() => "");
      await prisma.elasticConnection.update({
        where: { id: connectionId },
        data: { lastTestedAt: new Date(), lastStatus: `error:${res.status}` },
      });
      return errorResponse(
        `Kibana returned ${res.status}: ${errorText.slice(0, 200)}`,
        502,
      );
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : "Connection failed";
      await prisma.elasticConnection.update({
        where: { id: connectionId },
        data: { lastTestedAt: new Date(), lastStatus: `error:${msg}` },
      });
      return errorResponse(`Failed to reach Kibana: ${msg}`, 502);
    }
  } catch (e) {
    console.error("Elastic test connection failed:", e);
    return errorResponse("Test connection failed", 500);
  }
});
