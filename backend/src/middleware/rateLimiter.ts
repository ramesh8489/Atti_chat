import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants/index.js';

const isTestEnv = process.env.NODE_ENV === 'test';

/**
 * General API rate limiter.
 * Limits standard API requests per IP address.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTestEnv ? 10000 : 300, // 300 reqs/min in production
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  handler: (_req: Request, res: Response) => {
    res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      success: false,
      error: 'Too many requests. Please slow down and try again later.',
      retryAfterSeconds: 60,
    });
  },
});

/**
 * Strict Auth rate limiter.
 * Protects login and token exchange endpoints against credential stuffing/brute force.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnv ? 10000 : 30, // 30 reqs / 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  handler: (_req: Request, res: Response) => {
    res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      success: false,
      error: 'Too many authentication attempts. Please try again after 15 minutes.',
      retryAfterSeconds: 900,
    });
  },
});

/**
 * Attachment upload / presign rate limiter.
 * Protects storage API against excessive presigned URL generation or file flooding.
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTestEnv ? 10000 : 40, // 40 uploads / min
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  handler: (_req: Request, res: Response) => {
    res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      success: false,
      error: 'Upload rate limit exceeded. Please wait a minute before requesting more upload slots.',
      retryAfterSeconds: 60,
    });
  },
});
