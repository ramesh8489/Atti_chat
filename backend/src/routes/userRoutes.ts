import { Router } from 'express';
import { updateProfile, searchUsersController } from '../controllers/userController.js';
import { requireAuth } from '../middleware/firebaseAuth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { z } from 'zod';

const router = Router();

const updateProfileSchema = {
  body: z.object({
    displayName: z.string().min(1).max(50).optional(),
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Alphanumeric and underscores only').optional(),
    bio: z.string().max(200).optional(),
    avatarUrl: z
      .string()
      .url()
      .regex(/^https?:\/\//i, 'Avatar URL must use http or https protocol')
      .optional(),
  }),
};

router.put('/profile', requireAuth, validateRequest(updateProfileSchema), updateProfile);
router.get('/search', requireAuth, searchUsersController);

export default router;

