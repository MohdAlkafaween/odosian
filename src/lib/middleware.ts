import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { getTokenFromRequest, verifyToken, type TokenPayload } from "./auth";
import { errorResponse } from "./errors";

type UserFromDb = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface AuthenticatedRequest extends Request {
  user: UserFromDb;
}

type RouteContext = { params: Promise<Record<string, string>> };

type AuthenticatedHandler = (
  request: AuthenticatedRequest,
  context: RouteContext
) => Promise<NextResponse>;

type RouteHandler = (
  request: Request,
  context: RouteContext
) => Promise<NextResponse>;

export function authenticate(handler: AuthenticatedHandler): RouteHandler {
  return async (request: Request, context: RouteContext) => {
    const token = getTokenFromRequest(request);
    if (!token) {
      return errorResponse("Authentication required", 401);
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return errorResponse("Invalid or expired token", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user || !user.isActive) {
      return errorResponse("Account not found or deactivated", 401);
    }

    (request as AuthenticatedRequest).user = user as UserFromDb;
    return handler(request as AuthenticatedRequest, context);
  };
}

export function requireRole(
  ...roles: string[]
): (handler: AuthenticatedHandler) => RouteHandler {
  return (handler: AuthenticatedHandler) => {
    return authenticate(async (request, context) => {
      if (!roles.includes(request.user.role)) {
        return errorResponse("Insufficient permissions", 403);
      }
      return handler(request, context);
    });
  };
}

export function rateLimit(
  endpoint: string,
  limit: number
): (handler: RouteHandler) => RouteHandler {
  return (handler: RouteHandler) => {
    return async (request: Request, context: RouteContext) => {
      let userId = "anonymous";
      const token = getTokenFromRequest(request);
      if (token) {
        const payload = await verifyToken(token);
        if (payload) userId = payload.userId;
      }

      const now = new Date();
      const windowStart = new Date(now.getTime() - 60_000);

      const existing = await prisma.rateLimit.findUnique({
        where: { userId_endpoint: { userId, endpoint } },
      });

      if (existing) {
        if (existing.windowStart > windowStart) {
          if (existing.count >= limit) {
            const retryAfter = Math.ceil((existing.windowStart.getTime() + 60000 - now.getTime()) / 1000);
            const resp = errorResponse("Rate limit exceeded. Try again later.", 429);
            resp.headers.set("Retry-After", String(retryAfter));
            resp.headers.set("X-RateLimit-Remaining", "0");
            return resp;
          }
          await prisma.rateLimit.update({
            where: { id: existing.id },
            data: { count: existing.count + 1 },
          });
        } else {
          await prisma.rateLimit.update({
            where: { id: existing.id },
            data: { count: 1, windowStart: now },
          });
        }
      } else {
        await prisma.rateLimit.create({
          data: { userId, endpoint, count: 1, windowStart: now },
        });
      }

      let currentCount = 1;
      if (existing) {
        if (existing.windowStart > windowStart) {
          currentCount = existing.count + 1;
        }
      }
      const response = await handler(request, context);
      const remaining = Math.max(0, limit - currentCount);
      response.headers.set("X-RateLimit-Limit", String(limit));
      response.headers.set("X-RateLimit-Remaining", String(remaining));
      response.headers.set("X-RateLimit-Reset", String(Math.ceil((now.getTime() + 60000) / 1000)));
      return response;
    };
  };
}
