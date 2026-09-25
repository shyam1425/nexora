import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { clientIp, routeHandler, userAgent } from '@/lib/api';
import { requireAuth } from '@/lib/auth/rbac';
import { getDocumentForAccess } from '@/lib/services/document-access-service';

export const runtime = 'nodejs';

export const GET = routeHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const auth = await requireAuth();
  const { id } = await context.params;
  const result = await getDocumentForAccess(id, { userId: auth.user.id, role: auth.user.role }, { ipAddress: clientIp(request), userAgent: userAgent(request) });
  const safeName = result.document.originalName.replace(/[\r\n"\\]/g, '_');
  return new NextResponse(new Uint8Array(result.data), { status: 200, headers: { 'content-type': result.document.mimeType, 'content-length': String(result.data.byteLength), 'content-disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(result.document.originalName)}`, 'cache-control': 'private, no-store' } });
});
