import { Router } from 'express';
import { requireAuth } from '../middleware/firebaseAuth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { z } from 'zod';
import {
  editMessageController,
  deleteMessageController,
  toggleReactionController,
  pinMessageController,
  unpinMessageController,
  listPinnedMessagesController,
  toggleStarController,
  listStarredMessagesController,
  forwardMessageController,
  searchMessagesController,
} from '../controllers/advancedMessageController.js';

const router = Router();

const editSchema = {
  body: z.object({
    content: z.string().trim().min(1, 'Message content cannot be empty').max(10000, 'Content exceeds maximum limit'),
  }),
};

const reactionSchema = {
  body: z.object({
    emoji: z.string().trim().min(1, 'Emoji is required').max(16, 'Emoji length exceeded'),
  }),
};

const forwardSchema = {
  body: z.object({
    targetConversationIds: z
      .array(z.string().min(1))
      .min(1, 'At least one target conversation required')
      .max(20, 'Cannot forward to more than 20 conversations at once'),
  }),
};

// Message search and starred endpoints (placed before :id to prevent collision)
router.get('/messages/search', requireAuth, searchMessagesController);
router.get('/messages/starred', requireAuth, listStarredMessagesController);

// Single message actions
router.put('/messages/:id', requireAuth, validateRequest(editSchema), editMessageController);
router.delete('/messages/:id', requireAuth, deleteMessageController);
router.post('/messages/:id/reactions', requireAuth, validateRequest(reactionSchema), toggleReactionController);
router.post('/messages/:id/star', requireAuth, toggleStarController);
router.post('/messages/:id/forward', requireAuth, validateRequest(forwardSchema), forwardMessageController);

// Conversation pins
router.get('/conversations/:conversationId/pins', requireAuth, listPinnedMessagesController);
router.post('/conversations/:conversationId/pins', requireAuth, pinMessageController);
router.post('/conversations/:conversationId/pins/:messageId', requireAuth, pinMessageController);
router.delete('/conversations/:conversationId/pins/:messageId', requireAuth, unpinMessageController);

export default router;
