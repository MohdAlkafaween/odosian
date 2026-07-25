import { prisma } from "./prisma";

export async function ensureCategoryProject(
  category: string,
  ownerId: string,
  cache?: Map<string, string>
): Promise<string | null> {
  if (!category) return null;

  const cached = cache?.get(category);
  if (cached) return cached;

  const existing = await prisma.project.findFirst({ where: { name: category } });
  if (existing) {
    cache?.set(category, existing.id);
    return existing.id;
  }

  const created = await prisma.project.create({
    data: {
      name: category,
      description: `Shield Category — auto-organized detection rules for ${category}`,
      ownerId,
    },
  });
  cache?.set(category, created.id);
  return created.id;
}

export async function syncRuleCategoryProject(
  ruleId: string,
  category: string,
  ownerId: string,
  cache?: Map<string, string>
): Promise<void> {
  if (!category) return;

  const projectId = await ensureCategoryProject(category, ownerId, cache);
  if (!projectId) return;

  await prisma.projectRule.upsert({
    where: { projectId_ruleId: { projectId, ruleId } },
    update: {},
    create: { projectId, ruleId },
  });
}
