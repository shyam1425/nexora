import type { NextRequest } from 'next/server';
import {
  assertSameOrigin,
  clientIp,
  ok,
  parseJsonBody,
  routeHandler,
  userAgent,
} from '@/lib/api';
import { requireAuth } from '@/lib/auth/rbac';
import { clearSessionCookie } from '@/lib/auth/session';
import { changePassword } from '@/lib/services/auth-service';
import { changePasswordSchema } from '@/lib/validation/auth';

export const runtime = 'nodejs';

/**
 * Changing a password revokes every session (including the current one), so the
 * user is explicitly signed out and must authenticate with the new password.
 */
export const POST = routeHandler(async (request: NextRequest) => {
  assertSameOrigin(request);
  const auth = await requireAuth();
  const body = await parseJsonBody(request, changePasswordSchema);

  await changePassword(
    auth.user.id,
    body.currentPassword,
    body.newPassword,
    { ipAddress: clientIp(request), userAgent: userAgent(request) },
  );

  const response = ok({
    changed: true,
    message: 'Password updated. Please sign in again with your new password.',
  });
  clearSessionCookie(response);
  return response;
});
