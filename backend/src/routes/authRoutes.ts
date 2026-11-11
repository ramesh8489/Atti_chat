import { Router } from 'express';
import { checkPhone, getCurrentUser, phonePasswordAuth, syncFirebaseUser } from '../controllers/authController.js';
import { requireAuth } from '../middleware/firebaseAuth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { z } from 'zod';

const router = Router();

const syncUserSchema = {
  body: z.object({
    phoneNumber: z.string().min(5).optional(),
  }),
};

const checkPhoneSchema = {
  body: z.object({
    phoneNumber: z.string().min(6, 'Phone number is required').max(24),
  }),
};

const phoneAuthSchema = {
  body: z.object({
    phoneNumber: z.string().min(6, 'Phone number is required').max(24),
    password: z
      .string()
      .min(4, 'PIN or password must be at least 4 characters')
      .max(128, 'PIN or password must be at most 128 characters'),
    mode: z.enum(['login', 'register', 'auto']).optional().default('auto'),
  }),
};

router.post('/check-phone', authLimiter, validateRequest(checkPhoneSchema), checkPhone);
router.post('/phone-auth', authLimiter, validateRequest(phoneAuthSchema), phonePasswordAuth);
router.get('/me', requireAuth, getCurrentUser);
router.post('/sync', requireAuth, validateRequest(syncUserSchema), syncFirebaseUser);

export default router;

