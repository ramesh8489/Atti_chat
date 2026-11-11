import crypto from 'crypto';
import { env } from '../config/env.js';
import { HTTP_STATUS } from '../constants/index.js';
import { AppError } from '../middleware/errorHandler.js';

export const ATTI_JWT_ISSUER = 'atti-auth';
const DEFAULT_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const SCRYPT_KEYLEN = 64;

export interface AttiJwtPayload {
  sub: string;
  uid: string;
  phone_number: string;
  iss: typeof ATTI_JWT_ISSUER;
  iat: number;
  exp: number;
}

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function getJwtSecret(): Buffer {
  const configured = env.JWT_SECRET?.trim();
  if (configured && configured.length >= 16) {
    return crypto.createHash('sha256').update(configured).digest();
  }
  return crypto.createHash('sha256').update(`${env.DATABASE_URL}|atti-jwt-secret`).digest();
}

/**
 * Hash a user PIN or password using Node crypto scrypt with a random 16-byte salt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${derived}`;
}

/**
 * Constant-time password verification against a stored `salt:hash` string.
 */
export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || typeof storedHash !== 'string') {
    return false;
  }

  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }

  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex || expectedHex.length !== SCRYPT_KEYLEN * 2) {
    return false;
  }

  try {
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    const actualBuf = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
    if (expectedBuf.length !== actualBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

/**
 * Sign an HS256 JWT containing Atti/PingUp user identity compatible with Firebase token claims.
 */
export function signAttiToken(
  identity: { userId: string; firebaseUid: string; phoneNumber: string },
  ttlSeconds: number = DEFAULT_TOKEN_TTL_SECONDS
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadObj: AttiJwtPayload = {
    sub: identity.userId,
    uid: identity.firebaseUid,
    phone_number: identity.phoneNumber,
    iss: ATTI_JWT_ISSUER,
    iat: now,
    exp: now + ttlSeconds,
  };
  const payload = toBase64Url(JSON.stringify(payloadObj));
  const signingInput = `${header}.${payload}`;
  const signature = crypto
    .createHmac('sha256', getJwtSecret())
    .update(signingInput)
    .digest('base64url');

  return `${signingInput}.${signature}`;
}

/**
 * Quickly check if a Bearer token is an Atti Phone+PIN JWT (`iss === 'atti-auth'`)
 * before attempting signature verification, allowing Firebase tokens to pass through cleanly.
 */
export function isAttiAuthJwt(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }

  try {
    const payload = JSON.parse(fromBase64Url(parts[1]));
    return payload?.iss === ATTI_JWT_ISSUER;
  } catch {
    return false;
  }
}

/**
 * Verify an Atti HS256 JWT and extract `{ uid, phoneNumber }`.
 */
export function verifyAttiToken(token: string): { uid: string; phoneNumber: string } {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AppError('Invalid or expired authentication token.', HTTP_STATUS.UNAUTHORIZED);
  }

  const [headerPart, payloadPart, signaturePart] = parts;

  let header: { alg?: string };
  let payload: Partial<AttiJwtPayload>;
  try {
    header = JSON.parse(fromBase64Url(headerPart));
    payload = JSON.parse(fromBase64Url(payloadPart));
  } catch {
    throw new AppError('Invalid or expired authentication token.', HTTP_STATUS.UNAUTHORIZED);
  }

  if (header?.alg !== 'HS256' || payload?.iss !== ATTI_JWT_ISSUER) {
    throw new AppError('Invalid or expired authentication token.', HTTP_STATUS.UNAUTHORIZED);
  }

  const expectedSig = crypto
    .createHmac('sha256', getJwtSecret())
    .update(`${headerPart}.${payloadPart}`)
    .digest('base64url');

  const actualSigBuf = Buffer.from(signaturePart);
  const expectedSigBuf = Buffer.from(expectedSig);
  if (actualSigBuf.length !== expectedSigBuf.length || !crypto.timingSafeEqual(actualSigBuf, expectedSigBuf)) {
    throw new AppError('Invalid or expired authentication token.', HTTP_STATUS.UNAUTHORIZED);
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= now) {
    throw new AppError('Authentication token has expired. Please sign in again.', HTTP_STATUS.UNAUTHORIZED);
  }

  if (!payload.uid || !payload.phone_number) {
    throw new AppError('Invalid or expired authentication token.', HTTP_STATUS.UNAUTHORIZED);
  }

  return {
    uid: payload.uid,
    phoneNumber: payload.phone_number,
  };
}
