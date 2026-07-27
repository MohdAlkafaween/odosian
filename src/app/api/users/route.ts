import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { hashPassword } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";
import { errorResponse } from "@/lib/errors";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  emailVerified: true,
  failedAttempts: true,
  lockedUntil: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { rules: true, analyses: true } },
};

export const GET = requireRole("ADMIN")(async (request: AuthenticatedRequest) => {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
    const search = url.searchParams.get("search") || "";
    const role = url.searchParams.get("role") || "";
    const isActive = url.searchParams.get("isActive");

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (role) where.role = role;
    if (isActive === "true") where.isActive = true;
    if (isActive === "false") where.isActive = false;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: USER_SELECT,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error("Failed to fetch users:", e);
    return errorResponse("Failed to fetch users", 500);
  }
});

export const POST = requireRole("ADMIN")(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { name, email, password, role } = body;

    if (!name || !email || !password) {
      return errorResponse("Name, email, and password are required", 400);
    }

    if (!["ADMIN", "DETECTION_ENG"].includes(role)) {
      return errorResponse("Invalid role. Must be ADMIN or DETECTION_ENG", 400);
    }

    if (password.length < 8) {
      return errorResponse("Password must be at least 8 characters", 400);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return errorResponse("An account with this email already exists", 409);
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        name,
        email,
        password: hashedPassword,
        role,
        emailVerified: true,
        isActive: true,
      },
    });

    await logAudit({
      userId: request.user.id,
      action: "CREATE",
      targetType: "user",
      targetId: user.id,
      details: { createdRole: role, createdEmail: email },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    }, { status: 201 });
  } catch (e) {
    console.error("Failed to create user:", e);
    return errorResponse("Failed to create user", 500);
  }
});
