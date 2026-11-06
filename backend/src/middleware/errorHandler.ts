import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { HTTP_STATUS } from '../constants/index.js';
import { logger } from '../config/logger.js';

export class AppError extends Error {
  public statusCode: number;
  public details?: any;

  constructor(message: string, statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR, details?: any) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.id;

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    logger.warn('Validation error on request:', {
      requestId,
      path: req.path,
      method: req.method,
      issues: err.errors,
    });
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: 'Validation failed',
      details: err.flatten().fieldErrors,
      requestId,
    });
  }

  // Handle known AppError
  if (err instanceof AppError) {
    logger.warn(`AppError [${err.statusCode}]: ${err.message}`, {
      requestId,
      path: req.path,
      details: err.details,
    });
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
      requestId,
    });
  }

  // Handle Prisma Database Errors securely without leaking schema structure
  if (err?.name === 'PrismaClientKnownRequestError') {
    logger.error(`Database error [${err.code}]:`, {
      requestId,
      code: err.code,
      message: err.message,
      path: req.path,
    });

    if (err.code === 'P2002') {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        error: 'A resource with this unique value already exists.',
        requestId,
      });
    }
    if (err.code === 'P2025') {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Requested database record not found.',
        requestId,
      });
    }
    if (err.code === 'P2003') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Invalid reference to related resource.',
        requestId,
      });
    }

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Database operation failed.',
      requestId,
    });
  }

  // Handle unhandled unexpected errors
  logger.error('Unhandled server error:', {
    requestId,
    message: err?.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err?.stack,
    path: req.path,
    method: req.method,
  });

  return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' ? { rawMessage: err?.message } : {}),
    requestId,
  });
}
