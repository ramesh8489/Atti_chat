import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger.js';

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

function getSanitizedDatabaseUrl(): string | undefined {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return undefined;

  const isPgBouncerPooler = rawUrl.includes('pooler.') || rawUrl.includes(':6543/');
  if (isPgBouncerPooler && !rawUrl.includes('pgbouncer=')) {
    const separator = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${separator}pgbouncer=true`;
  }
  return rawUrl;
}

const sanitizedUrl = getSanitizedDatabaseUrl();

export const prisma =
  global.__prismaClient ||
  new PrismaClient({
    ...(sanitizedUrl ? { datasources: { db: { url: sanitizedUrl } } } : {}),
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'info' },
      { emit: 'event', level: 'warn' },
    ],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prismaClient = prisma;
}

export async function checkDatabaseConnection(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      connected: true,
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    logger.warn('Database connection check failed:', { message: err?.message });
    return {
      connected: false,
      error: err?.message || 'Database unreachable',
    };
  }
}

