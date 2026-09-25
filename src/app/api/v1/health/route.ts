import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ success: true, data: { status: 'ok', database: 'up', timestamp: new Date().toISOString() } });
  } catch (error) {
    logger.error('health_check_failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Service dependencies are unavailable' } }, { status: 503 });
  }
}
