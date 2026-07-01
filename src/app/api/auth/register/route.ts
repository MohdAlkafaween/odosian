import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, setAuthCookie } from "@/lib/auth";
import { registerSchema, validateRequest } from "@/lib/validation";
import { logAudit, getClientIp } from "@/lib/audit";
import { errorResponse } from "@/lib/errors";
import {
  generateVerificationToken,
  getTokenExpiry,
  sendVerificationEmail,
} from "@/lib/email";

export async function POST(request: Request) {
  try {
    const validation = await validateRequest(registerSchema, request);
    if ("error" in validation) return validation.error;
    const { name, email, password } = validation.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return errorResponse("An account with this email already exists", 409);
    }

    const hashedPassword = await hashPassword(password);
    const userId = uuidv4();
    const verificationToken = generateVerificationToken();

    const user = await prisma.user.create({
      data: {
        id: userId,
        name,
        email,
        password: hashedPassword,
        // DEV: auto-verify since SMTP is not configured. Revert to false for production.
        emailVerified: true,
        verificationToken,
        verificationTokenExpiry: getTokenExpiry(),
      },
    });

    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const emailSent = await sendVerificationEmail(
      email,
      name,
      verificationToken
    );

    await logAudit({
      userId: user.id,
      action: "CREATE",
      targetType: "user",
      targetId: user.id,
      ipAddress: getClientIp(request),
    });

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          emailVerified: true,
        },
        token,
        emailSent,
        message: "Account created successfully.",
      },
      { status: 201 }
    );

    setAuthCookie(response, token);
    return response;
  } catch (e) {
    console.error("Register error:", e);
    return errorResponse("Internal server error", 500);
  }
}
