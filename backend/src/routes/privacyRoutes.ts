import { Router } from 'express';
import { requireAuth } from '../middleware/firebaseAuth.js';
import {
  getPrivacy,
  updatePrivacy,
  getBlocked,
  block,
  unblock,
  muteChat,
  unmuteChat,
  getMuted,
} from '../controllers/privacyController.js';

const router = Router();

router.use(requireAuth);

router.get('/', getPrivacy);
router.put('/', updatePrivacy);

router.get('/blocks', getBlocked);
router.post('/blocks/:userId', block);
router.delete('/blocks/:userId', unblock);

router.post('/mute/:id', muteChat);
router.delete('/mute/:id', unmuteChat);
router.get('/muted', getMuted);

export default router;

