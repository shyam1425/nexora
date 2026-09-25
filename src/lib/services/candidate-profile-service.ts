import { prisma } from '@/lib/prisma';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import type { Role } from '@/generated/prisma/enums';
import type { UpdateCandidateProfileInput } from '@/lib/validation/candidate';
import type { RequestMeta } from './auth-service';

function calculateProfileCompletion(input: UpdateCandidateProfileInput): number {
  const checks = [
    Boolean(input.firstName),
    Boolean(input.lastName),
    Boolean(input.phone),
    Boolean(input.city),
    Boolean(input.headline),
    Boolean(input.summary),
    input.skills.length > 0,
    input.totalExperienceMonths > 0,
    Boolean(input.currentCompany),
    Boolean(input.currentDesignation),
    Boolean(input.linkedinUrl || input.portfolioUrl),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export async function updateCandidateProfile(
  actor: { userId: string; role: Role },
  input: UpdateCandidateProfileInput,
  meta: RequestMeta,
) {
  if (actor.role !== 'CANDIDATE') throw new ForbiddenError('Only candidates can update a candidate profile');

  return prisma.$transaction(async (tx) => {
    const profile = await tx.candidateProfile.findUnique({
      where: { userId: actor.userId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundError('Candidate profile');

    const profileCompletion = calculateProfileCompletion(input);
    const updated = await tx.candidateProfile.update({
      where: { id: profile.id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone || null,
        city: input.city || null,
        state: input.state || null,
        country: input.country || null,
        headline: input.headline || null,
        summary: input.summary || null,
        totalExperienceMonths: input.totalExperienceMonths,
        currentCtc: input.currentCtc ?? null,
        expectedCtc: input.expectedCtc ?? null,
        noticePeriodDays: input.noticePeriodDays ?? null,
        currentCompany: input.currentCompany || null,
        currentDesignation: input.currentDesignation || null,
        skills: input.skills,
        linkedinUrl: input.linkedinUrl || null,
        portfolioUrl: input.portfolioUrl || null,
        profileCompletion,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        city: true,
        state: true,
        country: true,
        headline: true,
        summary: true,
        totalExperienceMonths: true,
        currentCtc: true,
        expectedCtc: true,
        noticePeriodDays: true,
        currentCompany: true,
        currentDesignation: true,
        skills: true,
        linkedinUrl: true,
        portfolioUrl: true,
        profileCompletion: true,
        updatedAt: true,
      },
    });

    await tx.user.update({
      where: { id: actor.userId },
      data: {
        name: `${input.firstName} ${input.lastName}`.trim(),
        phone: input.phone || null,
      },
    });

    await recordAudit(
      {
        action: AUDIT_ACTIONS.USER_UPDATED,
        entityType: 'CandidateProfile',
        entityId: profile.id,
        actorUserId: actor.userId,
        actorRole: actor.role,
        metadata: { fields: Object.keys(input) },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      tx,
    );

    return updated;
  });
}
