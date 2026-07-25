import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";

export const GET = authenticate(async (_request: AuthenticatedRequest) => {
  try {
    const rules = await prisma.rule.findMany({
      where: { category: { not: "" } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });

    return NextResponse.json({
      categories: rules.map((r) => r.category),
    });
  } catch (e) {
    console.error("Failed to fetch categories:", e);
    return errorResponse("Failed to fetch categories", 500);
  }
});
