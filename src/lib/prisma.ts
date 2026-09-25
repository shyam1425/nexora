import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@/generated/prisma/client';
import { databaseAdapterConfig, normalizeCertificateAuthority } from './database-config';
import { env } from './env';

/**
 * Prisma client singleton.
 *
 * Next.js hot-reloads modules in development; without a global cache every
 * reload would open a new connection pool and exhaust MySQL connections.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaMariaDb(
  databaseAdapterConfig(
    env.DATABASE_URL,
    env.DATABASE_SSL_CA ? normalizeCertificateAuthority(env.DATABASE_SSL_CA) : undefined,
  ),
);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'production'
        ? ['warn', 'error']
        : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
