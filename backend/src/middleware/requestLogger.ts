import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const reqId = req.id ? ` [${req.id.slice(0, 8)}]` : '';
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms${reqId}`);
  });
  next();
}
