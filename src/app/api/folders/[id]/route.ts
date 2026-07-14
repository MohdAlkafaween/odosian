import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";

export const GET = authenticate(
  async (_request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const folder = await prisma.ruleFolder.findUnique({
        where: { id },
        include: {
          children: {
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            include: { _count: { select: { rules: true, children: true } } },
          },
          rules: {
            select: {
              id: true,
              title: true,
              severity: true,
              status: true,
              ruleType: true,
              language: true,
              client: true,
              tags: true,
              updatedAt: true,
              author: { select: { id: true, name: true } },
            },
            orderBy: { title: "asc" },
          },
          _count: { select: { rules: true, children: true } },
        },
      });

      if (!folder) return errorResponse("Folder not found", 404);

      const rulesWithParsedTags = folder.rules.map((r) => ({
        ...r,
        tags: JSON.parse((r.tags as string) || "[]"),
      }));

      return NextResponse.json({ folder: { ...folder, rules: rulesWithParsedTags } });
    } catch (e) {
      console.error("Failed to fetch folder:", e);
      return errorResponse("Failed to fetch folder", 500);
    }
  }
);

export const PATCH = authenticate(
  async (request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const body = await request.json();
      const { name, description, icon, color, parentId } = body;

      const existing = await prisma.ruleFolder.findUnique({ where: { id } });
      if (!existing) return errorResponse("Folder not found", 404);

      if (parentId === id) return errorResponse("A folder cannot be its own parent", 400);

      if (parentId) {
        let current = parentId;
        while (current) {
          if (current === id) return errorResponse("Cannot create circular folder hierarchy", 400);
          const parent = await prisma.ruleFolder.findUnique({
            where: { id: current },
            select: { parentId: true },
          });
          current = parent?.parentId || "";
        }
      }

      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name.trim();
      if (description !== undefined) data.description = description;
      if (icon !== undefined) data.icon = icon;
      if (color !== undefined) data.color = color;
      if (parentId !== undefined) data.parentId = parentId || null;

      const folder = await prisma.ruleFolder.update({
        where: { id },
        data,
        include: { _count: { select: { rules: true, children: true } } },
      });

      return NextResponse.json({ folder });
    } catch (e) {
      console.error("Failed to update folder:", e);
      return errorResponse("Failed to update folder", 500);
    }
  }
);

export const DELETE = authenticate(
  async (_request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const existing = await prisma.ruleFolder.findUnique({ where: { id } });
      if (!existing) return errorResponse("Folder not found", 404);

      await prisma.ruleFolder.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (e) {
      console.error("Failed to delete folder:", e);
      return errorResponse("Failed to delete folder", 500);
    }
  }
);
