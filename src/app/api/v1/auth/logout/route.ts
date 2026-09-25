import type { NextRequest } from 'next/server';
import { assertSameOrigin, ok, routeHandler } from '@/lib/api';
import { getAuthContext, revokeCurrentSession } from '@/lib/auth/session';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export const POST = routeHandler(async (request: NextRequest) => {
  assertSameOrigin(request);

  const auth = await getAuthContext();
  const response = ok({ loggedOut: true });

  if (auth) {
    await recordAudit({
      action: AUDIT_ACTIONS.LOGOUT,
      entityType: 'User',
      entityId: auth.user.id,
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
    });
  }

  await revokeCurrentSession(response);
  return response;
});
