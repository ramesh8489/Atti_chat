import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger.js';

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

export const prisma =
  global.__prismaClient ||
  new PrismaClient({
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

