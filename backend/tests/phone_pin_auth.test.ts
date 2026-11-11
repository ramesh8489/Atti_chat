import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
  checkDatabaseConnection: vi.fn().mockResolvedValue(true),
}));

import { createApp } from '../src/app.js';
import { prisma } from '../src/database/prisma.js';
import {
  hashPassword,
  verifyPassword,
  signAttiToken,
  verifyAttiToken,
  isAttiAuthJwt,
} from '../src/services/authTokenService.js';
import { verifyAuthToken } from '../src/middleware/firebaseAuth.js';

describe('Phone + PIN/Password Authentication & Token Service', () => {
  const app = createApp();
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('hashes and verifies PIN/passwords using scrypt with constant-time comparison', () => {
    const hash1 = hashPassword('2580');
    const hash2 = hashPassword('2580');

    expect(hash1).toContain(':');
    expect(hash1).not.toBe(hash2); // unique random salt per hash
    expect(verifyPassword('2580', hash1)).toBe(true);
    expect(verifyPassword('0000', hash1)).toBe(false);
    expect(verifyPassword('2580', 'malformed-hash')).toBe(false);
    expect(verifyPassword('2580', null)).toBe(false);
  });

  it('signs and verifies Atti HS256 JWT tokens and rejects tampering or expiry', () => {
    const token = signAttiToken({
      userId: 'usr_123',
      firebaseUid: 'phone_uuid_123',
      phoneNumber: '+916385328489',
    });

    expect(isAttiAuthJwt(token)).toBe(true);
    expect(isAttiAuthJwt('mock_token_abc')).toBe(false);

    const verified = verifyAttiToken(token);
    expect(verified.uid).toBe('phone_uuid_123');
    expect(verified.phoneNumber).toBe('+916385328489');

    // Tampered signature rejected
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.tamperedsig`;
    expect(() => verifyAttiToken(tampered)).toThrow(/Invalid or expired authentication token/i);

    // Expired token rejected
    const expiredToken = signAttiToken(
      {
        userId: 'usr_123',
        firebaseUid: 'phone_uuid_123',
        phoneNumber: '+916385328489',
      },
      -10
    );
    expect(() => verifyAttiToken(expiredToken)).toThrow(/token has expired/i);
  });

  it('blocks mock_token_ authentication when NODE_ENV is production', async () => {
    process.env.NODE_ENV = 'production';
    await expect(verifyAuthToken('mock_token_intruder')).rejects.toThrow(/Firebase|Invalid/i);
  });

  it('POST /api/auth/check-phone reports whether account exists cleanly', async () => {
    (prisma.user.findUnique as any).mockResolvedValueOnce(null);

    const newRes = await request(app)
      .post('/api/auth/check-phone')
      .send({ phoneNumber: '+91 63853 28489' });

    expect(newRes.status).toBe(200);
    expect(newRes.body).toEqual({ success: true, exists: false, hasPassword: false });

    (prisma.user.findUnique as any).mockResolvedValueOnce({
      id: 'usr_existing',
      passwordHash: 'salt:hash',
    });

    const existingRes = await request(app)
      .post('/api/auth/check-phone')
      .send({ phoneNumber: '+916385328489' });

    expect(existingRes.status).toBe(200);
    expect(existingRes.body).toEqual({ success: true, exists: true, hasPassword: true });
  });

  it('registers a brand new phone user, returns JWT token, and authenticates /api/auth/me', async () => {
    (prisma.user.findUnique as any).mockResolvedValueOnce(null);
    (prisma.user.create as any).mockResolvedValueOnce({
      id: 'usr_real_1',
      firebaseUid: 'phone_abc123',
      phoneNumber: '+916385328489',
      username: null,
      displayName: '+916385328489',
      avatarUrl: null,
      bio: 'Hey there! I am using Atti.',
      statusMessage: null,
      isOnline: false,
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    const regRes = await request(app)
      .post('/api/auth/phone-auth')
      .send({ phoneNumber: '+916385328489', password: 'my-secret-pin', mode: 'register' });

    expect(regRes.status).toBe(200);
    expect(regRes.body.success).toBe(true);
    expect(regRes.body.isNewUser).toBe(true);
    expect(typeof regRes.body.token).toBe('string');
    expect(regRes.body.user.passwordHash).toBeUndefined();

    // Use the issued JWT directly against /api/auth/me
    (prisma.user.findUnique as any).mockResolvedValueOnce({
      id: 'usr_real_1',
      firebaseUid: 'phone_abc123',
      phoneNumber: '+916385328489',
      username: 'ramesh',
      displayName: 'Ramesh',
    });

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${regRes.body.token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.id).toBe('usr_real_1');
  });

  it('verifies existing user login PIN and rejects wrong PIN with 401', async () => {
    const storedHash = hashPassword('654321');
    const existingRecord = {
      id: 'usr_real_2',
      firebaseUid: 'phone_xyz',
      phoneNumber: '+919876543210',
      passwordHash: storedHash,
      username: 'friend1',
      displayName: 'Friend One',
    };

    (prisma.user.findUnique as any).mockResolvedValueOnce(existingRecord);
    const badRes = await request(app)
      .post('/api/auth/phone-auth')
      .send({ phoneNumber: '+919876543210', password: '111111', mode: 'login' });

    expect(badRes.status).toBe(401);
    expect(badRes.body.error).toMatch(/Incorrect PIN/i);

    (prisma.user.findUnique as any).mockResolvedValueOnce(existingRecord);
    (prisma.user.update as any).mockResolvedValueOnce({
      id: 'usr_real_2',
      firebaseUid: 'phone_xyz',
      phoneNumber: '+919876543210',
      username: 'friend1',
      displayName: 'Friend One',
    });

    const okRes = await request(app)
      .post('/api/auth/phone-auth')
      .send({ phoneNumber: '+919876543210', password: '654321', mode: 'login' });

    expect(okRes.status).toBe(200);
    expect(okRes.body.success).toBe(true);
    expect(okRes.body.isNewUser).toBe(false);
    expect(okRes.body.user.passwordHash).toBeUndefined();
  });
});
