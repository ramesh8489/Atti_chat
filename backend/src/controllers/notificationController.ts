import { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { findUserByFirebaseUid } from '../services/userService.js';
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification as removeNotification,
  clearAllNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../services/notificationService.js';
import {
  getVapidPublicKey,
  savePushSubscription,
  deletePushSubscription,
} from '../services/pushNotificationService.js';

export async function listUserNotifications(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
  const unreadOnly = req.query.unreadOnly === 'true';

  const result = await listNotifications({
    userId: user.id,
    limit,
    offset,
    unreadOnly,
  });

  return res.status(HTTP_STATUS.OK).json({
    success: true,
    ...result,
  });
}

export async function getUnreadCount(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const unreadCount = await getUnreadNotificationCount(user.id);
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    unreadCount,
  });
}

export async function markAsRead(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const id = req.params.id as string;
  const result = await markNotificationAsRead(user.id, id);

  return res.status(HTTP_STATUS.OK).json(result);
}

export async function markAllAsRead(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const result = await markAllNotificationsAsRead(user.id);
  return res.status(HTTP_STATUS.OK).json(result);
}

export async function deleteNotification(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const id = req.params.id as string;
  const result = await removeNotification(user.id, id);

  return res.status(HTTP_STATUS.OK).json(result);
}

export async function clearAll(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const result = await clearAllNotifications(user.id);
  return res.status(HTTP_STATUS.OK).json(result);
}

export async function getPreferences(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const preferences = await getNotificationPreferences(user.id);
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    preferences,
  });
}

export async function updatePreferences(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const preferences = await updateNotificationPreferences(user.id, req.body);
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    preferences,
  });
}

export async function getVapidKey(_req: Request, res: Response) {
  const vapidPublicKey = getVapidPublicKey();
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    vapidPublicKey,
  });
}

export async function subscribePush(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const { subscription, userAgent } = req.body;
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    throw new AppError('Invalid push subscription payload', HTTP_STATUS.BAD_REQUEST);
  }

  const saved = await savePushSubscription({
    userId: user.id,
    subscription,
    userAgent,
  });

  return res.status(HTTP_STATUS.CREATED).json({
    success: true,
    subscription: saved,
  });
}

export async function unsubscribePush(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const { endpoint } = req.body;
  if (!endpoint) {
    throw new AppError('endpoint is required', HTTP_STATUS.BAD_REQUEST);
  }

  const result = await deletePushSubscription(user.id, endpoint);
  return res.status(HTTP_STATUS.OK).json(result);
}
