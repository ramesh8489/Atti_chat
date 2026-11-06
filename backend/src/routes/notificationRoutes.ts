import { Router } from 'express';
import { requireAuth } from '../middleware/firebaseAuth.js';
import {
  listUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAll,
  getPreferences,
  updatePreferences,
  getVapidKey,
  subscribePush,
  unsubscribePush,
} from '../controllers/notificationController.js';

const router = Router();

// Public / auth-free endpoint for public VAPID key
router.get('/push/vapid-key', getVapidKey);

// All subsequent notification endpoints require authentication
router.use(requireAuth);

router.get('/', listUserNotifications);
router.get('/unread-count', getUnreadCount);
router.post('/read-all', markAllAsRead);
router.delete('/', clearAll);

router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

router.get('/preferences', getPreferences);
router.put('/preferences', updatePreferences);

router.post('/push/subscribe', subscribePush);
router.post('/push/unsubscribe', unsubscribePush);

export default router;

