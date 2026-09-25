import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { notify } from '@/lib/notifications/service';
import { slugify } from '@/lib/utils';
import type { Role } from '@/generated/prisma/enums';
import type { CreateJobInput } from '@/lib/validation/recruitment';
import type { RequestMeta } from './auth-service';

export async function createJob(input: CreateJobInput, actor: { userId: string; role: Role }, meta: RequestMeta) {
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findFirst({ where: { id: input.clientId, deletedAt: null, status: 'ACTIVE' }, select: { id: true, name: true } });
    if (!client) throw new NotFoundError('Client');
    if (input.requirementId) {
      const requirement = await tx.requirement.findFirst({ where: { id: input.requirementId, clientId: client.id, deletedAt: null }, select: { id: true } });
      if (!requirement) throw new NotFoundError('Requirement');
    }

    const baseSlug = slugify(input.title) || 'role';
    let slug = baseSlug;
    let suffix = 1;
    while (await tx.job.findUnique({ where: { slug }, select: { id: true } })) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    const job = await tx.job.create({
      data: {
        clientId: client.id,
        requirementId: input.requirementId || null,
        title: input.title,
        slug,
        description: input.description,
        responsibilities: input.responsibilities || null,
        requirements: input.requirements || null,
        skills: input.skills,
        employmentType: input.employmentType,
        workMode: input.workMode,
        location: input.location || null,
        city: input.city || null,
        state: input.state || null,
        minExperienceMonths: input.minExperienceMonths,
        positionsCount: input.positionsCount,
        visibility: input.visibility,
        createdById: actor.userId,
        recruiterId: actor.userId,
        status: 'DRAFT',
      },
      select: { id: true, slug: true, title: true, status: true, client: { select: { id: true, name: true } } },
    });

    await recordAudit({ action: AUDIT_ACTIONS.JOB_CREATED, entityType: 'Job', entityId: job.id, actorUserId: actor.userId, actorRole: actor.role, metadata: { clientId: client.id, title: job.title }, ipAddress: meta.ipAddress, userAgent: meta.userAgent }, tx);
    const clientUsers = await tx.clientUser.findMany({ where: { clientId: client.id }, select: { userId: true } });
    for (const clientUser of clientUsers) {
      await notify({ userId: clientUser.userId, type: 'JOB_CREATED', title: 'New job draft created', body: `${job.title} was added for ${client.name}.`, entityType: 'Job', entityId: job.id, link: '/client' }, tx);
    }
    return job;
  });
}

export async function publishJob(jobId: string, actor: { userId: string; role: Role }, meta: RequestMeta) {
  return prisma.$transaction(async (tx) => {
    const job = await tx.job.findFirst({ where: { id: jobId, deletedAt: null }, select: { id: true, title: true, status: true, recruiterId: true, createdById: true, clientId: true } });
    if (!job) throw new NotFoundError('Job');
    if (actor.role === 'RECRUITER' && ![job.recruiterId, job.createdById].includes(actor.userId)) throw new ConflictError('You are not assigned to this job');
    if (job.status !== 'DRAFT') throw new ConflictError('Only draft jobs can be published');
    const updated = await tx.job.update({ where: { id: job.id }, data: { status: 'PUBLISHED', publishedAt: new Date() }, select: { id: true, slug: true, title: true, status: true, publishedAt: true } });
    await recordAudit({ action: AUDIT_ACTIONS.JOB_PUBLISHED, entityType: 'Job', entityId: job.id, actorUserId: actor.userId, actorRole: actor.role, metadata: { title: job.title }, ipAddress: meta.ipAddress, userAgent: meta.userAgent }, tx);
    return updated;
  });
}
