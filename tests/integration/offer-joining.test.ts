import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { applyToJob } from '@/lib/services/application-service';
import { transitionApplicationStatus } from '@/lib/services/application-state';
import { createAndSendOffer, respondToOffer } from '@/lib/services/offer-service';
import { recordInterviewFeedback, scheduleInterview } from '@/lib/services/interview-service';
import { completeJoining } from '@/lib/services/joining-service';
import { registerCandidate } from '@/lib/services/auth-service';

describe('offer acceptance and joining workflow', () => {
  it('moves a selected application through offer acceptance to an employee record', async () => {
    const suffix = randomUUID().slice(0, 8);
    const client = await prisma.client.create({ data: { name: `Workflow Client ${suffix}`, code: `workflow-client-${suffix}` } });
    const job = await prisma.job.create({ data: { clientId: client.id, title: `Workflow Role ${suffix}`, slug: `workflow-role-${suffix}`, description: 'A complete workflow test role description.', status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date() } });
    const email = `candidate.workflow.${suffix}@example.com`;
    const password = 'StrongPass123';
    const registered = await registerCandidate({ firstName: 'Workflow', lastName: 'Candidate', email, phone: '', password, confirmPassword: password, acceptTerms: true }, { ipAddress: '127.0.0.1', userAgent: 'vitest' });
    await prisma.user.update({ where: { id: registered.user.id }, data: { emailVerifiedAt: new Date() } });
    const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN', deletedAt: null }, select: { id: true } });
    expect(admin).not.toBeNull();

    try {
      const application = await applyToJob(registered.user.id, { jobId: job.id, coverLetter: '' }, { ipAddress: '127.0.0.1', userAgent: 'vitest' });
      if (!admin) throw new Error('Test requires a seeded super admin');
      const actor = { userId: admin.id, role: 'SUPER_ADMIN' as const };
      for (const status of ['SCREENING', 'SHORTLISTED'] as const) {
        await transitionApplicationStatus(application.id, { toStatus: status }, actor, { ipAddress: '127.0.0.1', userAgent: 'vitest' });
      }
      await expect(transitionApplicationStatus(application.id, { toStatus: 'INTERVIEW_SCHEDULED' }, actor, { ipAddress: '127.0.0.1', userAgent: 'vitest' })).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
      expect(await prisma.interview.count({ where: { applicationId: application.id } })).toBe(0);
      const interview = await scheduleInterview({ applicationId: application.id, scheduledAt: new Date(Date.now() + 86400000), durationMinutes: 45, mode: 'VIDEO', roundNumber: 1, roundName: 'Technical' }, actor, { ipAddress: '127.0.0.1', userAgent: 'vitest' });
      await expect(transitionApplicationStatus(application.id, { toStatus: 'INTERVIEW_COMPLETED' }, actor, { ipAddress: '127.0.0.1', userAgent: 'vitest' })).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
      expect(await prisma.interviewFeedback.count({ where: { interviewId: interview.id } })).toBe(0);
      await recordInterviewFeedback(interview.id, { overallRating: 5, recommendation: 'STRONG_YES', strengths: 'Strong system design' }, actor, { ipAddress: '127.0.0.1', userAgent: 'vitest' });
      await transitionApplicationStatus(application.id, { toStatus: 'SELECTED' }, actor, { ipAddress: '127.0.0.1', userAgent: 'vitest' });
      const offer = await createAndSendOffer({ applicationId: application.id, designation: 'Workflow Engineer', annualCtc: 1200000, currency: 'INR', joiningDate: new Date(Date.now() + 7 * 86400000) }, actor, { ipAddress: '127.0.0.1', userAgent: 'vitest' });
      expect(offer.status).toBe('SENT');
      await expect(transitionApplicationStatus(application.id, { toStatus: 'OFFER_ACCEPTED' }, actor, { ipAddress: '127.0.0.1', userAgent: 'vitest' })).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
      await expect(transitionApplicationStatus(application.id, { toStatus: 'OFFER_DECLINED' }, actor, { ipAddress: '127.0.0.1', userAgent: 'vitest' })).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
      expect(await prisma.joining.count({ where: { applicationId: application.id } })).toBe(0);
      const response = await respondToOffer(offer.id, { decision: 'ACCEPT' }, { userId: registered.user.id, role: 'CANDIDATE' }, { ipAddress: '127.0.0.1', userAgent: 'vitest' });
      expect(response.status).toBe('ACCEPTED');
      expect(response.joining?.status).toBe('PENDING');
      if (!response.joining) throw new Error('Joining record was not created');
      const employee = await completeJoining(response.joining.id, { actualJoiningDate: new Date() }, actor, { ipAddress: '127.0.0.1', userAgent: 'vitest' });
      expect(employee.employeeCode).toBe(response.joining.employeeCode);
      const updatedUser = await prisma.user.findUnique({ where: { id: registered.user.id }, select: { role: true } });
      expect(updatedUser?.role).toBe('EMPLOYEE');
      const updatedApplication = await prisma.application.findUnique({ where: { id: application.id }, select: { status: true } });
      expect(updatedApplication?.status).toBe('JOINED');
    } finally {
      await prisma.employee.deleteMany({ where: { userId: registered.user.id } });
      await prisma.application.deleteMany({ where: { candidateProfile: { userId: registered.user.id } } });
      await prisma.joining.deleteMany({ where: { candidateProfile: { userId: registered.user.id } } });
      await prisma.job.delete({ where: { id: job.id } });
      await prisma.client.delete({ where: { id: client.id } });
      await prisma.$transaction([
        prisma.auditLog.deleteMany({ where: { actorUserId: registered.user.id } }),
        prisma.notification.deleteMany({ where: { userId: registered.user.id } }),
        prisma.session.deleteMany({ where: { userId: registered.user.id } }),
        prisma.verificationToken.deleteMany({ where: { userId: registered.user.id } }),
        prisma.candidateProfile.deleteMany({ where: { userId: registered.user.id } }),
        prisma.user.deleteMany({ where: { id: registered.user.id } }),
      ]);
    }
  });
});
