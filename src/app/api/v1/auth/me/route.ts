import { ok, routeHandler } from '@/lib/api';
import { getAuthContext } from '@/lib/auth/session';

export const runtime = 'nodejs';

/** Returns the authenticated identity for client-side bootstrapping. */
export const GET = routeHandler(async () => {
  const auth = await getAuthContext();
  if (!auth) {
    return ok({ authenticated: false, user: null });
  }

  return ok({
    authenticated: true,
    user: {
      id: auth.user.id,
      email: auth.user.email,
      name: auth.user.name,
      role: auth.user.role,
      status: auth.user.status,
      emailVerified: Boolean(auth.user.emailVerifiedAt),
    },
    session: {
      expiresAt: auth.expiresAt.toISOString(),
    },
  });
});
