import { prisma } from '../database/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { HTTP_STATUS, SOCKET_EVENTS } from '../constants/index.js';
import { getIo } from '../socket/socketServer.js';
import { logger } from '../config/logger.js';

const EDIT_TIME_LIMIT_MS = 15 * 60 * 1000; // 15 minutes limit
const MAX_PINNED_MESSAGES = 5;

/**
 * Format reaction list with counts and reacting users.
 */
export async function getFormattedReactions(messageId: string, currentUserId?: string) {
  const reactions = await prisma.messageReaction.findMany({
    where: { messageId },
    include: {
      user: {
        select: { id: true, displayName: true, username: true },
      },
    },
  });

  const reactionMap = new Map<string, { emoji: string; count: number; users: any[]; hasReacted: boolean }>();

  reactions.forEach((r) => {
    const existing = reactionMap.get(r.emoji) || {
      emoji: r.emoji,
      count: 0,
      users: [],
      hasReacted: false,
    };
    existing.count += 1;
    existing.users.push({
      id: r.user.id,
      displayName: r.user.displayName || r.user.username || 'User',
    });
    if (currentUserId && r.userId === currentUserId) {
      existing.hasReacted = true;
    }
    reactionMap.set(r.emoji, existing);
  });

  return Array.from(reactionMap.values());
}

/**
 * Edit an existing message owned by the user within the allowed time limit.
 */
export async function editMessage(params: {
  messageId: string;
  userId: string;
  newContent: string;
}) {
  const { messageId, userId, newContent } = params;
  const trimmed = newContent?.trim();

  if (!trimmed) {
    throw new AppError('Message content cannot be empty', HTTP_STATUS.BAD_REQUEST);
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      sender: { select: { id: true, displayName: true, avatarUrl: true } },
      attachments: true,
    },
  });

  if (!message) {
    throw new AppError('Message not found', HTTP_STATUS.NOT_FOUND);
  }

  if (message.senderId !== userId) {
    throw new AppError('Forbidden: You can only edit your own messages', HTTP_STATUS.FORBIDDEN);
  }

  if (message.isDeleted) {
    throw new AppError('Cannot edit a deleted message', HTTP_STATUS.BAD_REQUEST);
  }

  // Check 15-minute edit window
  const ageMs = Date.now() - message.createdAt.getTime();
  if (ageMs > EDIT_TIME_LIMIT_MS) {
    throw new AppError('Edit time limit expired (messages can only be edited within 15 minutes)', HTTP_STATUS.BAD_REQUEST);
  }

  const updatedMessage = await prisma.message.update({
    where: { id: messageId },
    data: {
      content: trimmed,
      isEdited: true,
      editedAt: new Date(),
    },
    include: {
      sender: { select: { id: true, displayName: true, avatarUrl: true } },
      attachments: true,
      replyTo: {
        select: {
          id: true,
          content: true,
          type: true,
          isDeleted: true,
          sender: { select: { displayName: true } },
        },
      },
    },
  });

  // Broadcast to room
  const io = getIo();
  if (io) {
    io.to(`conv:${message.conversationId}`).emit(SOCKET_EVENTS.MESSAGE_EDITED, {
      conversationId: message.conversationId,
      messageId: message.id,
      content: updatedMessage.content,
      isEdited: true,
      editedAt: updatedMessage.editedAt?.toISOString(),
      updatedAt: updatedMessage.updatedAt.toISOString(),
    });
  }

  return updatedMessage;
}

/**
 * Delete a message:
 * - "FOR_ME": hide only for requesting user (persisted in UserDeletedMessage).
 * - "FOR_EVERYONE": soft-delete for all participants (only by sender or group admin).
 */
export async function deleteMessage(params: {
  messageId: string;
  userId: string;
  deleteType: 'FOR_ME' | 'FOR_EVERYONE';
}) {
  const { messageId, userId, deleteType } = params;

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      conversation: {
        include: {
          participants: {
            where: { userId },
          },
        },
      },
    },
  });

  if (!message) {
    throw new AppError('Message not found', HTTP_STATUS.NOT_FOUND);
  }

  const participant = message.conversation.participants[0];
  if (!participant) {
    throw new AppError('Forbidden: Not a participant in this conversation', HTTP_STATUS.FORBIDDEN);
  }

  const io = getIo();

  if (deleteType === 'FOR_ME') {
    // Record deletion for user
    await prisma.userDeletedMessage.upsert({
      where: {
        userId_messageId: {
          userId,
          messageId,
        },
      },
      create: {
        userId,
        messageId,
      },
      update: {},
    });

    if (io) {
      io.to(`user:${userId}`).emit(SOCKET_EVENTS.MESSAGE_DELETED, {
        conversationId: message.conversationId,
        messageId,
        deleteType: 'FOR_ME',
        deletedBy: userId,
      });
    }

    return { success: true, deleteType: 'FOR_ME', messageId };
  }

  // FOR_EVERYONE: Check permissions (sender or group admin)
  const isSender = message.senderId === userId;
  const isGroupAdmin = participant.role === 'OWNER' || participant.role === 'ADMIN';

  if (!isSender && !isGroupAdmin) {
    throw new AppError('Forbidden: You can only delete your own messages for everyone', HTTP_STATUS.FORBIDDEN);
  }

  // Soft delete message and detach/hide attachments
  await prisma.message.update({
    where: { id: messageId },
    data: {
      isDeleted: true,
      content: 'This message was deleted',
    },
  });

  if (io) {
    io.to(`conv:${message.conversationId}`).emit(SOCKET_EVENTS.MESSAGE_DELETED, {
      conversationId: message.conversationId,
      messageId,
      deleteType: 'FOR_EVERYONE',
      deletedBy: userId,
    });
  }

  return { success: true, deleteType: 'FOR_EVERYONE', messageId };
}

/**
 * Toggle reaction on a message (Add if not present, remove if already present).
 */
export async function toggleMessageReaction(params: {
  messageId: string;
  userId: string;
  emoji: string;
}) {
  const { messageId, userId, emoji } = params;

  if (!emoji || emoji.trim().length === 0) {
    throw new AppError('Emoji must be provided', HTTP_STATUS.BAD_REQUEST);
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      conversation: {
        include: {
          participants: {
            where: { userId },
          },
        },
      },
    },
  });

  if (!message) {
    throw new AppError('Message not found', HTTP_STATUS.NOT_FOUND);
  }

  if (message.conversation.participants.length === 0) {
    throw new AppError('Forbidden: You are not a participant in this conversation', HTTP_STATUS.FORBIDDEN);
  }

  // Check if reaction exists
  const existing = await prisma.messageReaction.findUnique({
    where: {
      messageId_userId_emoji: {
        messageId,
        userId,
        emoji,
      },
    },
  });

  let action: 'ADD' | 'REMOVE';
  if (existing) {
    await prisma.messageReaction.delete({
      where: { id: existing.id },
    });
    action = 'REMOVE';
  } else {
    await prisma.messageReaction.create({
      data: {
        messageId,
        userId,
        emoji,
      },
    });
    action = 'ADD';
  }

  const reactions = await getFormattedReactions(messageId, userId);

  const io = getIo();
  if (io) {
    io.to(`conv:${message.conversationId}`).emit(SOCKET_EVENTS.MESSAGE_REACTION, {
      conversationId: message.conversationId,
      messageId,
      emoji,
      userId,
      action,
      reactions,
    });
  }

  return { success: true, action, reactions };
}

/**
 * Pin or Unpin a message in a conversation.
 */
export async function pinMessage(params: {
  conversationId: string;
  messageId: string;
  userId: string;
}) {
  const { conversationId, messageId, userId } = params;

  // Check participant and permissions
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
    include: {
      conversation: true,
    },
  });

  if (!participant) {
    throw new AppError('Forbidden: You are not a participant in this conversation', HTTP_STATUS.FORBIDDEN);
  }

  // If group chat, ensure user is OWNER or ADMIN
  if (participant.conversation.type === 'GROUP' && participant.role === 'MEMBER') {
    throw new AppError('Forbidden: Only group admins can pin messages', HTTP_STATUS.FORBIDDEN);
  }

  // Check maximum pin limit
  const currentPinCount = await prisma.pinnedMessage.count({
    where: { conversationId },
  });

  if (currentPinCount >= MAX_PINNED_MESSAGES) {
    throw new AppError(`Cannot pin message: Maximum limit of ${MAX_PINNED_MESSAGES} pinned messages reached`, HTTP_STATUS.BAD_REQUEST);
  }

  const pinned = await prisma.pinnedMessage.create({
    data: {
      conversationId,
      messageId,
      pinnedById: userId,
    },
    include: {
      message: {
        include: {
          sender: { select: { displayName: true } },
          attachments: true,
        },
      },
    },
  });

  const io = getIo();
  if (io) {
    io.to(`conv:${conversationId}`).emit(SOCKET_EVENTS.MESSAGE_PINNED, {
      conversationId,
      messageId,
      pinnedById: userId,
      pinnedAt: pinned.pinnedAt.toISOString(),
      pinnedMessage: {
        id: pinned.id,
        messageId: pinned.messageId,
        content: pinned.message.content,
        senderName: pinned.message.sender.displayName || 'User',
      },
    });
  }

  return pinned;
}

export async function unpinMessage(params: {
  conversationId: string;
  messageId: string;
  userId: string;
}) {
  const { conversationId, messageId, userId } = params;

  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
    include: {
      conversation: true,
    },
  });

  if (!participant) {
    throw new AppError('Forbidden: You are not a participant in this conversation', HTTP_STATUS.FORBIDDEN);
  }

  if (participant.conversation.type === 'GROUP' && participant.role === 'MEMBER') {
    throw new AppError('Forbidden: Only group admins can unpin messages', HTTP_STATUS.FORBIDDEN);
  }

  await prisma.pinnedMessage.deleteMany({
    where: {
      conversationId,
      messageId,
    },
  });

  const io = getIo();
  if (io) {
    io.to(`conv:${conversationId}`).emit(SOCKET_EVENTS.MESSAGE_UNPINNED, {
      conversationId,
      messageId,
      unpinnedBy: userId,
    });
  }

  return { success: true, messageId };
}

export async function listPinnedMessages(conversationId: string, userId: string) {
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

  return prisma.pinnedMessage.findMany({
    where: { conversationId },
    orderBy: { pinnedAt: 'desc' },
    include: {
      message: {
        include: {
          sender: { select: { id: true, displayName: true, avatarUrl: true } },
          attachments: true,
        },
      },
    },
  });
}

/**
 * Toggle Starred Message (Private to user).
 */
export async function toggleStarMessage(params: {
  messageId: string;
  userId: string;
}) {
  const { messageId, userId } = params;

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      conversation: {
        include: {
          participants: { where: { userId } },
        },
      },
    },
  });

  if (!message || message.conversation.participants.length === 0) {
    throw new AppError('Message not found or access denied', HTTP_STATUS.FORBIDDEN);
  }

  const existing = await prisma.starredMessage.findUnique({
    where: {
      userId_messageId: {
        userId,
        messageId,
      },
    },
  });

  let isStarred = false;
  if (existing) {
    await prisma.starredMessage.delete({
      where: { id: existing.id },
    });
    isStarred = false;
  } else {
    await prisma.starredMessage.create({
      data: {
        userId,
        messageId,
      },
    });
    isStarred = true;
  }

  return { success: true, messageId, isStarred };
}

export async function listStarredMessages(userId: string) {
  return prisma.starredMessage.findMany({
    where: { userId },
    orderBy: { starredAt: 'desc' },
    include: {
      message: {
        include: {
          sender: { select: { id: true, displayName: true, avatarUrl: true } },
          conversation: { select: { id: true, title: true, type: true } },
          attachments: true,
        },
      },
    },
  });
}

/**
 * Forward an existing message to one or more conversations.
 */
export async function forwardMessage(params: {
  sourceMessageId: string;
  targetConversationIds: string[];
  senderId: string;
}) {
  const { sourceMessageId, targetConversationIds, senderId } = params;

  if (!targetConversationIds || targetConversationIds.length === 0) {
    throw new AppError('At least one target conversation must be selected', HTTP_STATUS.BAD_REQUEST);
  }

  const sourceMessage = await prisma.message.findUnique({
    where: { id: sourceMessageId },
    include: {
      sender: { select: { displayName: true } },
      attachments: true,
    },
  });

  if (!sourceMessage || sourceMessage.isDeleted) {
    throw new AppError('Cannot forward message: Message not found or deleted', HTTP_STATUS.NOT_FOUND);
  }

  // Verify sender is participant in all target conversations
  const targetMemberships = await prisma.conversationParticipant.findMany({
    where: {
      userId: senderId,
      conversationId: { in: targetConversationIds },
    },
    select: { conversationId: true },
  });

  const validTargetIds = targetMemberships.map((m) => m.conversationId);
  if (validTargetIds.length !== targetConversationIds.length) {
    throw new AppError('Forbidden: You are not a participant in all selected conversations', HTTP_STATUS.FORBIDDEN);
  }

  const io = getIo();
  const forwardedMessages = [];

  for (const targetConvId of validTargetIds) {
    const newMessage = await prisma.message.create({
      data: {
        conversationId: targetConvId,
        senderId,
        content: sourceMessage.content,
        type: sourceMessage.type,
        isForwarded: true,
        forwardedFrom: sourceMessage.sender.displayName || 'Forwarded',
      },
      include: {
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    // Clone attachments if any
    if (sourceMessage.attachments && sourceMessage.attachments.length > 0) {
      for (const att of sourceMessage.attachments) {
        await prisma.mediaAttachment.create({
          data: {
            messageId: newMessage.id,
            fileKey: att.fileKey,
            fileUrl: att.fileUrl,
            fileType: att.fileType,
            fileSize: att.fileSize,
            mimeType: att.mimeType,
            fileName: att.fileName,
            uploaderId: senderId,
          },
        });
      }
    }

    const fullMessage = {
      id: newMessage.id,
      conversationId: targetConvId,
      senderId,
      senderName: newMessage.sender.displayName || 'You',
      content: newMessage.content,
      type: newMessage.type,
      isForwarded: true,
      forwardedFrom: newMessage.forwardedFrom,
      createdAt: newMessage.createdAt.toISOString(),
      status: 'SENT' as const,
      isOutgoing: true,
      attachments: sourceMessage.attachments,
    };

    forwardedMessages.push(fullMessage);

    // Broadcast to room
    if (io) {
      io.to(`conv:${targetConvId}`).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, fullMessage);
    }
  }

  return forwardedMessages;
}

/**
 * Search messages with query term, sender filter, and conversation scope.
 */
export async function searchMessages(params: {
  userId: string;
  query: string;
  conversationId?: string;
  limit?: number;
  offset?: number;
}) {
  const { userId, query, conversationId, limit = 20, offset = 0 } = params;
  const trimmed = query?.trim();

  if (!trimmed) {
    return { messages: [], total: 0 };
  }

  // Get conversations the user is authorized to see
  const userConversations = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: { conversationId: true },
  });
  const allowedConvIds = userConversations.map((c) => c.conversationId);

  if (conversationId && !allowedConvIds.includes(conversationId)) {
    throw new AppError('Forbidden: Not a participant in this conversation', HTTP_STATUS.FORBIDDEN);
  }

  const targetConvIds = conversationId ? [conversationId] : allowedConvIds;

  // Query database using parameterized Prisma query
  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: {
        conversationId: { in: targetConvIds },
        content: {
          contains: trimmed,
          mode: 'insensitive',
        },
        isDeleted: false,
        deletedForUsers: {
          none: { userId },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
      skip: offset,
      include: {
        sender: { select: { id: true, displayName: true, username: true, avatarUrl: true } },
        conversation: { select: { id: true, title: true, type: true } },
        attachments: true,
      },
    }),
    prisma.message.count({
      where: {
        conversationId: { in: targetConvIds },
        content: {
          contains: trimmed,
          mode: 'insensitive',
        },
        isDeleted: false,
        deletedForUsers: {
          none: { userId },
        },
      },
    }),
  ]);

  return {
    messages: messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      conversationTitle: m.conversation.title,
      senderId: m.senderId,
      senderName: m.sender.displayName || m.sender.username || 'User',
      senderAvatar: m.sender.avatarUrl || undefined,
      content: m.content,
      type: m.type,
      createdAt: m.createdAt ? m.createdAt.toISOString() : new Date().toISOString(),
      attachments: m.attachments,
    })),
    total,
    hasMore: offset + messages.length < total,
  };
}
