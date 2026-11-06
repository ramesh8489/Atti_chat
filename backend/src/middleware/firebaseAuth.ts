import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from './errorHandler.js';
import { HTTP_STATUS } from '../constants/index.js';

let isFirebaseInitialized = false;

// Check if credentials are placeholders
function isPlaceholder(val?: string): boolean {
  if (!val) return true;
  return val.includes('placeholder') || val.includes('PLACEHOLDER');
}

// Initialize Firebase Admin safely
export function initFirebaseAdmin(): boolean {
  if (admin.apps.length > 0) {
    isFirebaseInitialized = true;
    return true;
  }
  if (isFirebaseInitialized) return true;

  // Check for Google Application Credentials path
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      isFirebaseInitialized = true;
      logger.info('Firebase Admin SDK initialized using GOOGLE_APPLICATION_CREDENTIALS.');
      return true;
    } catch (err: any) {
      logger.error('Failed to initialize Firebase Admin with applicationDefault:', { message: err?.message });
    }
  }

  // Check for explicit service account environment variables
  if (
    env.FIREBASE_PROJECT_ID &&
    !isPlaceholder(env.FIREBASE_PROJECT_ID) &&
    env.FIREBASE_CLIENT_EMAIL &&
    !isPlaceholder(env.FIREBASE_CLIENT_EMAIL) &&
    env.FIREBASE_PRIVATE_KEY &&
    !isPlaceholder(env.FIREBASE_PRIVATE_KEY)
  ) {
    try {
      const formattedPrivateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: formattedPrivateKey,
        }),
      });
      isFirebaseInitialized = true;
      logger.info('Firebase Admin SDK initialized successfully with service account cert.');
      return true;
    } catch (err: any) {
      logger.error('Failed to initialize Firebase Admin SDK with cert:', { message: err?.message });
      return false;
    }
  }

  return false;
}

export function resetFirebaseAdminForTesting(): void {
  isFirebaseInitialized = false;
}

export interface AuthenticatedUser {
  uid: string;
  phoneNumber?: string;
  email?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Common verification function used by HTTP routes and Socket.IO middleware
 */
export async function verifyAuthToken(token: string): Promise<AuthenticatedUser> {
  if (initFirebaseAdmin()) {
    try {
      const decoded = await admin.auth().verifyIdToken(token, true);
      if (!decoded || !decoded.uid) {
        throw new AppError('Invalid authentication token.', HTTP_STATUS.UNAUTHORIZED);
      }

      return {
        uid: decoded.uid,
        phoneNumber: decoded.phone_number,
        email: decoded.email,
      };
    } catch (err: any) {
      const errorCode = err?.code;
      logger.warn('Firebase ID token verification failed:', { code: errorCode, message: err?.message });

      if (errorCode === 'auth/id-token-expired') {
        throw new AppError('Authentication token has expired. Please sign in again.', HTTP_STATUS.UNAUTHORIZED);
      }
      if (errorCode === 'auth/id-token-revoked') {
        throw new AppError('Authentication token has been revoked.', HTTP_STATUS.UNAUTHORIZED);
      }
      throw new AppError('Invalid or expired authentication token.', HTTP_STATUS.UNAUTHORIZED);
    }
  }

  // Support mock tokens during test/development when Firebase Admin is not configured
  if (env.NODE_ENV !== 'production' && token.startsWith('mock_token_')) {
    const mockUid = token.replace('mock_token_', '');
    return {
      uid: mockUid,
      phoneNumber: '+919876543210',
    };
  }

  throw new AppError(
    'Firebase Admin credentials not configured on backend. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.',
    HTTP_STATUS.UNAUTHORIZED
  );
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization?.trim();
  if (!authHeader) {
    return next(new AppError('Authentication required. Missing Bearer token.', HTTP_STATUS.UNAUTHORIZED));
  }

  if (!authHeader.toLowerCase().startsWith('bearer')) {
    return next(new AppError('Authentication required. Missing Bearer token.', HTTP_STATUS.UNAUTHORIZED));
  }

  const token = authHeader.replace(/^bearer\s*/i, '').trim();
  if (!token) {
    return next(new AppError('Invalid Authorization header format.', HTTP_STATUS.UNAUTHORIZED));
  }

  try {
    const user = await verifyAuthToken(token);
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}
