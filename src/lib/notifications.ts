import { prisma } from "./prisma";

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  message?: string;
  targetType?: string;
  targetId?: string;
}) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message || "",
      targetType: params.targetType || "",
      targetId: params.targetId || "",
    },
  });
}
