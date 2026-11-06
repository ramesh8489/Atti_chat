import { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { findUserByFirebaseUid } from '../services/userService.js';
import {
  getPrivacySettings,
  updatePrivacySettings,
} from '../services/privacyService.js';
import {
  blockUser,
  unblockUser,
  listBlockedUsers,
} from '../services/blockService.js';
import {
  muteConversation,
  unmuteConversation,
  getMutedConversationIds,
} from '../services/conversationMuteService.js';

export async function getPrivacy(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const settings = await getPrivacySettings(user.id);
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    privacySettings: settings,
  });
}

export async function updatePrivacy(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const settings = await updatePrivacySettings(user.id, req.body);
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    privacySettings: settings,
  });
}

export async function getBlocked(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const blockedUsers = await listBlockedUsers(user.id);
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    blockedUsers,
  });
}

export async function block(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const targetUserId = req.params.userId || req.body.targetUserId;
  if (!targetUserId) {
    throw new AppError('Target userId is required', HTTP_STATUS.BAD_REQUEST);
  }

  const result = await blockUser(user.id, targetUserId);
  return res.status(HTTP_STATUS.OK).json(result);
}

export async function unblock(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const targetUserId = req.params.userId || req.body.targetUserId;
  if (!targetUserId) {
    throw new AppError('Target userId is required', HTTP_STATUS.BAD_REQUEST);
  }

  const result = await unblockUser(user.id, targetUserId);
  return res.status(HTTP_STATUS.OK).json(result);
}

export async function muteChat(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const conversationId = req.params.id || req.body.conversationId;
  if (!conversationId) {
    throw new AppError('conversationId is required', HTTP_STATUS.BAD_REQUEST);
  }

  const durationHours = req.body.durationHours !== undefined ? Number(req.body.durationHours) : undefined;
  const result = await muteConversation({
    conversationId,
    userId: user.id,
    durationHours,
  });

  return res.status(HTTP_STATUS.OK).json(result);
}

export async function unmuteChat(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const conversationId = req.params.id || req.body.conversationId;
  if (!conversationId) {
    throw new AppError('conversationId is required', HTTP_STATUS.BAD_REQUEST);
  }

  const result = await unmuteConversation(user.id, conversationId);
  return res.status(HTTP_STATUS.OK).json(result);
}

export async function getMuted(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const mutedConversationIds = await getMutedConversationIds(user.id);
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    mutedConversationIds,
  });
}
