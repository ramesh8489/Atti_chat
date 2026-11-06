import { Router } from 'express';
import { requireAuth } from '../middleware/firebaseAuth.js';
import {
  getIceServersController,
  getCallHistoryController,
  getConversationCallHistoryController,
} from '../controllers/callController.js';

const router = Router();

// Protected WebRTC ICE server config endpoint
router.get('/webrtc/ice-servers', requireAuth, getIceServersController);
router.get('/calls/ice-servers', requireAuth, getIceServersController);

// Call history endpoints
router.get('/calls/history', requireAuth, getCallHistoryController);
router.get('/conversations/:conversationId/calls', requireAuth, getConversationCallHistoryController);

export default router;

