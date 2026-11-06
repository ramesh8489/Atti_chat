import { prisma } from '../database/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { HTTP_STATUS, SOCKET_EVENTS } from '../constants/index.js';
import { getIo } from '../socket/socketServer.js';

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) {
    throw new AppError('Cannot block yourself', HTTP_STATUS.BAD_REQUEST);
  }

  // Verify target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: blockedId },
    select: { id: true, displayName: true, username: true },
  });

  if (!targetUser) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  // Create or return existing block record
  const record = await prisma.blockedUser.upsert({
    where: {
      blockerId_blockedId: {
        blockerId,
        blockedId,
      },
    },
    create: {
      blockerId,
      blockedId,
    },
    update: {},
  });

  // Notify both users in real time via their personal socket rooms
  const io = getIo();
  if (io) {
    io.to(`user:${blockerId}`).emit(SOCKET_EVENTS.USER_BLOCKED, {
      blockedUserId: blockedId,
      blockedByUserId: blockerId,
    });
    io.to(`user:${blockedId}`).emit(SOCKET_EVENTS.USER_BLOCKED, {
      blockedUserId: blockedId,
      blockedByUserId: blockerId,
    });
  }

  return { success: true, blockedUser: record };
}

export async function unblockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) {
    throw new AppError('Invalid operation: cannot unblock yourself', HTTP_STATUS.BAD_REQUEST);
  }

  const existing = await prisma.blockedUser.findUnique({
    where: {
      blockerId_blockedId: {
        blockerId,
        blockedId,
      },
    },
  });

  if (!existing) {
    return { success: true, message: 'User is not blocked' };
  }

  await prisma.blockedUser.delete({
    where: { id: existing.id },
  });

  const io = getIo();
  if (io) {
    io.to(`user:${blockerId}`).emit(SOCKET_EVENTS.USER_UNBLOCKED, {
      unblockedUserId: blockedId,
      unblockedByUserId: blockerId,
    });
    io.to(`user:${blockedId}`).emit(SOCKET_EVENTS.USER_UNBLOCKED, {
      unblockedUserId: blockedId,
      unblockedByUserId: blockerId,
    });
  }

  return { success: true };
}

export async function listBlockedUsers(blockerId: string) {
  const blocks = await prisma.blockedUser.findMany({
    where: { blockerId },
    orderBy: { createdAt: 'desc' },
    include: {
      blocked: {
        select: {
          id: true,
          displayName: true,
          username: true,
          avatarUrl: true,
          bio: true,
        },
      },
    },
  });

  return blocks.map((b) => ({
    id: b.id,
    blockedId: b.blockedId,
    blockedAt: b.createdAt.toISOString(),
    user: b.blocked,
  }));
}

/**
 * Returns true if userA blocked userB OR userB blocked userA.
 */
export async function isBlocked(userAId: string, userBId: string): Promise<boolean> {
  if (!prisma?.blockedUser?.count) {
    return false;
  }
  try {
    const count = await prisma.blockedUser.count({
      where: {
        OR: [
          { blockerId: userAId, blockedId: userBId },
          { blockerId: userBId, blockedId: userAId },
        ],
      },
    });
    return count > 0;
  } catch {
    return false;
  }
}

/**
 * Returns true specifically if blockerId has blocked targetId.
 */
export async function hasBlocked(blockerId: string, targetId: string): Promise<boolean> {
  if (!prisma?.blockedUser?.findUnique) {
    return false;
  }
  try {
    const record = await prisma.blockedUser.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId: targetId,
        },
      },
    });
    return record !== null;
  } catch {
    return false;
  }
}
