import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";

export const GET = authenticate(async (_request: AuthenticatedRequest) => {
  try {
    const rules = await prisma.rule.findMany({
      where: { client: { not: "" } },
      select: { client: true },
      distinct: ["client"],
      orderBy: { client: "asc" },
    });

    return NextResponse.json({
      clients: rules.map((r) => r.client),
    });
  } catch (e) {
    console.error("Failed to fetch clients:", e);
    return errorResponse("Failed to fetch clients", 500);
  }
});
