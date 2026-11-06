import { Request, Response, NextFunction } from 'express';
import { z, ZodTypeAny, ZodError } from 'zod';
import { HTTP_STATUS } from '../constants/index.js';

/**
 * Reusable middleware that validates req.body against a Zod schema.
 */
export function validateBody<T extends ZodTypeAny>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'Validation failed',
          details: err.flatten().fieldErrors,
        });
      }
      next(err);
    }
  };
}

/**
 * Reusable middleware that validates req.query against a Zod schema.
 */
export function validateQuery<T extends ZodTypeAny>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = await schema.parseAsync(req.query);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'Query parameter validation failed',
          details: err.flatten().fieldErrors,
        });
      }
      next(err);
    }
  };
}

// ==========================================
// Standard Validation Schemas
// ==========================================

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, 'Display name cannot be empty').max(50, 'Display name too long').optional(),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username may only contain letters, numbers, underscores, dots, and hyphens')
    .optional(),
  bio: z.string().trim().max(250, 'Bio cannot exceed 250 characters').optional().nullable(),
  avatarUrl: z
    .string()
    .trim()
    .url('Avatar URL must be a valid URL')
    .refine((url) => url.startsWith('http://') || url.startsWith('https://'), {
      message: 'Avatar URL must use http or https protocol',
    })
    .optional()
    .nullable(),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message content cannot be empty').max(10000, 'Message content cannot exceed 10000 characters'),
  type: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'SYSTEM']).optional(),
  replyToId: z.string().trim().uuid('Invalid reply-to message ID format').optional().nullable(),
});

export const editMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message content cannot be empty').max(10000, 'Message content cannot exceed 10000 characters'),
});

export const reactionSchema = z.object({
  emoji: z.string().trim().min(1, 'Emoji is required').max(16, 'Emoji length exceeded'),
});

export const createGroupSchema = z.object({
  title: z.string().trim().min(1, 'Group title is required').max(100, 'Group title cannot exceed 100 characters'),
  memberUserIds: z.array(z.string().trim().min(1)).min(1, 'At least one group member is required').max(100, 'Cannot exceed 100 members'),
  avatarUrl: z.string().trim().url().optional().nullable(),
});

export const forwardMessageSchema = z.object({
  targetConversationIds: z
    .array(z.string().trim().min(1))
    .min(1, 'At least one target conversation required')
    .max(20, 'Cannot forward to more than 20 conversations at once'),
});
