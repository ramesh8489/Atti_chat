import { prisma } from '../database/prisma.js';
import { NotificationType } from '@prisma/client';
import { AppError } from '../middleware/errorHandler.js';
import { HTTP_STATUS, SOCKET_EVENTS } from '../constants/index.js';
import { getIo } from '../socket/socketServer.js';
import { isConversationMuted } from './conversationMuteService.js';
import { isBlocked } from './blockService.js';
import { sendWebPushToUser } from './pushNotificationService.js';
import { logger } from '../config/logger.js';

export async function getNotificationPreferences(userId: string) {
  const defaultPref = {
    id: `pref-${userId}`,
    userId,
    directMessages: true,
    groupMessages: true,
    callIncoming: true,
    callMissed: true,
    pushEnabled: true,
    soundEnabled: true,
    showPreview: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (!prisma?.notificationPreference?.findUnique) {
    return defaultPref;
  }

  try {
    let pref = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!pref && prisma?.notificationPreference?.create) {
      pref = await prisma.notificationPreference.create({
        data: {
          userId,
          directMessages: true,
          groupMessages: true,
          callIncoming: true,
          callMissed: true,
          pushEnabled: true,
          soundEnabled: true,
          showPreview: true,
        },
      });
    }

    return pref || defaultPref;
  } catch {
    return defaultPref;
  }
}

export async function updateNotificationPreferences(
  userId: string,
  data: {
    directMessages?: boolean;
    groupMessages?: boolean;
    callIncoming?: boolean;
    callMissed?: boolean;
    pushEnabled?: boolean;
    soundEnabled?: boolean;
    showPreview?: boolean;
  }
) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: {
      userId,
      ...data,
    },
    update: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

export interface CreateNotificationParams {
  recipientId?: string;
  userId?: string;
  actorId?: string;
  senderId?: string;
  conversationId?: string;
  callId?: string;
  messageId?: string;
  type: NotificationType;
  title: string;
  body: string;
  senderName?: string;
  senderAvatar?: string;
  metadata?: any;
}

export async function createAndSendNotification(params: CreateNotificationParams) {
  const recipientId = params.recipientId || params.userId;
  if (!recipientId) {
    return null;
  }
  const actorId = params.actorId || params.senderId;
  const conversationId = params.conversationId;
  const type = params.type;
  const title = params.title;
  const body = params.body;
  const metadata =
    params.metadata ||
    (params.callId || params.messageId ? { callId: params.callId, messageId: params.messageId } : undefined);

  // Never notify user of their own actions
  if (actorId && actorId === recipientId) {
    return null;
  }

  // Check if either user has blocked the other
  if (actorId) {
    const blocked = await isBlocked(recipientId, actorId);
    if (blocked) {
      logger.debug(`Notification suppressed: block active between ${recipientId} and ${actorId}`);
      return null;
    }
  }

  // Check user notification preferences
  const pref = await getNotificationPreferences(recipientId);

  if (type === NotificationType.DIRECT_MESSAGE && !pref.directMessages) {
    return null;
  }
  if (type === NotificationType.GROUP_MESSAGE && !pref.groupMessages) {
    return null;
  }
  if (type === NotificationType.CALL_INCOMING && !pref.callIncoming) {
    return null;
  }
  if (type === NotificationType.CALL_MISSED && !pref.callMissed) {
    return null;
  }

  // Check if conversation is muted
  let isMuted = false;
  if (conversationId) {
    isMuted = await isConversationMuted(recipientId, conversationId);
  }

  // Persist notification in PostgreSQL
  if (!prisma?.notification?.create) {
    return null;
  }

  let notification: any;
  try {
    notification = await prisma.notification.create({
      data: {
        userId: recipientId,
        actorId: actorId || null,
        conversationId: conversationId || null,
        type,
        title,
        body,
        metadata: metadata || undefined,
        isRead: false,
      },
      include: {
        actor: {
          select: { id: true, displayName: true, avatarUrl: true, username: true },
        },
        conversation: {
          select: { id: true, title: true, type: true },
        },
      },
    });
  } catch (err: any) {
    logger.warn('Failed to save notification record:', { message: err?.message });
    return null;
  }

  const formatted = {
    id: notification.id,
    userId: notification.userId,
    actorId: notification.actorId,
    actorName: notification.actor?.displayName || 'Someone',
    actorAvatar: notification.actor?.avatarUrl || undefined,
    conversationId: notification.conversationId,
    conversationTitle: notification.conversation?.title || undefined,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    metadata: notification.metadata,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
  };

  const io = getIo();
  if (io) {
    // Deliver real-time notification to user's personal room
    io.to(`user:${recipientId}`).emit(SOCKET_EVENTS.NOTIFICATION_RECEIVE, {
      notification: formatted,
      isMuted,
      soundEnabled: pref.soundEnabled && !isMuted,
    });

    // Broadcast updated unread notification count
    const unreadCount = await getUnreadNotificationCount(recipientId);
    io.to(`user:${recipientId}`).emit(SOCKET_EVENTS.NOTIFICATION_COUNT, {
      unreadCount,
    });
  }

  // If conversation is NOT muted, attempt Web Push
  if (!isMuted && pref.pushEnabled) {
    sendWebPushToUser({
      userId: recipientId,
      title,
      body,
      url: conversationId ? `/?conversationId=${conversationId}` : '/',
      metadata,
    }).catch((err) => logger.warn('Push dispatch error:', err));
  }

  return formatted;
}

export async function listNotifications(params: {
  userId: string;
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}) {
  const { userId, limit = 30, offset = 0, unreadOnly = false } = params;

  const whereClause: any = { userId };
  if (unreadOnly) {
    whereClause.isRead = false;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        actor: {
          select: { id: true, displayName: true, avatarUrl: true, username: true },
        },
        conversation: {
          select: { id: true, title: true, type: true },
        },
      },
    }),
    prisma.notification.count({ where: whereClause }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  const formatted = notifications.map((n) => ({
    id: n.id,
    userId: n.userId,
    actorId: n.actorId,
    actorName: n.actor?.displayName || 'Someone',
    actorAvatar: n.actor?.avatarUrl || undefined,
    conversationId: n.conversationId,
    conversationTitle: n.conversation?.title || undefined,
    type: n.type,
    title: n.title,
    body: n.body,
    metadata: n.metadata,
    isRead: n.isRead,
    readAt: n.readAt?.toISOString() || null,
    createdAt: n.createdAt.toISOString(),
  }));

  return {
    notifications: formatted,
    total,
    unreadCount,
    hasMore: offset + notifications.length < total,
  };
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
}

export async function markNotificationAsRead(userId: string, notificationId: string) {
  const existing = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!existing) {
    throw new AppError('Notification not found', HTTP_STATUS.NOT_FOUND);
  }

  if (existing.userId !== userId) {
    throw new AppError('Forbidden: Access denied to notification', HTTP_STATUS.FORBIDDEN);
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  const unreadCount = await getUnreadNotificationCount(userId);
  const io = getIo();
  if (io) {
    io.to(`user:${userId}`).emit(SOCKET_EVENTS.NOTIFICATION_READ, {
      notificationId,
      unreadCount,
    });
    io.to(`user:${userId}`).emit(SOCKET_EVENTS.NOTIFICATION_COUNT, {
      unreadCount,
    });
  }

  return { success: true, notificationId, unreadCount };
}

export async function markAllNotificationsAsRead(userId: string) {
  await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  const io = getIo();
  if (io) {
    io.to(`user:${userId}`).emit(SOCKET_EVENTS.NOTIFICATION_READ, {
      all: true,
      unreadCount: 0,
    });
    io.to(`user:${userId}`).emit(SOCKET_EVENTS.NOTIFICATION_COUNT, {
      unreadCount: 0,
    });
  }

  return { success: true, unreadCount: 0 };
}

export async function deleteNotification(userId: string, notificationId: string) {
  const existing = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!existing) {
    return { success: true, message: 'Notification already deleted' };
  }

  if (existing.userId !== userId) {
    throw new AppError('Forbidden: Access denied to notification', HTTP_STATUS.FORBIDDEN);
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });

  const unreadCount = await getUnreadNotificationCount(userId);
  const io = getIo();
  if (io) {
    io.to(`user:${userId}`).emit(SOCKET_EVENTS.NOTIFICATION_CLEARED, {
      notificationId,
      unreadCount,
    });
    io.to(`user:${userId}`).emit(SOCKET_EVENTS.NOTIFICATION_COUNT, {
      unreadCount,
    });
  }

  return { success: true, unreadCount };
}

export async function clearAllNotifications(userId: string) {
  await prisma.notification.deleteMany({
    where: { userId },
  });

  const io = getIo();
  if (io) {
    io.to(`user:${userId}`).emit(SOCKET_EVENTS.NOTIFICATION_CLEARED, {
      all: true,
      unreadCount: 0,
    });
    io.to(`user:${userId}`).emit(SOCKET_EVENTS.NOTIFICATION_COUNT, {
      unreadCount: 0,
    });
  }

  return { success: true, unreadCount: 0 };
}
