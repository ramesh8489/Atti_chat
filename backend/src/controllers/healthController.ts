import { Request, Response } from 'express';
import { checkDatabaseConnection } from '../database/prisma.js';
import { checkRedisConnection } from '../redis/redisClient.js';
import { HTTP_STATUS } from '../constants/index.js';

export async function getLiveness(_req: Request, res: Response) {
  return res.status(HTTP_STATUS.OK).json({
    status: 'ok',
    service: 'atti-api',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}

export async function getReadiness(_req: Request, res: Response) {
  const [dbStatus, redisStatus] = await Promise.all([
    checkDatabaseConnection(),
    checkRedisConnection(),
  ]);

  const isHealthy = dbStatus.connected; // Redis may be disabled in local dev mode

  const payload = {
    status: isHealthy ? 'ready' : 'degraded',
    service: 'atti-api',
    checks: {
      database: {
        status: dbStatus.connected ? 'up' : 'down',
        latencyMs: dbStatus.latencyMs,
        ...(dbStatus.error ? { message: dbStatus.error } : {}),
      },
      redis: {
        status: redisStatus.connected ? 'up' : 'degraded/disabled',
        latencyMs: redisStatus.latencyMs,
        ...(redisStatus.error ? { message: redisStatus.error } : {}),
      },
    },
    timestamp: new Date().toISOString(),
  };

  return res.status(isHealthy ? HTTP_STATUS.OK : HTTP_STATUS.OK).json(payload);
}

