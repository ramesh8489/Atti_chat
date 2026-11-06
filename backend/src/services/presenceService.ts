import { prisma } from '../database/prisma.js';
import { getRedisClient } from '../redis/redisClient.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

// In-memory mappings for fast lookups & zero-dependency fallback
const userSocketsMap = new Map<string, Set<string>>();
const socketToUserMap = new Map<string, string>();

export interface PresenceStatus {
  userId: string;
  isOnline: boolean;
  lastSeenAt: Date;
}

/**
 * Register a user socket connection and transition to ONLINE if first socket.
 */
export async function setUserOnline(userId: string, socketId: string): Promise<{ isNewlyOnline: boolean }> {
  socketToUserMap.set(socketId, userId);

  let sockets = userSocketsMap.get(userId);
  if (!sockets) {
    sockets = new Set<string>();
    userSocketsMap.set(userId, sockets);
  }

  const isNewlyOnline = sockets.size === 0;
  sockets.add(socketId);

  if (isNewlyOnline) {
    const now = new Date();
    try {
      // Update DB record
      await prisma.user.update({
        where: { id: userId },
        data: {
          isOnline: true,
          lastSeenAt: now,
        },
      });

      // Update Redis if enabled
      if (env.REDIS_ENABLED) {
        const redis = getRedisClient();
        if (redis) {
          await redis.set(`presence:${userId}`, 'online', 'EX', 86400);
        }
      }
    } catch (err: any) {
      logger.warn(`Failed to persist user ${userId} online status to DB/Redis:`, { message: err?.message });
    }
  }

  return { isNewlyOnline };
}

/**
 * Handle socket disconnection and transition to OFFLINE if all sockets closed.
 */
export async function setUserOffline(userId: string, socketId: string): Promise<{ isNowOffline: boolean; lastSeenAt: Date }> {
  socketToUserMap.delete(socketId);

  const sockets = userSocketsMap.get(userId);
  let isNowOffline = false;
  const now = new Date();

  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) {
      userSocketsMap.delete(userId);
      isNowOffline = true;
    }
  } else {
    isNowOffline = true;
  }

  if (isNowOffline) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isOnline: false,
          lastSeenAt: now,
        },
      });

      if (env.REDIS_ENABLED) {
        const redis = getRedisClient();
        if (redis) {
          await redis.del(`presence:${userId}`);
        }
      }
    } catch (err: any) {
      logger.warn(`Failed to persist user ${userId} offline status to DB/Redis:`, { message: err?.message });
    }
  }

  return { isNowOffline, lastSeenAt: now };
}

/**
 * Cleanup on socket disconnect when only socketId is known.
 */
export async function handleSocketDisconnect(socketId: string): Promise<{ userId?: string; isNowOffline: boolean; lastSeenAt: Date }> {
  const userId = socketToUserMap.get(socketId);
  if (!userId) {
    return { isNowOffline: false, lastSeenAt: new Date() };
  }

  const result = await setUserOffline(userId, socketId);
  return {
    userId,
    isNowOffline: result.isNowOffline,
    lastSeenAt: result.lastSeenAt,
  };
}

/**
 * Check if a user is currently online.
 */
export function isUserOnline(userId: string): boolean {
  const sockets = userSocketsMap.get(userId);
  return !!sockets && sockets.size > 0;
}

/**
 * Retrieve all active socket IDs for a given user.
 */
export function getUserSockets(userId: string): string[] {
  const sockets = userSocketsMap.get(userId);
  return sockets ? Array.from(sockets) : [];
}

/**
 * Reset internal presence state (used in automated testing).
 */
export function resetPresenceState(): void {
  userSocketsMap.clear();
  socketToUserMap.clear();
}

