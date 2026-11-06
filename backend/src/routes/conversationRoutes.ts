import { Router } from 'express';
import {
  listConversations,
  getConversation,
  createConversation,
  createGroup,
  getMessages,
  sendMessage,
  markAsRead,
} from '../controllers/conversationController.js';
import { muteChat, unmuteChat } from '../controllers/privacyController.js';
import { requireAuth } from '../middleware/firebaseAuth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { z } from 'zod';

const router = Router();

const createConversationSchema = {
  body: z.object({
    targetUserId: z.string().min(1),
  }),
};

const createGroupSchema = {
  body: z.object({
    title: z.string().min(1).max(100),
    memberUserIds: z.array(z.string().min(1)).min(1),
    avatarUrl: z.string().url().optional(),
  }),
};

const sendMessageSchema = {
  body: z.object({
    content: z.string().min(1).max(5000),
    type: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE']).optional(),
    replyToId: z.string().optional(),
  }),
};

router.get('/', requireAuth, listConversations);
router.get('/:id', requireAuth, getConversation);
router.post('/', requireAuth, validateRequest(createConversationSchema), createConversation);
router.post('/group', requireAuth, validateRequest(createGroupSchema), createGroup);
router.get('/:id/messages', requireAuth, getMessages);
router.post('/:id/messages', requireAuth, validateRequest(sendMessageSchema), sendMessage);
router.post('/:id/read', requireAuth, markAsRead);
router.post('/:id/mute', requireAuth, muteChat);
router.delete('/:id/mute', requireAuth, unmuteChat);

export default router;
