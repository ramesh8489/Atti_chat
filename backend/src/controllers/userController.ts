import { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants/index.js';
import { findUserByFirebaseUid, updateUserProfile, searchUsers } from '../services/userService.js';
import { AppError } from '../middleware/errorHandler.js';

export async function updateProfile(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User profile not found. Please sync account first.', HTTP_STATUS.NOT_FOUND);
  }

  const { displayName, username, bio, avatarUrl } = req.body;
  const updated = await updateUserProfile(user.id, {
    displayName,
    username,
    bio,
    avatarUrl,
  });

  return res.status(HTTP_STATUS.OK).json({
    success: true,
    user: updated,
  });
}

export async function searchUsersController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await findUserByFirebaseUid(req.user.uid);
  const currentUserId = user?.id || '';
  const query = (req.query.q as string) || '';

  const results = await searchUsers(query, currentUserId);
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    users: results,
  });
}

