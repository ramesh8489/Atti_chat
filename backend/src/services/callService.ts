import { prisma } from '../database/prisma.js';
import { logger } from '../config/logger.js';
import { getRedisClient } from '../redis/redisClient.js';
import { env } from '../config/env.js';
import { NotificationType } from '@prisma/client';
import { isBlocked } from './blockService.js';
import { createAndSendNotification } from './notificationService.js';

export interface ActiveCall {
  callId: string;
  conversationId: string;
  callerId: string;
  callerSocketId: string;
  receiverId: string;
  receiverSocketId?: string;
  type: 'AUDIO' | 'VIDEO';
  status: 'INITIATED' | 'RINGING' | 'ONGOING' | 'ENDED' | 'REJECTED' | 'BUSY' | 'UNAVAILABLE' | 'FAILED';
  startedAt: Date;
  acceptedAt?: Date;
  endedAt?: Date;
  durationSec?: number;
}

// In-memory active call lookup
const inMemoryActiveCalls = new Map<string, ActiveCall>();
// Lookup active call by userId
const userCallMap = new Map<string, string>(); // userId -> callId

// Call initiation rate limiter (userId -> timestamps)
const callRateLimits = new Map<string, number[]>();
const MAX_CALLS_PER_MINUTE = 6;

export function checkCallRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const timestamps = (callRateLimits.get(userId) || []).filter((t) => now - t < windowMs);

  if (timestamps.length >= MAX_CALLS_PER_MINUTE) {
    return false;
  }

  timestamps.push(now);
  callRateLimits.set(userId, timestamps);
  return true;
}

/**
 * Validate that caller and receiver belong to the given conversation.
 */
export async function validateCallParticipants(
  conversationId: string,
  callerId: string,
  receiverId: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const blocked = await isBlocked(callerId, receiverId);
    if (blocked) {
      return { valid: false, error: 'Cannot call user due to privacy or block restrictions' };
    }

    const participants = await prisma.conversationParticipant.findMany({
      where: {
        conversationId,
        userId: { in: [callerId, receiverId] },
      },
      select: { userId: true },
    });

    const userIds = participants.map((p) => p.userId);
    if (!userIds.includes(callerId)) {
      return { valid: false, error: 'Caller is not a participant in this conversation' };
    }
    if (!userIds.includes(receiverId)) {
      return { valid: false, error: 'Receiver is not a participant in this conversation' };
    }

    return { valid: true };
  } catch (err: any) {
    logger.error('Error validating call participants:', { message: err?.message });
    return { valid: false, error: 'Failed to validate conversation participants' };
  }
}

/**
 * Checks if a user is currently in an active or ringing call.
 */
export function isUserInActiveCall(userId: string): boolean {
  const activeCallId = userCallMap.get(userId);
  if (!activeCallId) return false;

  const call = inMemoryActiveCalls.get(activeCallId);
  if (!call) {
    userCallMap.delete(userId);
    return false;
  }

  return ['INITIATED', 'RINGING', 'ONGOING'].includes(call.status);
}

/**
 * Get active call by ID.
 */
export function getActiveCall(callId: string): ActiveCall | undefined {
  return inMemoryActiveCalls.get(callId);
}

/**
 * Get active call by User ID.
 */
export function getActiveCallForUser(userId: string): ActiveCall | undefined {
  const callId = userCallMap.get(userId);
  return callId ? inMemoryActiveCalls.get(callId) : undefined;
}

/**
 * Initiates a new call session.
 */
export async function initiateCallSession(params: {
  conversationId: string;
  callerId: string;
  callerSocketId: string;
  receiverId: string;
  type: 'AUDIO' | 'VIDEO';
}): Promise<ActiveCall> {
  const { conversationId, callerId, callerSocketId, receiverId, type } = params;

  // 1. Create DB CallSession record
  const dbSession = await prisma.callSession.create({
    data: {
      conversationId,
      initiatorId: callerId,
      type: type === 'VIDEO' ? 'VIDEO' : 'AUDIO',
      status: 'INITIATED',
      participants: {
        create: [
          { userId: callerId, status: 'INITIATED' },
          { userId: receiverId, status: 'INITIATED' },
        ],
      },
    },
  });

  const activeCall: ActiveCall = {
    callId: dbSession.id,
    conversationId,
    callerId,
    callerSocketId,
    receiverId,
    type,
    status: 'INITIATED',
    startedAt: new Date(),
  };

  inMemoryActiveCalls.set(dbSession.id, activeCall);
  userCallMap.set(callerId, dbSession.id);
  userCallMap.set(receiverId, dbSession.id);

  // Sync to Redis if enabled
  if (env.REDIS_ENABLED) {
    try {
      const redis = getRedisClient();
      if (redis) {
        await redis.set(`call:${dbSession.id}`, JSON.stringify(activeCall), 'EX', 3600);
      }
    } catch (err: any) {
      logger.warn('Failed to sync active call to Redis:', { message: err?.message });
    }
  }

  // Dispatch incoming call notification to receiver
  prisma.user
    .findUnique({
      where: { id: callerId },
      select: { displayName: true, username: true, avatarUrl: true },
    })
    .then((caller) => {
      const callerName = caller?.displayName || caller?.username || 'PingUp User';
      return createAndSendNotification({
        userId: receiverId,
        conversationId,
        callId: dbSession.id,
        type: NotificationType.CALL_INCOMING,
        title: `Incoming ${type === 'VIDEO' ? 'video' : 'voice'} call`,
        body: `${callerName} is calling you...`,
        senderId: callerId,
        senderName: callerName,
        senderAvatar: caller?.avatarUrl || undefined,
      });
    })
    .catch((err) => {
      logger.warn('Failed to send incoming call notification:', { message: err?.message });
    });

  return activeCall;
}

/**
 * Mark call as ringing on receiver side.
 */
export async function markCallRinging(callId: string): Promise<ActiveCall | null> {
  const call = inMemoryActiveCalls.get(callId);
  if (!call || call.status !== 'INITIATED') return null;

  call.status = 'RINGING';

  try {
    await prisma.callSession.update({
      where: { id: callId },
      data: { status: 'RINGING' },
    });
  } catch (err: any) {
    logger.warn('Failed to update CallSession status in DB:', { message: err?.message });
  }

  return call;
}

/**
 * Accept call session by receiver.
 */
export async function acceptCallSession(params: {
  callId: string;
  receiverId: string;
  receiverSocketId: string;
}): Promise<ActiveCall | null> {
  const { callId, receiverId, receiverSocketId } = params;
  const call = inMemoryActiveCalls.get(callId);

  if (!call || call.receiverId !== receiverId) return null;
  if (!['INITIATED', 'RINGING'].includes(call.status)) return null;

  call.status = 'ONGOING';
  call.receiverSocketId = receiverSocketId;
  call.acceptedAt = new Date();

  try {
    await prisma.$transaction([
      prisma.callSession.update({
        where: { id: callId },
        data: { status: 'ONGOING' },
      }),
      prisma.callParticipant.updateMany({
        where: { callId, userId: receiverId },
        data: { status: 'ONGOING', joinedAt: call.acceptedAt },
      }),
      prisma.callParticipant.updateMany({
        where: { callId, userId: call.callerId },
        data: { status: 'ONGOING', joinedAt: call.acceptedAt },
      }),
    ]);
  } catch (err: any) {
    logger.warn('Failed to update accepted CallSession in DB:', { message: err?.message });
  }

  return call;
}

/**
 * Terminate or reject call session and persist summary.
 */
export async function endCallSession(params: {
  callId: string;
  endedByUserId: string;
  finalStatus: 'ENDED' | 'REJECTED' | 'BUSY' | 'UNAVAILABLE' | 'FAILED';
  reason?: string;
}): Promise<{ call: ActiveCall | null; durationSec: number }> {
  const { callId, finalStatus } = params;
  const call = inMemoryActiveCalls.get(callId);

  const endedAt = new Date();
  let durationSec = 0;

  if (call) {
    if (call.acceptedAt) {
      durationSec = Math.max(0, Math.floor((endedAt.getTime() - call.acceptedAt.getTime()) / 1000));
    }
    call.status = finalStatus;
    call.endedAt = endedAt;
    call.durationSec = durationSec;

    // Clean up memory maps
    inMemoryActiveCalls.delete(callId);
    userCallMap.delete(call.callerId);
    userCallMap.delete(call.receiverId);

    // If call was not accepted and ended by caller or marked unavailable, dispatch missed call notification
    if (!call.acceptedAt && (finalStatus === 'UNAVAILABLE' || (params.endedByUserId === call.callerId && finalStatus !== 'BUSY'))) {
      prisma.user
        .findUnique({
          where: { id: call.callerId },
          select: { displayName: true, username: true, avatarUrl: true },
        })
        .then((caller) => {
          const callerName = caller?.displayName || caller?.username || 'PingUp User';
          return createAndSendNotification({
            userId: call.receiverId,
            conversationId: call.conversationId,
            callId: call.callId,
            type: NotificationType.CALL_MISSED,
            title: 'Missed Call',
            body: `You missed a ${call.type === 'VIDEO' ? 'video' : 'voice'} call from ${callerName}`,
            senderId: call.callerId,
            senderName: callerName,
            senderAvatar: caller?.avatarUrl || undefined,
          });
        })
        .catch((err) => {
          logger.warn('Failed to send missed call notification:', { message: err?.message });
        });
    }
  }

  // Sync DB update
  try {
    const dbStatus =
      finalStatus === 'BUSY'
        ? 'BUSY'
        : finalStatus === 'REJECTED'
        ? 'REJECTED'
        : finalStatus === 'UNAVAILABLE'
        ? 'MISSED'
        : finalStatus === 'FAILED'
        ? 'FAILED'
        : 'ENDED';

    await prisma.$transaction([
      prisma.callSession.update({
        where: { id: callId },
        data: {
          status: dbStatus as any,
          endedAt,
          durationSec,
        },
      }),
      prisma.callParticipant.updateMany({
        where: { callId },
        data: {
          status: dbStatus as any,
          leftAt: endedAt,
        },
      }),
    ]);
  } catch (err: any) {
    logger.warn('Failed to persist call session end in DB:', { message: err?.message });
  }

  // Remove from Redis if enabled
  if (env.REDIS_ENABLED) {
    try {
      const redis = getRedisClient();
      if (redis) {
        await redis.del(`call:${callId}`);
      }
    } catch (err: any) {
      logger.warn('Failed to delete call from Redis:', { message: err?.message });
    }
  }

  return { call: call || null, durationSec };
}

/**
 * Fetch call history for a user.
 */
export async function getCallHistoryForUser(userId: string, limit = 20) {
  return prisma.callSession.findMany({
    where: {
      participants: {
        some: { userId },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: limit,
    include: {
      initiator: {
        select: { id: true, displayName: true, username: true, avatarUrl: true, phoneNumber: true },
      },
      participants: {
        include: {
          user: {
            select: { id: true, displayName: true, username: true, avatarUrl: true, phoneNumber: true },
          },
        },
      },
    },
  });
}

/**
 * Fetch call history for a conversation.
 */
export async function getCallHistoryForConversation(conversationId: string, limit = 20) {
  return prisma.callSession.findMany({
    where: { conversationId },
    orderBy: { startedAt: 'desc' },
    take: limit,
    include: {
      initiator: {
        select: { id: true, displayName: true, username: true, avatarUrl: true },
      },
      participants: {
        include: {
          user: {
            select: { id: true, displayName: true, username: true, avatarUrl: true },
          },
        },
      },
    },
  });
}

