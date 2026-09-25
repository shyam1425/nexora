import { prisma } from '@/lib/prisma';
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { notify, NOTIFICATION_TYPES } from '@/lib/notifications/service';
import type { Role } from '@/generated/prisma/enums';
import type { CompleteJoiningInput } from '@/lib/validation/joining';
import type { RequestMeta } from './auth-service';

export async function completeJoining(joiningId: string, input: CompleteJoiningInput, actor: { userId: string; role: Role }, meta: RequestMeta) {
  return prisma.$transaction(async (tx) => {
    const joining = await tx.joining.findUnique({
      where: { id: joiningId },
      select: {
        id: true,
        status: true,
        employeeCode: true,
        employeeId: true,
        candidateProfile: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            user: { select: { email: true } },
          },
        },
        offer: {
          select: {
            designation: true,
            annualCtc: true,
            currency: true,
            application: {
              select: {
                id: true,
                status: true,
                job: {
                  select: {
                    clientId: true,
                    title: true,
                    employmentType: true,
                    workMode: true,
                    recruiterId: true,
                    createdById: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!joining) throw new NotFoundError('Joining record');
    if (joining.employeeId) throw new ConflictError('An employee record already exists for this joining');
    if (!['PENDING', 'DOCUMENTS_PENDING'].includes(joining.status)) throw new BusinessRuleError('Only pending joining records can be completed');
    const job = joining.offer.application?.job;
    if (!job) throw new BusinessRuleError('Joining record is not linked to an application job');
    if (!['SUPER_ADMIN', 'ADMIN', 'RECRUITER'].includes(actor.role)) throw new ForbiddenError('Only HR and recruitment staff can complete joining');
    if (actor.role === 'RECRUITER' && ![job.recruiterId, job.createdById].includes(actor.userId)) throw new ForbiddenError('You are not assigned to this job');
    const changed = await tx.joining.updateMany({ where: { id: joining.id, status: joining.status, employeeId: null }, data: { status: 'COMPLETED', actualJoiningDate: input.actualJoiningDate, notes: input.notes || null } });
    if (changed.count !== 1) throw new ConflictError('Joining record changed while completing it');
    const employee = await tx.employee.create({ data: { employeeCode: joining.employeeCode, userId: joining.candidateProfile.userId, clientId: job.clientId, firstName: joining.candidateProfile.firstName, lastName: joining.candidateProfile.lastName, email: joining.candidateProfile.user.email, designation: joining.offer.designation, employmentType: job.employmentType, workMode: job.workMode, status: 'ACTIVE', dateOfJoining: input.actualJoiningDate, annualCtc: joining.offer.annualCtc, currency: joining.offer.currency, notes: input.notes || null }, select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true, designation: true, status: true, dateOfJoining: true } });
    await tx.joining.update({ where: { id: joining.id }, data: { employeeId: employee.id } });
    await tx.user.update({ where: { id: joining.candidateProfile.userId }, data: { role: 'EMPLOYEE', status: 'ACTIVE' } });
    const applicationChanged = await tx.application.updateMany({ where: { id: joining.offer.application.id, status: 'JOINING' }, data: { status: 'JOINED', joinedAt: input.actualJoiningDate } });
    if (applicationChanged.count !== 1) throw new ConflictError('Application status changed while completing joining');
    await tx.applicationStatusHistory.create({ data: { applicationId: joining.offer.application.id, fromStatus: 'JOINING', toStatus: 'JOINED', note: 'Employee joined', changedById: actor.userId } });
    await recordAudit({ action: AUDIT_ACTIONS.JOINING_COMPLETED, entityType: 'Joining', entityId: joining.id, actorUserId: actor.userId, actorRole: actor.role, metadata: { employeeId: employee.id, employeeCode: employee.employeeCode }, ipAddress: meta.ipAddress, userAgent: meta.userAgent }, tx);
    await recordAudit({ action: AUDIT_ACTIONS.EMPLOYEE_CREATED, entityType: 'Employee', entityId: employee.id, actorUserId: actor.userId, actorRole: actor.role, metadata: { employeeCode: employee.employeeCode, userId: joining.candidateProfile.userId }, ipAddress: meta.ipAddress, userAgent: meta.userAgent }, tx);
    await notify({ userId: joining.candidateProfile.userId, type: NOTIFICATION_TYPES.EMPLOYEE_ONBOARDED, title: 'Welcome to the team', body: 'Your employee profile is now active.', entityType: 'Employee', entityId: employee.id, link: '/employee' }, tx);
    return employee;
  });
}
