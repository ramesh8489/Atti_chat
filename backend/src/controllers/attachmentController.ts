import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS, SOCKET_EVENTS } from '../constants/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { findUserByFirebaseUid } from '../services/userService.js';
import {
  validateFileMetadata,
  validateFileSignature,
  scanFileBuffer,
} from '../services/mediaValidationService.js';
import {
  createPresignedUploadUrl,
  createPresignedDownloadUrl,
  saveLocalFile,
  getLocalFilePath,
  deleteStoredFile,
  generateAttachmentKey,
} from '../services/storageService.js';
import {
  createMessageWithAttachment,
  getAttachmentById,
  deleteAttachment,
  listConversationAttachments,
  getConversationParticipantUserIds,
} from '../services/conversationService.js';
import { prisma } from '../database/prisma.js';
import fs from 'fs';
import { getIo } from '../socket/socketServer.js';
import { logger } from '../config/logger.js';

export async function presignAttachmentUpload(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    const user = await findUserByFirebaseUid(req.user.uid);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const conversationId = req.params.conversationId as string;
    const { fileName, mimeType, fileSize } = req.body;

    // 1. Verify user is in conversation
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
    });

    if (!participant) {
      throw new AppError('Access denied: You are not a participant in this conversation', HTTP_STATUS.FORBIDDEN);
    }

    // 2. Validate file metadata
    const validation = validateFileMetadata(fileName, mimeType, Number(fileSize));
    if (!validation.valid || !validation.sanitizedFilename) {
      throw new AppError(validation.error || 'Invalid file metadata', HTTP_STATUS.BAD_REQUEST);
    }

    // 3. Issue presigned URL or local upload target
    const presigned = await createPresignedUploadUrl(
      conversationId,
      validation.sanitizedFilename,
      validation.mimeType,
      Number(fileSize)
    );

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      ...presigned,
      sanitizedFilename: validation.sanitizedFilename,
      fileType: validation.fileType,
    });
  } catch (err) {
    next(err);
  }
}

export async function localUploadAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    const user = await findUserByFirebaseUid(req.user.uid);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const conversationId = req.params.conversationId as string;
    const file = req.file;

    if (!file) {
      throw new AppError('No file uploaded', HTTP_STATUS.BAD_REQUEST);
    }

    // 1. Verify conversation access
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
    });

    if (!participant) {
      throw new AppError('Access denied: You are not a participant in this conversation', HTTP_STATUS.FORBIDDEN);
    }

    // 2. Validate metadata
    const metaValidation = validateFileMetadata(file.originalname, file.mimetype, file.size);
    if (!metaValidation.valid || !metaValidation.sanitizedFilename) {
      throw new AppError(metaValidation.error || 'Invalid file', HTTP_STATUS.BAD_REQUEST);
    }

    // 3. Validate signature (magic bytes)
    const sigValidation = validateFileSignature(file.buffer, metaValidation.mimeType);
    if (!sigValidation.valid) {
      throw new AppError(sigValidation.error || 'File signature mismatch', HTTP_STATUS.BAD_REQUEST);
    }

    // 4. Scan file for threats
    const scan = await scanFileBuffer(file.buffer, metaValidation.sanitizedFilename);
    if (!scan.clean) {
      throw new AppError(`Malware or suspicious content detected: ${scan.threat}`, HTTP_STATUS.BAD_REQUEST);
    }

    // 5. Store file locally
    const fileKey = req.body.fileKey || generateAttachmentKey(conversationId, metaValidation.sanitizedFilename);
    await saveLocalFile(fileKey, file.buffer);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      fileKey,
      fileName: metaValidation.sanitizedFilename,
      fileSize: file.size,
      mimeType: metaValidation.mimeType,
      fileType: metaValidation.fileType,
    });
  } catch (err) {
    next(err);
  }
}

export async function confirmAttachmentUpload(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    const user = await findUserByFirebaseUid(req.user.uid);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const conversationId = req.params.conversationId as string;
    const {
      fileKey,
      fileName,
      fileSize,
      mimeType,
      fileType,
      textContent,
      replyToId,
      width,
      height,
      durationSec,
    } = req.body;

    if (!fileKey || !fileName || !fileSize || !mimeType || !fileType) {
      throw new AppError('fileKey, fileName, fileSize, mimeType, and fileType are required', HTTP_STATUS.BAD_REQUEST);
    }

    // 1. Create message with media attachment
    const message = await createMessageWithAttachment({
      conversationId,
      senderId: user.id,
      fileKey,
      fileName,
      fileSize: Number(fileSize),
      mimeType,
      fileType,
      textContent,
      replyToId,
      width: width ? Number(width) : undefined,
      height: height ? Number(height) : undefined,
      durationSec: durationSec ? Number(durationSec) : undefined,
    });

    // 2. Broadcast via Socket.IO if server is active
    const io = getIo();
    if (io) {
      io.to(`conv:${conversationId}`).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, message);

      try {
        const participantUserIds = await getConversationParticipantUserIds(conversationId);
        participantUserIds.forEach((pid) => {
          if (pid !== user.id) {
            io.to(`user:${pid}`).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, {
              ...message,
              isOutgoing: false,
            });
          }
        });
      } catch (err: any) {
        logger.warn('Failed to dispatch socket event for attachment message:', { message: err?.message });
      }
    }

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAttachmentDownloadUrl(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    const user = await findUserByFirebaseUid(req.user.uid);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const attachmentId = req.params.id as string;

    // Authorization check (verifies conversation membership)
    const attachment = await getAttachmentById(attachmentId, user.id);

    const presigned = await createPresignedDownloadUrl(
      attachment.id,
      attachment.fileKey,
      attachment.fileName || undefined
    );

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      ...presigned,
      fileName: attachment.fileName || 'attachment',
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
    });
  } catch (err) {
    next(err);
  }
}

export async function downloadAttachmentStream(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    const user = await findUserByFirebaseUid(req.user.uid);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const attachmentId = req.params.id as string;
    const attachment = await getAttachmentById(attachmentId, user.id);

    const localPath = getLocalFilePath(attachment.fileKey);
    if (!fs.existsSync(localPath)) {
      throw new AppError('Attachment file not found on storage', HTTP_STATUS.NOT_FOUND);
    }

    const safeName = attachment.fileName ? attachment.fileName.replace(/["\r\n]/g, '') : 'attachment';

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Length', attachment.fileSize);

    const stream = fs.createReadStream(localPath);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

export async function deleteAttachmentController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    const user = await findUserByFirebaseUid(req.user.uid);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const attachmentId = req.params.id as string;

    const result = await deleteAttachment(attachmentId, user.id);
    await deleteStoredFile(result.fileKey);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Attachment deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function listAttachmentsController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
    }

    const user = await findUserByFirebaseUid(req.user.uid);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const conversationId = req.params.conversationId as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;

    const data = await listConversationAttachments(conversationId, user.id, limit, page);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      ...data,
    });
  } catch (err) {
    next(err);
  }
}
