import webpush from 'web-push';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../database/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { HTTP_STATUS } from '../constants/index.js';

let isVapidConfigured = false;

// Initialize VAPID configuration if keys exist
if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      env.VAPID_SUBJECT,
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY
    );
    isVapidConfigured = true;
    logger.info('Web Push VAPID configuration loaded successfully.');
  } catch (err: any) {
    logger.warn('Failed to configure Web Push VAPID details:', { message: err?.message });
  }
} else {
  logger.info('VAPID keys not configured in environment. Web Push will operate in fallback mode.');
}

export function getVapidPublicKey(): string {
  return env.VAPID_PUBLIC_KEY || '';
}

export interface SavePushSubscriptionParams {
  userId: string;
  endpoint?: string;
  p256dh?: string;
  auth?: string;
  userAgent?: string;
  subscription?: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
}

export async function savePushSubscription(params: SavePushSubscriptionParams) {
  const userId = params.userId;
  const endpoint = params.endpoint || params.subscription?.endpoint;
  const p256dh = params.p256dh || params.subscription?.keys?.p256dh;
  const auth = params.auth || params.subscription?.keys?.auth;
  const userAgent = params.userAgent;

  if (!endpoint || !p256dh || !auth) {
    throw new AppError('Invalid push subscription: endpoint, p256dh, and auth keys required', HTTP_STATUS.BAD_REQUEST);
  }

  return prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId,
      endpoint,
      p256dh,
      auth,
      userAgent,
    },
    update: {
      userId,
      p256dh,
      auth,
      userAgent,
      updatedAt: new Date(),
    },
  });
}

export async function deletePushSubscription(userId: string, endpoint: string) {
  if (!endpoint) {
    throw new AppError('Subscription endpoint is required', HTTP_STATUS.BAD_REQUEST);
  }

  const existing = await prisma.pushSubscription.findUnique({
    where: { endpoint },
  });

  if (!existing) {
    return { success: true, message: 'Subscription already deleted' };
  }

  // Validate ownership
  if (existing.userId !== userId) {
    throw new AppError('Forbidden: You do not own this push subscription', HTTP_STATUS.FORBIDDEN);
  }

  await prisma.pushSubscription.delete({
    where: { endpoint },
  });

  return { success: true };
}

export async function sendWebPushToUser(params: {
  userId: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  metadata?: any;
}) {
  const { userId, title, body, url, tag, metadata } = params;

  if (!isVapidConfigured) {
    logger.debug(`Web Push skipped for user ${userId}: VAPID not configured`);
    return { sent: 0, failed: 0 };
  }

  // Check user push preferences
  let pref = null;
  if (prisma?.notificationPreference?.findUnique) {
    try {
      pref = await prisma.notificationPreference.findUnique({
        where: { userId },
      });
    } catch {
      pref = null;
    }
  }

  if (pref && !pref.pushEnabled) {
    logger.debug(`Web Push skipped for user ${userId}: Push notifications disabled in preferences`);
    return { sent: 0, failed: 0 };
  }

  if (!prisma?.pushSubscription?.findMany) {
    return { sent: 0, failed: 0 };
  }

  // Fetch all push subscriptions for this user
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  // Check if message preview should be shown
  const showPreview = pref?.showPreview ?? true;
  const payloadBody = showPreview ? body : 'New notification received';

  const payload = JSON.stringify({
    title,
    body: payloadBody,
    icon: '/icon-192.png',
    badge: '/icon-badge.png',
    data: {
      url: url || '/',
      tag: tag || 'pingup-notification',
      ...metadata,
    },
  });

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    try {
      await webpush.sendNotification(pushSub, payload);
      sent++;
    } catch (err: any) {
      failed++;
      logger.warn(`Push delivery failed for endpoint ${sub.endpoint.slice(0, 30)}...:`, {
        statusCode: err?.statusCode,
        message: err?.message,
      });

      // HTTP 410 (Gone) or 404 (Not Found) means expired / unregistered subscription
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        logger.info(`Pruning expired push subscription: ${sub.id}`);
        await prisma.pushSubscription.delete({
          where: { id: sub.id },
        }).catch((e) => logger.warn('Error deleting expired sub:', e));
      }
    }
  }

  return { sent, failed };
}
