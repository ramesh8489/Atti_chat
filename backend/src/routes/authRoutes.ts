import { Router } from 'express';
import { getCurrentUser, syncFirebaseUser } from '../controllers/authController.js';
import { requireAuth } from '../middleware/firebaseAuth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { z } from 'zod';

const router = Router();

const syncUserSchema = {
  body: z.object({
    phoneNumber: z.string().min(5).optional(),
  }),
};

router.get('/me', requireAuth, getCurrentUser);
router.post('/sync', requireAuth, validateRequest(syncUserSchema), syncFirebaseUser);

export default router;

