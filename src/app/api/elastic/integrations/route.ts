import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";
import { elasticFetch } from "@/lib/elastic-fetch";

interface FleetPackage {
  name: string;
  title: string;
  version: string;
  status: string;
}

// Related Integrations must be real Fleet packages, not free text — this
// fetches the actual package registry from the connected Kibana so the rule
// form can only offer integrations that genuinely exist (and shows whether
// each is actually installed).
export const GET = authenticate(async (request: AuthenticatedRequest) => {
  try {
    const url = new URL(request.url);
    const connectionId = url.searchParams.get("connectionId");

    const connection = connectionId
      ? await prisma.elasticConnection.findUnique({ where: { id: connectionId } })
      : await prisma.elasticConnection.findFirst({ where: { isActive: true } });

    if (!connection) return errorResponse("No Elastic connection configured", 404);

    const baseUrl = connection.kibanaUrl.replace(/\/+$/, "");

    const res = await elasticFetch(
      `${baseUrl}/api/fleet/epm/packages?prerelease=false`,
      {
        headers: {
          Authorization: `ApiKey ${connection.apiKey}`,
          "kbn-xsrf": "true",
        },
        timeoutMs: 15000,
      },
      connection.verifySsl
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return errorResponse(`Kibana returned ${res.status}: ${errText.slice(0, 200)}`, 502);
    }

    const data = (await res.json()) as { items?: FleetPackage[] };
    const integrations = (data.items || [])
      .map((p) => ({ name: p.name, title: p.title, version: p.version, status: p.status }))
      .sort((a, b) => a.title.localeCompare(b.title));

    return NextResponse.json({ integrations });
  } catch (e) {
    console.error("Failed to fetch Fleet integrations:", e);
    return errorResponse("Failed to fetch integrations from Elastic", 502);
  }
});
