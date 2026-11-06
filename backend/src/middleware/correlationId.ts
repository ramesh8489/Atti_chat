import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Attaches a unique Correlation / Request ID to every incoming request.
 * Useful for tracing logs, audits, and debugging production security events.
 */
export function correlationId(req: Request, res: Response, next: NextFunction) {
  const existing = (req.headers['x-request-id'] || req.headers['x-correlation-id']) as string | undefined;
  const requestId = existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)
    ? existing
    : crypto.randomUUID();

  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}
