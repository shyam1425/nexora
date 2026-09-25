import { NextRequest, NextResponse } from 'next/server';

/**
 * Coarse-grained gate for private areas. Real authentication and role checks
 * remain server-side in portal pages and API handlers; this proxy only avoids
 * rendering a private shell for anonymous visitors.
 */
const PRIVATE_PREFIXES = ['/admin', '/recruiter', '/client', '/candidate', '/employee'];
const SESSION_COOKIE = 'workfox_session';

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const isPrivate = PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!isPrivate || request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/recruiter/:path*',
    '/client/:path*',
    '/candidate/:path*',
    '/employee/:path*',
  ],
};
