import path from 'node:path';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { DOCUMENT_UPLOAD_TYPES, generateStorageKey, getStorage } from '@/lib/storage';
import type { Role } from '@/generated/prisma/enums';
import type { UploadDocumentInput } from '@/lib/validation/document';
import type { RequestMeta } from './auth-service';

type UploadData = { originalName: string; mimeType: string; data: Buffer };

/** Magic-byte signature required for each accepted document format. */
const SIGNATURES: Record<string, { hex?: string; ascii?: string; label: string }> = {
  '.pdf': { ascii: '%PDF', label: 'PDF' },
  '.docx': { hex: '504B0304', label: 'DOCX archive' },
  '.doc': { hex: 'D0CF11E0', label: 'DOC document' },
};

/**
 * Validates an upload against the canonical policy in `lib/storage/types.ts`:
 * the extension must be one of the accepted extensions for its declared MIME
 * type, the size must be within the configured limit, and the leading bytes must
 * match the format signature. A file rename cannot bypass this.
 */
function validateFile(file: UploadData): void {
  const extension = path.extname(file.originalName).toLowerCase();
  const allowedExtensions = DOCUMENT_UPLOAD_TYPES[file.mimeType];
  if (!allowedExtensions || !allowedExtensions.includes(extension)) {
    throw new ValidationError('Only PDF, DOC, and DOCX documents are supported');
  }
  if (file.data.byteLength === 0 || file.data.byteLength > env.STORAGE_MAX_UPLOAD_MB * 1024 * 1024) throw new ValidationError(`Document must be between 1 byte and ${env.STORAGE_MAX_UPLOAD_MB} MB`);
  const signature = SIGNATURES[extension];
  const prefixHex = file.data.subarray(0, 4).toString('hex').toUpperCase();
  const prefixAscii = file.data.subarray(0, 4).toString();
  if (signature.hex && prefixHex !== signature.hex) throw new ValidationError(`The uploaded file is not a valid ${signature.label}`);
  if (signature.ascii && prefixAscii !== signature.ascii) throw new ValidationError(`The uploaded file is not a valid ${signature.label}`);
}

export async function uploadDocument(actor: { userId: string; role: Role }, input: UploadDocumentInput, file: UploadData, meta: RequestMeta) {
  validateFile(file);
  let candidateProfileId = input.candidateProfileId || null;
  let employeeId = input.employeeId || null;
  let ownerUserId = actor.userId;

  if (actor.role === 'CANDIDATE') {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId: actor.userId }, select: { id: true, userId: true } });
    if (!profile) throw new NotFoundError('Candidate profile');
    if (candidateProfileId && candidateProfileId !== profile.id) throw new ForbiddenError('You can only upload documents to your own candidate profile');
    if (employeeId) throw new ForbiddenError('Candidates cannot upload employee documents');
    candidateProfileId = profile.id;
    ownerUserId = profile.userId;
  } else if (actor.role === 'EMPLOYEE') {
    const employee = await prisma.employee.findUnique({ where: { userId: actor.userId }, select: { id: true, userId: true } });
    if (!employee) throw new NotFoundError('Employee profile');
    if (employeeId && employeeId !== employee.id) throw new ForbiddenError('You can only upload documents to your own employee profile');
    if (candidateProfileId) throw new ForbiddenError('Employees cannot upload candidate documents');
    employeeId = employee.id;
    ownerUserId = employee.userId ?? actor.userId;
  }

  if (candidateProfileId) {
    const profile = await prisma.candidateProfile.findUnique({ where: { id: candidateProfileId }, select: { id: true, userId: true, applications: { where: { job: { recruiterId: actor.userId, deletedAt: null } }, select: { id: true }, take: 1 } } });
    if (!profile) throw new NotFoundError('Candidate profile');
    if (actor.role === 'CLIENT') throw new ForbiddenError('Clients cannot upload candidate documents');
    if (actor.role === 'RECRUITER' && profile.applications.length === 0) throw new ForbiddenError('You are not assigned to this candidate');
    if (actor.role === 'RECRUITER') ownerUserId = profile.userId ?? actor.userId;
  }
  if (employeeId && !['SUPER_ADMIN', 'ADMIN'].includes(actor.role)) {
    if (actor.role !== 'EMPLOYEE') throw new ForbiddenError('Only HR administrators can upload employee documents');
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
    if (!employee) throw new NotFoundError('Employee profile');
  }
  if (input.category === 'RESUME' && !candidateProfileId) throw new ValidationError('Resume uploads must be linked to a candidate profile');

  const storageKey = generateStorageKey(actor.userId, file.originalName);
  const storage = getStorage();
  const stored = await storage.put(storageKey, file.data, file.mimeType);
  try {
    const document = await prisma.$transaction(async (tx) => {
      const created = await tx.document.create({ data: { storageKey, originalName: path.basename(file.originalName).slice(0, 255), mimeType: file.mimeType, sizeBytes: file.data.byteLength, checksum: stored.checksum, category: input.category, ownerUserId, candidateProfileId, employeeId, applicationId: input.applicationId || null, uploadedById: actor.userId }, select: { id: true, originalName: true, category: true, sizeBytes: true, createdAt: true } });
      if (input.category === 'RESUME' && candidateProfileId) {
        const previous = await tx.candidateProfile.findUnique({ where: { id: candidateProfileId }, select: { resumeDocumentId: true } });
        if (previous?.resumeDocumentId && previous.resumeDocumentId !== created.id) await tx.document.update({ where: { id: previous.resumeDocumentId }, data: { deletedAt: new Date() } });
        await tx.candidateProfile.update({ where: { id: candidateProfileId }, data: { resumeDocumentId: created.id } });
      }
      await recordAudit({ action: AUDIT_ACTIONS.DOCUMENT_UPLOADED, entityType: 'Document', entityId: created.id, actorUserId: actor.userId, actorRole: actor.role, metadata: { category: input.category, sizeBytes: file.data.byteLength, candidateProfileId, employeeId }, ipAddress: meta.ipAddress, userAgent: meta.userAgent }, tx);
      return created;
    });
    return document;
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
}
