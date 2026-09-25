import { prisma } from '@/lib/prisma';
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { notify, NOTIFICATION_TYPES } from '@/lib/notifications/service';
import type { Role } from '@/generated/prisma/enums';
import type { InterviewFeedbackInput, ScheduleInterviewInput } from '@/lib/validation/interview';
import type { RequestMeta } from './auth-service';

function assertRecruiterAccess(actor: { userId: string; role: Role }, job: { recruiterId: string | null; createdById: string | null }) {
  if (actor.role === 'RECRUITER' && ![job.recruiterId, job.createdById].includes(actor.userId)) throw new ForbiddenError('You are not assigned to this job');
  if (!['SUPER_ADMIN', 'ADMIN', 'RECRUITER'].includes(actor.role)) throw new ForbiddenError('Only recruitment staff can manage interviews');
}

export async function scheduleInterview(input: ScheduleInterviewInput, actor: { userId: string; role: Role }, meta: RequestMeta) {
  return prisma.$transaction(async (tx) => {
    const application = await tx.application.findUnique({ where: { id: input.applicationId }, select: { id: true, status: true, candidateProfile: { select: { userId: true } }, job: { select: { title: true, recruiterId: true, createdById: true } } } });
    if (!application) throw new NotFoundError('Application');
    assertRecruiterAccess(actor, application.job);
    if (application.status !== 'SHORTLISTED') throw new BusinessRuleError('Only shortlisted applications can be scheduled for an interview');
    const changed = await tx.application.updateMany({ where: { id: application.id, status: 'SHORTLISTED' }, data: { status: 'INTERVIEW_SCHEDULED' } });
    if (changed.count !== 1) throw new ConflictError('Application status changed while scheduling the interview');
    const interview = await tx.interview.create({ data: { applicationId: application.id, roundNumber: input.roundNumber, roundName: input.roundName || null, mode: input.mode, status: 'SCHEDULED', scheduledAt: input.scheduledAt, durationMinutes: input.durationMinutes, location: input.location || null, meetingLink: input.meetingLink || null, interviewerName: input.interviewerName || null, notes: input.notes || null, createdById: actor.userId }, select: { id: true, scheduledAt: true, mode: true, status: true, applicationId: true } });
    await tx.applicationStatusHistory.create({ data: { applicationId: application.id, fromStatus: 'SHORTLISTED', toStatus: 'INTERVIEW_SCHEDULED', note: 'Interview scheduled', changedById: actor.userId } });
    await recordAudit({ action: AUDIT_ACTIONS.INTERVIEW_CREATED, entityType: 'Interview', entityId: interview.id, actorUserId: actor.userId, actorRole: actor.role, metadata: { applicationId: application.id, scheduledAt: input.scheduledAt.toISOString() }, ipAddress: meta.ipAddress, userAgent: meta.userAgent }, tx);
    await notify({ userId: application.candidateProfile.userId, type: NOTIFICATION_TYPES.INTERVIEW_SCHEDULED, title: 'Interview scheduled', body: `Your interview for ${application.job.title} is scheduled.`, entityType: 'Interview', entityId: interview.id, link: '/candidate' }, tx);
    return interview;
  });
}

export async function recordInterviewFeedback(interviewId: string, input: InterviewFeedbackInput, actor: { userId: string; role: Role }, meta: RequestMeta) {
  return prisma.$transaction(async (tx) => {
    const interview = await tx.interview.findUnique({ where: { id: interviewId }, select: { id: true, status: true, interviewerUserId: true, application: { select: { id: true, status: true, candidateProfile: { select: { userId: true } }, job: { select: { title: true, recruiterId: true, createdById: true } } } } } });
    if (!interview) throw new NotFoundError('Interview');
    assertRecruiterAccess(actor, interview.application.job);
    if (actor.role === 'RECRUITER' && interview.interviewerUserId && interview.interviewerUserId !== actor.userId) throw new ForbiddenError('Only the assigned interviewer can submit feedback');
    if (interview.status === 'COMPLETED' || interview.application.status !== 'INTERVIEW_SCHEDULED') throw new ConflictError('Interview feedback has already been completed');
    const feedback = await tx.interviewFeedback.upsert({ where: { interviewId }, create: { interviewId, overallRating: input.overallRating, technicalRating: input.technicalRating, communicationRating: input.communicationRating, recommendation: input.recommendation, strengths: input.strengths || null, weaknesses: input.weaknesses || null, notes: input.notes || null, submittedById: actor.userId }, update: { overallRating: input.overallRating, technicalRating: input.technicalRating, communicationRating: input.communicationRating, recommendation: input.recommendation, strengths: input.strengths || null, weaknesses: input.weaknesses || null, notes: input.notes || null, submittedById: actor.userId, submittedAt: new Date() }, select: { id: true, interviewId: true, recommendation: true, overallRating: true } });
    const changed = await tx.application.updateMany({ where: { id: interview.application.id, status: 'INTERVIEW_SCHEDULED' }, data: { status: 'INTERVIEW_COMPLETED' } });
    if (changed.count !== 1) throw new ConflictError('Application status changed while recording feedback');
    await tx.interview.update({ where: { id: interviewId }, data: { status: 'COMPLETED' } });
    await tx.applicationStatusHistory.create({ data: { applicationId: interview.application.id, fromStatus: 'INTERVIEW_SCHEDULED', toStatus: 'INTERVIEW_COMPLETED', note: 'Interview feedback recorded', changedById: actor.userId } });
    await recordAudit({ action: AUDIT_ACTIONS.INTERVIEW_FEEDBACK_RECORDED, entityType: 'Interview', entityId: interviewId, actorUserId: actor.userId, actorRole: actor.role, metadata: { applicationId: interview.application.id, recommendation: input.recommendation }, ipAddress: meta.ipAddress, userAgent: meta.userAgent }, tx);
    await notify({ userId: interview.application.candidateProfile.userId, type: NOTIFICATION_TYPES.INTERVIEW_FEEDBACK, title: 'Interview update', body: `Feedback has been recorded for ${interview.application.job.title}.`, entityType: 'Application', entityId: interview.application.id, link: '/candidate' }, tx);
    return feedback;
  });
}

