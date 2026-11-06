import { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants/index.js';
import { findUserByFirebaseUid, syncUserFromFirebase } from '../services/userService.js';
import { AppError } from '../middleware/errorHandler.js';

export async function getCurrentUser(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      user: null,
      message: 'User authenticated with Firebase but profile onboarding is pending.',
      phone: req.user.phoneNumber,
    });
  }

  return res.status(HTTP_STATUS.OK).json({
    success: true,
    user,
  });
}

export async function syncFirebaseUser(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  // Strictly derive identity from the server-verified Firebase token
  const phoneNumber = req.user.phoneNumber;
  if (!phoneNumber) {
    throw new AppError('Verified phone number is required on authentication token.', HTTP_STATUS.BAD_REQUEST);
  }

  const { user, isNewUser } = await syncUserFromFirebase(req.user.uid, phoneNumber);
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    user,
    isNewUser,
  });
}
