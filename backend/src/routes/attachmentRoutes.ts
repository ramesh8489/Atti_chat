import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/firebaseAuth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { z } from 'zod';
import {
  presignAttachmentUpload,
  localUploadAttachment,
  confirmAttachmentUpload,
  getAttachmentDownloadUrl,
  downloadAttachmentStream,
  deleteAttachmentController,
  listAttachmentsController,
} from '../controllers/attachmentController.js';

const router = Router();

// Configure Multer for in-memory temporary buffer handling before validation and storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB absolute max
    files: 1,
  },
});

const presignSchema = {
  body: z.object({
    fileName: z.string().min(1).max(255),
    mimeType: z.string().min(1),
    fileSize: z.number().positive(),
  }),
};

const confirmSchema = {
  body: z.object({
    fileKey: z.string().min(1),
    fileName: z.string().min(1),
    fileSize: z.number().positive(),
    mimeType: z.string().min(1),
    fileType: z.enum(['IMAGE', 'VIDEO', 'FILE', 'AUDIO']),
    textContent: z.string().optional(),
    replyToId: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    durationSec: z.number().optional(),
  }),
};

// Conversation-scoped attachment operations
router.post(
  '/conversations/:conversationId/attachments/presign',
  requireAuth,
  uploadLimiter,
  validateRequest(presignSchema),
  presignAttachmentUpload
);

router.post(
  '/conversations/:conversationId/attachments/local-upload',
  requireAuth,
  uploadLimiter,
  upload.single('file'),
  localUploadAttachment
);

router.post(
  '/conversations/:conversationId/attachments/confirm',
  requireAuth,
  validateRequest(confirmSchema),
  confirmAttachmentUpload
);

router.get(
  '/conversations/:conversationId/attachments',
  requireAuth,
  listAttachmentsController
);

// Attachment-scoped access & download operations
router.get(
  '/attachments/:id/download-url',
  requireAuth,
  getAttachmentDownloadUrl
);

router.get(
  '/attachments/:id/download',
  requireAuth,
  downloadAttachmentStream
);

router.delete(
  '/attachments/:id',
  requireAuth,
  deleteAttachmentController
);

export default router;
