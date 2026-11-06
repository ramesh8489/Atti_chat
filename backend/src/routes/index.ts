import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import conversationRoutes from './conversationRoutes.js';
import attachmentRoutes from './attachmentRoutes.js';
import callRoutes from './callRoutes.js';
import advancedMessageRoutes from './advancedMessageRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import privacyRoutes from './privacyRoutes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/conversations', conversationRoutes);
router.use('/notifications', notificationRoutes);
router.use('/privacy', privacyRoutes);
router.use('/', attachmentRoutes);
router.use('/', callRoutes);
router.use('/', advancedMessageRoutes);

export default router;
