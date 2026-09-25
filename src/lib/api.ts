import { NextRequest, NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { resolveClientIp } from './client-ip';
import { env } from './env';
import { AppError, ValidationError } from './errors';
import { logger } from './logger';

export type ApiSuccessBody<T> = { success: true; data: T };
export type ApiErrorBody = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccessBody<T>> {
  return NextResponse.json({ success: true as const, data }, init);
}

export function created<T>(data: T): NextResponse<ApiSuccessBody<T>> {
  return ok(data, { status: 201 });
}

export function fail(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { success: false as const, error: { code, message, details } },
    { status },
  );
}

/**
 * Wraps a route handler with uniform error handling so that unexpected
 * exceptions never leak stack traces to clients.
 */
export function routeHandler<Ctx>(
  handler: (request: NextRequest, context: Ctx) => Promise<NextResponse>,
) {
  return async (request: NextRequest, context: Ctx): Promise<NextResponse> => {
    const started = Date.now();
    try {
      const response = await handler(request, context);
      logRequest(request, response.status, started);
      return response;
    } catch (error) {
      if (error instanceof AppError) {
        logRequest(request, error.statusCode, started, error.code);
        return fail(error.code, error.message, error.statusCode, error.details);
      }

      if (error instanceof ZodError) {
        logRequest(request, 422, started, 'VALIDATION_ERROR');
        return fail('VALIDATION_ERROR', 'The submitted data is invalid', 422, zodDetails(error));
      }

      logger.error('Unhandled API error', {
        path: request.nextUrl.pathname,
        method: request.method,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      logRequest(request, 500, started, 'INTERNAL_ERROR');
      return fail('INTERNAL_ERROR', 'An unexpected error occurred', 500);
    }
  };
}

function logRequest(
  request: NextRequest,
  status: number,
  started: number,
  code?: string,
): void {
  logger.info('api_request', {
    method: request.method,
    path: request.nextUrl.pathname,
    status,
    durationMs: Date.now() - started,
    ...(code ? { code } : {}),
  });
}

export function zodDetails(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/** Reads and validates a JSON request body. */
export async function parseJsonBody<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ValidationError('Request body must be valid JSON');
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError('The submitted data is invalid', zodDetails(parsed.error));
  }
  return parsed.data;
}

/** Validates URL search params against a schema. */
export function parseSearchParams<T>(request: NextRequest, schema: ZodType<T>): T {
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError('Invalid query parameters', zodDetails(parsed.error));
  }
  return parsed.data;
}

const MAX_PAGE_SIZE = 100;

export function getPagination(request: NextRequest): {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
} {
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') ?? 1) || 1);
  const requested = Number(request.nextUrl.searchParams.get('pageSize') ?? 20) || 20;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requested));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paginated<T>(items: T[], total: number, page: number, pageSize: number) {
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

/**
 * CSRF defence for state-changing requests.
 *
 * Sessions live in SameSite=Lax cookies, so cross-site form posts already
 * cannot carry them; this additionally rejects requests whose Origin/Referer
 * does not match the configured application origin.
 */
export function assertSameOrigin(request: NextRequest): void {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;

  const allowed = new Set<string>();
  try {
    allowed.add(new URL(process.env.APP_URL ?? '').origin);
  } catch {
    /* APP_URL is validated at boot by src/lib/env.ts */
  }
  const origin = request.headers.get('origin');
  if (origin) {
    if (!allowed.has(origin)) {
      throw new AppError('CSRF_ORIGIN_MISMATCH', 'Cross-origin request rejected', 403);
    }
    return;
  }

  const referer = request.headers.get('referer');
  if (referer) {
    let refererOrigin: string | null = null;
    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      refererOrigin = null;
    }
    if (!refererOrigin || !allowed.has(refererOrigin)) {
      throw new AppError('CSRF_ORIGIN_MISMATCH', 'Cross-origin request rejected', 403);
    }
    return;
  }

  throw new AppError('CSRF_ORIGIN_REQUIRED', 'Origin or referer header is required', 403);
}

/**
 * Resolves the caller address.
 *
 * Forwarding headers are attacker-controlled unless a reverse proxy is
 * explicitly trusted, so `TRUST_PROXY` decides whether they are read at all and
 * the right-most hop wins. See `src/lib/client-ip.ts`.
 */
export function clientIp(request: NextRequest): string {
  return resolveClientIp({
    forwardedFor: request.headers.get('x-forwarded-for'),
    realIp: request.headers.get('x-real-ip'),
    trustProxy: env.TRUST_PROXY,
  });
}

export function userAgent(request: NextRequest): string {
  return request.headers.get('user-agent') ?? 'unknown';
}
