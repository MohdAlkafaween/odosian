import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";

export const GET = authenticate(async (_request: AuthenticatedRequest) => {
  try {
    const folders = await prisma.ruleFolder.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { rules: true, children: true } },
      },
    });

    return NextResponse.json({ folders });
  } catch (e) {
    console.error("Failed to fetch folders:", e);
    return errorResponse("Failed to fetch folders", 500);
  }
});

export const POST = authenticate(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { name, description, icon, color, parentId } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return errorResponse("Folder name is required", 400);
    }

    if (parentId) {
      const parent = await prisma.ruleFolder.findUnique({ where: { id: parentId } });
      if (!parent) return errorResponse("Parent folder not found", 404);
    }

    const maxOrder = await prisma.ruleFolder.aggregate({
      where: { parentId: parentId || null },
      _max: { sortOrder: true },
    });

    const folder = await prisma.ruleFolder.create({
      data: {
        name: name.trim(),
        description: description || "",
        icon: icon || "folder",
        color: color || "#4CBDFA",
        parentId: parentId || null,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
      include: { _count: { select: { rules: true, children: true } } },
    });

    return NextResponse.json({ folder }, { status: 201 });
  } catch (e) {
    console.error("Failed to create folder:", e);
    return errorResponse("Failed to create folder", 500);
  }
});
