import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let redisInstance: Redis | null = null;
let isConnected = false;

export function getRedisClient(): Redis | null {
  if (!env.REDIS_ENABLED) {
    return null;
  }

  if (redisInstance) {
    return redisInstance;
  }

  try {
    redisInstance = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy(times: number) {
        if (times > 3) {
          logger.warn('Redis reconnection failed after 3 attempts. Continuing in memory-only mode.');
          return null; // Stop retrying
        }
        return Math.min(times * 200, 1000);
      },
      lazyConnect: true,
    });

    redisInstance.on('connect', () => {
      isConnected = true;
      logger.info('Connected to Redis cluster successfully.');
    });

    redisInstance.on('error', (err: Error) => {
      isConnected = false;
      logger.warn('Redis client error (graceful fallback active):', { message: err.message });
    });

    return redisInstance;
  } catch (error: any) {
    logger.warn('Failed to initialize Redis client. Fallback mode enabled.', { message: error.message });
    return null;
  }
}

export async function checkRedisConnection(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
  if (!env.REDIS_ENABLED) {
    return {
      connected: false,
      error: 'Redis is disabled via REDIS_ENABLED=false (using in-memory presence)',
    };
  }

  const client = getRedisClient();
  if (!client) {
    return { connected: false, error: 'Redis client not initialized' };
  }

  const start = Date.now();
  try {
    if (!isConnected) {
      await client.connect();
    }
    await client.ping();
    return {
      connected: true,
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err?.message || 'Redis ping failed',
    };
  }
}
