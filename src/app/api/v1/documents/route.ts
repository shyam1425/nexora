import type { NextRequest } from 'next/server';
import { assertSameOrigin, clientIp, created, routeHandler, userAgent } from '@/lib/api';
import { requireVerifiedPermission } from '@/lib/auth/rbac';
import { env } from '@/lib/env';
import { ValidationError } from '@/lib/errors';
import { uploadDocument } from '@/lib/services/document-service';
import { uploadDocumentSchema } from '@/lib/validation/document';

export const runtime = 'nodejs';

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

export const POST = routeHandler(async (request: NextRequest) => {
  assertSameOrigin(request);
  const auth = await requireVerifiedPermission('document.upload');
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new ValidationError('A document file is required');
  if (file.size > env.STORAGE_MAX_UPLOAD_MB * 1024 * 1024) throw new ValidationError(`Document must be smaller than ${env.STORAGE_MAX_UPLOAD_MB} MB`);
  const parsed = uploadDocumentSchema.safeParse({ category: field(form, 'category') || 'OTHER', candidateProfileId: field(form, 'candidateProfileId'), employeeId: field(form, 'employeeId'), applicationId: field(form, 'applicationId') });
  if (!parsed.success) throw new ValidationError('Invalid document metadata');
  const document = await uploadDocument({ userId: auth.user.id, role: auth.user.role }, parsed.data, { originalName: file.name, mimeType: file.type, data: Buffer.from(await file.arrayBuffer()) }, { ipAddress: clientIp(request), userAgent: userAgent(request) });
  return created({ document });
});
