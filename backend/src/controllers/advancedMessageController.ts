import { Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { HTTP_STATUS } from '../constants/index.js';
import { findUserByFirebaseUid } from '../services/userService.js';
import {
  editMessage,
  deleteMessage,
  toggleMessageReaction,
  pinMessage,
  unpinMessage,
  listPinnedMessages,
  toggleStarMessage,
  listStarredMessages,
  forwardMessage,
  searchMessages,
} from '../services/advancedMessagingService.js';

export async function editMessageController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }
  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const id = req.params.id as string;
  const { content } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    throw new AppError('Message content cannot be empty', HTTP_STATUS.BAD_REQUEST);
  }

  const updatedMessage = await editMessage({
    messageId: id,
    userId: user.id,
    newContent: content,
  });

  return res.status(HTTP_STATUS.OK).json({
    success: true,
    message: updatedMessage,
  });
}

export async function deleteMessageController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }
  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const id = req.params.id as string;
  const { deleteType } = req.body || {};

  const type = deleteType === 'FOR_ME' ? 'FOR_ME' : 'FOR_EVERYONE';
  const result = await deleteMessage({
    messageId: id,
    userId: user.id,
    deleteType: type,
  });

  return res.status(HTTP_STATUS.OK).json({
    ...result,
  });
}

export async function toggleReactionController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }
  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const id = req.params.id as string;
  const { emoji } = req.body;

  if (!emoji || typeof emoji !== 'string' || emoji.trim().length === 0) {
    throw new AppError('Emoji must be provided', HTTP_STATUS.BAD_REQUEST);
  }

  const result = await toggleMessageReaction({
    messageId: id,
    userId: user.id,
    emoji: emoji.trim(),
  });

  return res.status(HTTP_STATUS.OK).json({
    ...result,
  });
}

export async function pinMessageController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }
  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const conversationId = req.params.conversationId as string;
  const targetMessageId = (req.params.messageId || req.body.messageId) as string;

  if (!targetMessageId) {
    throw new AppError('Message ID is required to pin', HTTP_STATUS.BAD_REQUEST);
  }

  const pinned = await pinMessage({
    conversationId,
    messageId: targetMessageId,
    userId: user.id,
  });

  return res.status(HTTP_STATUS.OK).json({
    success: true,
    pinnedMessage: pinned,
  });
}

export async function unpinMessageController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }
  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const conversationId = req.params.conversationId as string;
  const targetMessageId = (req.params.messageId || req.body.messageId) as string;

  if (!targetMessageId) {
    throw new AppError('Message ID is required to unpin', HTTP_STATUS.BAD_REQUEST);
  }

  const result = await unpinMessage({
    conversationId,
    messageId: targetMessageId,
    userId: user.id,
  });

  return res.status(HTTP_STATUS.OK).json({
    ...result,
  });
}

export async function listPinnedMessagesController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }
  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const conversationId = req.params.conversationId as string;
  const pinnedMessages = await listPinnedMessages(conversationId, user.id);

  return res.status(HTTP_STATUS.OK).json({
    success: true,
    pinnedMessages,
  });
}

export async function toggleStarController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }
  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const id = req.params.id as string;
  const result = await toggleStarMessage({
    messageId: id,
    userId: user.id,
  });

  return res.status(HTTP_STATUS.OK).json({
    ...result,
  });
}

export async function listStarredMessagesController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }
  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const starred = await listStarredMessages(user.id);

  return res.status(HTTP_STATUS.OK).json({
    success: true,
    starredMessages: starred,
  });
}

export async function forwardMessageController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }
  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const id = req.params.id as string;
  const { targetConversationIds } = req.body;

  if (!Array.isArray(targetConversationIds) || targetConversationIds.length === 0) {
    throw new AppError('Target conversation IDs must be a non-empty array', HTTP_STATUS.BAD_REQUEST);
  }

  const messages = await forwardMessage({
    sourceMessageId: id,
    targetConversationIds,
    senderId: user.id,
  });

  return res.status(HTTP_STATUS.CREATED).json({
    success: true,
    messages,
  });
}

export async function searchMessagesController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }
  const user = await findUserByFirebaseUid(req.user.uid);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
  }

  const q = req.query.q as string;
  if (!q || q.trim().length === 0) {
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      messages: [],
      total: 0,
    });
  }

  const conversationId = (req.query.conversationId as string) || undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

  const result = await searchMessages({
    userId: user.id,
    query: q.trim(),
    conversationId,
    limit,
    offset,
  });

  return res.status(HTTP_STATUS.OK).json({
    success: true,
    query: q,
    ...result,
  });
}
