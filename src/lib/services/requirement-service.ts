import { prisma } from '@/lib/prisma';
import { ForbiddenError } from '@/lib/errors';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { notify, notifyRoles, NOTIFICATION_TYPES } from '@/lib/notifications/service';
import type { CreateRequirementInput } from '@/lib/validation/client';
import type { RequestMeta } from './auth-service';

export async function createRequirementForClient(
  actorUserId: string,
  input: CreateRequirementInput,
  meta: RequestMeta,
) {
  return prisma.$transaction(async (tx) => {
    const membership = await tx.clientUser.findUnique({ where: { userId: actorUserId }, select: { clientId: true, client: { select: { id: true, name: true, status: true, deletedAt: true } } } });
    if (!membership || membership.client.deletedAt || membership.client.status !== 'ACTIVE') throw new ForbiddenError('Your company account cannot create requirements');
    const requirement = await tx.requirement.create({ data: { clientId: membership.clientId, title: input.title, description: input.description, skills: input.skills, positionsCount: input.positionsCount, location: input.location || null, workMode: input.workMode, employmentType: input.employmentType, minExperienceMonths: input.minExperienceMonths, maxExperienceMonths: input.maxExperienceMonths, budgetMin: input.budgetMin, budgetMax: input.budgetMax, currency: 'INR', priority: input.priority, targetDate: input.targetDate, status: 'OPEN', createdById: actorUserId }, select: { id: true, title: true, status: true, positionsCount: true, createdAt: true } });
    await recordAudit({ action: AUDIT_ACTIONS.REQUIREMENT_CREATED, entityType: 'Requirement', entityId: requirement.id, actorUserId, actorRole: 'CLIENT', metadata: { clientId: membership.clientId, title: requirement.title }, ipAddress: meta.ipAddress, userAgent: meta.userAgent }, tx);
    await notify({ userId: actorUserId, type: NOTIFICATION_TYPES.REQUIREMENT_CREATED, title: 'Requirement submitted', body: `${requirement.title} is now visible to the recruitment team.`, entityType: 'Requirement', entityId: requirement.id, link: '/client' }, tx);
    await notifyRoles(['SUPER_ADMIN', 'ADMIN', 'RECRUITER'], { type: 'REQUIREMENT_CREATED', title: 'New manpower requirement', body: `${membership.client.name} submitted ${requirement.title}.`, entityType: 'Requirement', entityId: requirement.id, link: '/recruiter/requirements' }, tx);
    return requirement;
  });
}
