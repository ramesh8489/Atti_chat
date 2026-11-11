import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS, SOCKET_EVENTS } from '../constants/index.js';
import {
  getUserConversations,
  getConversationById,
  createDirectConversation,
  createGroupConversation,
  getConversationMessages,
  getConversationParticipantUserIds,
  createMessage,
  markMessagesAsRead,
} from '../services/conversationService.js';
import { findUserByFirebaseUid } from '../services/userService.js';
import { AppError } from '../middleware/errorHandler.js';
import { broadcastNewMessage, getIo } from '../socket/socketServer.js';

export async function listConversations(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    const user = await findUserByFirebaseUid(req.user.uid);
    if (!user) {
      return res.status(HTTP_STATUS.OK).json({ success: true, conversations: [] });
    }

    const conversations = await getUserConversations(user.id);
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      conversations,
    });
  } catch (err) {
    next(err);
  }
}

export async function getConversation(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    const user = await findUserByFirebaseUid(req.user.uid);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const conversationId = req.params.id as string;
    const conversation = await getConversationById(conversationId, user.id);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      conversation,
    });
  } catch (err) {
    next(err);
  }
}

export async function createConversation(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    const user = await findUserByFirebaseUid(req.user.uid);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const { targetUserId } = req.body;
    if (!targetUserId) {
      throw new AppError('targetUserId is required', HTTP_STATUS.BAD_REQUEST);
    }

    const conversation = await createDirectConversation(user.id, targetUserId);

    const io = getIo();
    if (io && conversation?.id) {
      io.in(`user:${user.id}`).socketsJoin(`conv:${conversation.id}`);
      io.in(`user:${targetUserId}`).socketsJoin(`conv:${conversation.id}`);
      try {
        const targetView = await getConversationById(conversation.id, targetUserId);
        io.to(`user:${targetUserId}`).emit(SOCKET_EVENTS.CONVERSATION_NEW, targetView);
      } catch {
        // Fallback: recipient refreshes on next incoming message
      }
    }

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      conversation,
    });
  } catch (err) {
    next(err);
  }
}

export async function createGroup(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    const user = await findUserByFirebaseUid(req.user.uid);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const { title, memberUserIds, avatarUrl } = req.body;
    if (!title || !Array.isArray(memberUserIds)) {
      throw new AppError('title and memberUserIds array are required', HTTP_STATUS.BAD_REQUEST);
    }

    const conversation = await createGroupConversation(user.id, {
      title,
      memberUserIds,
      avatarUrl,
    });

    const io = getIo();
    if (io && conversation?.id && Array.isArray(conversation.participants)) {
      for (const p of conversation.participants) {
        io.in(`user:${p.id}`).socketsJoin(`conv:${conversation.id}`);
        if (p.id !== user.id) {
          getConversationById(conversation.id, p.id)
            .then((view) => io.to(`user:${p.id}`).emit(SOCKET_EVENTS.CONVERSATION_NEW, view))
            .catch(() => {});
        }
      }
    }

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      conversation,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMessages(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    const user = await findUserByFirebaseUid(req.user.uid);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const conversationId = req.params.id as string;
    const limit = req.query.limit ? Math.min(Math.max(1, parseInt(req.query.limit as string, 10)), 100) : 50;

    const messages = await getConversationMessages(conversationId, user.id, limit);
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      messages,
    });
  } catch (err) {
    next(err);
  }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    const user = await findUserByFirebaseUid(req.user.uid);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const conversationId = req.params.id as string;
    const { content, type, replyToId } = req.body;

    const message = await createMessage(user.id, conversationId, content, type, replyToId);
    const participantIds = await getConversationParticipantUserIds(conversationId);
    broadcastNewMessage(message, user.id, participantIds);

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message,
    });
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    const user = await findUserByFirebaseUid(req.user.uid);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const conversationId = req.params.id as string;
    const result = await markMessagesAsRead(conversationId, user.id);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      markedCount: result.markedCount,
    });
  } catch (err) {
    next(err);
  }
}
