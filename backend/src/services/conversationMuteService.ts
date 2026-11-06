import { prisma } from '../database/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { HTTP_STATUS, SOCKET_EVENTS } from '../constants/index.js';
import { getIo } from '../socket/socketServer.js';

export async function muteConversation(params: {
  userId: string;
  conversationId: string;
  durationHours?: number; // e.g. 8 (8 hours), 168 (1 week), or -1 / undefined for permanent
}) {
  const { userId, conversationId, durationHours } = params;

  // Verify membership
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  });

  if (!participant) {
    throw new AppError('Forbidden: Not a participant in this conversation', HTTP_STATUS.FORBIDDEN);
  }

  let mutedUntil: Date;
  if (durationHours && durationHours > 0) {
    mutedUntil = new Date(Date.now() + durationHours * 3600 * 1000);
  } else {
    // Far future date represents permanent mute until manually unmuted
    mutedUntil = new Date('2099-12-31T23:59:59.999Z');
  }

  const updated = await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
    data: {
      mutedUntil,
    },
  });

  const io = getIo();
  if (io) {
    io.to(`user:${userId}`).emit(SOCKET_EVENTS.CONVERSATION_MUTED, {
      conversationId,
      userId,
      mutedUntil: updated.mutedUntil?.toISOString(),
    });
  }

  return {
    success: true,
    conversationId,
    mutedUntil: updated.mutedUntil?.toISOString(),
  };
}

export async function unmuteConversation(
  userIdOrParams: string | { userId: string; conversationId: string },
  maybeConversationId?: string
) {
  const userId = typeof userIdOrParams === 'object' ? userIdOrParams.userId : userIdOrParams;
  const conversationId = typeof userIdOrParams === 'object' ? userIdOrParams.conversationId : (maybeConversationId as string);

  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  });

  if (!participant) {
    throw new AppError('Forbidden: Not a participant in this conversation', HTTP_STATUS.FORBIDDEN);
  }

  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
    data: {
      mutedUntil: null,
    },
  });

  const io = getIo();
  if (io) {
    io.to(`user:${userId}`).emit(SOCKET_EVENTS.CONVERSATION_UNMUTED, {
      conversationId,
      userId,
    });
  }

  return { success: true, conversationId };
}

export async function isConversationMuted(userId: string, conversationId: string): Promise<boolean> {
  if (!prisma?.conversationParticipant?.findUnique) {
    return false;
  }
  try {
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      select: { mutedUntil: true },
    });

    if (!participant || !participant.mutedUntil) {
      return false;
    }

    return participant.mutedUntil > new Date();
  } catch {
    return false;
  }
}

export async function getMutedConversationIds(userId: string): Promise<string[]> {
  const participants = await prisma.conversationParticipant.findMany({
    where: {
      userId,
      mutedUntil: {
        gt: new Date(),
      },
    },
    select: { conversationId: true },
  });

  return participants.map((p) => p.conversationId);
}
