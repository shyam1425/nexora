import { prisma } from '@/lib/prisma';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { getStorage } from '@/lib/storage';
import type { Role } from '@/generated/prisma/enums';
import type { RequestMeta } from './auth-service';

export async function getDocumentForAccess(documentId: string, actor: { userId: string; role: Role }, meta: RequestMeta) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, deletedAt: null },
    select: {
      id: true,
      storageKey: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      checksum: true,
      ownerUserId: true,
      uploadedById: true,
      applicationId: true,
      candidateProfile: {
        select: {
          userId: true,
          applications: { select: { job: { select: { recruiterId: true, clientId: true } } } },
        },
      },
      employee: { select: { userId: true, clientId: true } },
    },
  });
  if (!document) throw new NotFoundError('Document');
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(actor.role);
  const isOwner = document.ownerUserId === actor.userId || document.uploadedById === actor.userId || document.candidateProfile?.userId === actor.userId || document.employee?.userId === actor.userId;
  const linkedApplication = document.applicationId
    ? await prisma.application.findUnique({ where: { id: document.applicationId }, select: { job: { select: { recruiterId: true, clientId: true } } } })
    : null;
  const assignedJob = [...(document.candidateProfile?.applications.map((item) => item.job) ?? []), ...(linkedApplication ? [linkedApplication.job] : [])];
  const isAssignedRecruiter = actor.role === 'RECRUITER' && assignedJob.some((job) => job.recruiterId === actor.userId);
  let isClientMember = false;
  if (actor.role === 'CLIENT') {
    const clientIds = new Set([...assignedJob.map((job) => job.clientId), ...(document.employee?.clientId ? [document.employee.clientId] : [])].filter((id): id is string => Boolean(id)));
    if (clientIds.size) isClientMember = Boolean(await prisma.clientUser.findFirst({ where: { userId: actor.userId, clientId: { in: [...clientIds] }, client: { deletedAt: null } }, select: { id: true } }));
  }
  if (!isAdmin && !isOwner && !isAssignedRecruiter && !isClientMember) throw new ForbiddenError('You do not have access to this document');
  const data = await getStorage().get(document.storageKey);
  await prisma.documentAccessLog.create({ data: { documentId: document.id, userId: actor.userId, action: 'READ', ipAddress: meta.ipAddress } });
  await recordAudit({ action: AUDIT_ACTIONS.DOCUMENT_ACCESSED, entityType: 'Document', entityId: document.id, actorUserId: actor.userId, actorRole: actor.role, metadata: { sizeBytes: document.sizeBytes }, ipAddress: meta.ipAddress, userAgent: meta.userAgent });
  return { document, data };
}
