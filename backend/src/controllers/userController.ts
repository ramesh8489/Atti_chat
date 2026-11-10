import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS } from '../constants/index.js';
import { findUserByFirebaseUid, updateUserProfile, searchUsers, syncUserFromFirebase } from '../services/userService.js';
import { AppError } from '../middleware/errorHandler.js';

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    let user = await findUserByFirebaseUid(req.user.uid);
    if (!user) {
      // Auto-create user record in database if initial sync was pending
      const syncResult = await syncUserFromFirebase(req.user.uid, req.user.phoneNumber || '+919876543210');
      user = syncResult.user;
    }

    if (!user) {
      throw new AppError('Unable to create or locate user profile', HTTP_STATUS.INTERNAL_SERVER_ERROR);
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
  } catch (err) {
    return next(err);
  }
}

export async function searchUsersController(req: Request, res: Response, next: NextFunction) {
  try {
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
  } catch (err) {
    return next(err);
  }
}
