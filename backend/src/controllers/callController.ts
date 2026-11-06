import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS } from '../constants/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { findUserByFirebaseUid } from '../services/userService.js';
import { getIceServers } from '../services/webrtcService.js';
import {
  getCallHistoryForUser,
  getCallHistoryForConversation,
} from '../services/callService.js';
import { prisma } from '../database/prisma.js';

export async function getIceServersController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    const user = await findUserByFirebaseUid(req.user.uid);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const iceServers = getIceServers(user.id);
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      iceServers,
    });
  } catch (err) {
    next(err);
  }
}

export async function getCallHistoryController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    const user = await findUserByFirebaseUid(req.user.uid);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const limit = req.query.limit ? Math.min(Number(req.query.limit), 50) : 20;
    const history = await getCallHistoryForUser(user.id, limit);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      history,
    });
  } catch (err) {
    next(err);
  }
}

export async function getConversationCallHistoryController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    const user = await findUserByFirebaseUid(req.user.uid);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const conversationId = Array.isArray(req.params.conversationId)
      ? req.params.conversationId[0]
      : req.params.conversationId;
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
    });

    if (!participant) {
      throw new AppError('Forbidden: Not a participant in this conversation', HTTP_STATUS.FORBIDDEN);
    }

    const limit = req.query.limit ? Math.min(Number(req.query.limit), 50) : 20;
    const history = await getCallHistoryForConversation(conversationId, limit);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      history,
    });
  } catch (err) {
    next(err);
  }
}
