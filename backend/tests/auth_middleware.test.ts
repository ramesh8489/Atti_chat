import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import admin from 'firebase-admin';
import { createApp } from '../src/app.js';

vi.mock('firebase-admin', () => {
  const verifyIdTokenMock = vi.fn();
  const mockAuth = {
    verifyIdToken: verifyIdTokenMock,
  };
  return {
    default: {
      apps: [{ name: '[DEFAULT]' }],
      initializeApp: vi.fn(),
      credential: {
        cert: vi.fn(),
        applicationDefault: vi.fn(),
      },
      auth: () => mockAuth,
    },
  };
});

describe('Firebase Authentication Middleware', () => {
  const app = createApp();
  const authInstance = admin.auth();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects request with 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Missing Bearer token/i);
  });

  it('rejects request with 401 when Authorization header is malformed', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Basic 123456');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Missing Bearer token/i);
  });

  it('rejects request with 401 when Bearer token is empty', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Invalid Authorization header/i);
  });

  it('rejects request with 401 when token is invalid', async () => {
    (authInstance.verifyIdToken as any).mockRejectedValueOnce({
      code: 'auth/argument-error',
      message: 'Decoding Firebase ID token failed.',
    });

    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Invalid or expired authentication token/i);
  });

  it('rejects request with 401 and specific message when token is expired', async () => {
    (authInstance.verifyIdToken as any).mockRejectedValueOnce({
      code: 'auth/id-token-expired',
      message: 'Firebase ID token has expired.',
    });

    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer expired-token');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/token has expired/i);
  });

  it('rejects request with 401 when token is revoked', async () => {
    (authInstance.verifyIdToken as any).mockRejectedValueOnce({
      code: 'auth/id-token-revoked',
      message: 'Firebase ID token has been revoked.',
    });

    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer revoked-token');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/token has been revoked/i);
  });

  it('rejects protected profile route /api/users/profile without authentication', async () => {
    const res = await request(app).put('/api/users/profile').send({ displayName: 'New Name' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

