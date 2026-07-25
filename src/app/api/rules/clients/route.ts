import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";
import { logAudit, getClientIp } from "@/lib/audit";

const CLIENT_TAGS_KEY = "rules.customClientTags";

async function getCustomClientTags(): Promise<string[]> {
  const setting = await prisma.setting.findUnique({ where: { key: CLIENT_TAGS_KEY } });
  if (!setting) return [];
  try {
    const parsed = JSON.parse(setting.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const GET = authenticate(async (_request: AuthenticatedRequest) => {
  try {
    const [rules, customTags] = await Promise.all([
      prisma.rule.findMany({
        where: { client: { not: "" } },
        select: { client: true },
        distinct: ["client"],
      }),
      getCustomClientTags(),
    ]);

    const merged = Array.from(new Set([...rules.map((r) => r.client), ...customTags])).sort((a, b) =>
      a.localeCompare(b)
    );

    return NextResponse.json({ clients: merged });
  } catch (e) {
    console.error("Failed to fetch clients:", e);
    return errorResponse("Failed to fetch clients", 500);
  }
});

export const POST = authenticate(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) return errorResponse("Client tag name is required", 400);
    if (name.length > 100) return errorResponse("Client tag name must be at most 100 characters", 400);

    const existing = await getCustomClientTags();
    if (!existing.includes(name)) {
      const updated = [...existing, name].sort((a, b) => a.localeCompare(b));
      await prisma.setting.upsert({
        where: { key: CLIENT_TAGS_KEY },
        update: { value: JSON.stringify(updated) },
        create: {
          key: CLIENT_TAGS_KEY,
          value: JSON.stringify(updated),
          category: "rules",
          label: "Custom Client Tags",
        },
      });

      logAudit({
        userId: request.user.id,
        action: "CLIENT_TAG_CREATED",
        targetType: "setting",
        targetId: CLIENT_TAGS_KEY,
        details: { name },
        ipAddress: getClientIp(request),
      });
    }

    const [rules, customTags] = await Promise.all([
      prisma.rule.findMany({
        where: { client: { not: "" } },
        select: { client: true },
        distinct: ["client"],
      }),
      getCustomClientTags(),
    ]);
    const merged = Array.from(new Set([...rules.map((r) => r.client), ...customTags])).sort((a, b) =>
      a.localeCompare(b)
    );

    return NextResponse.json({ clients: merged }, { status: 201 });
  } catch (e) {
    console.error("Failed to add client tag:", e);
    return errorResponse("Failed to add client tag", 500);
  }
});
