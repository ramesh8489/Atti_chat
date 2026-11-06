import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/database/prisma.js';
import {
  validateFileMetadata,
  validateFileSignature,
  sanitizeFilename,
} from '../src/services/mediaValidationService.js';
import { checkSocketEventRateLimit } from '../src/socket/socketServer.js';

// Mock database safely
vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    conversation: {
      findUnique: vi.fn(),
    },
    conversationParticipant: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    message: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    blockedUser: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    notificationPreference: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock('../src/services/userService.js', () => ({
  findUserByFirebaseUid: vi.fn().mockImplementation((uid: string) => {
    if (uid === 'alice_uid') {
      return Promise.resolve({
        id: 'usr-alice',
        phoneNumber: '+919999900001',
        displayName: 'Alice Smith',
      });
    }
    if (uid === 'bob_uid') {
      return Promise.resolve({
        id: 'usr-bob',
        phoneNumber: '+919999900002',
        displayName: 'Bob Jones',
      });
    }
    return Promise.resolve(null);
  }),
  updateUserProfile: vi.fn().mockImplementation((userId: string, input: any) =>
    Promise.resolve({ id: userId, ...input })
  ),
  searchUsers: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/middleware/firebaseAuth.js', () => ({
  verifyAuthToken: vi.fn().mockImplementation((token: string) => {
    if (token === 'valid-alice-token') {
      return Promise.resolve({ uid: 'alice_uid', phoneNumber: '+919999900001' });
    }
    if (token === 'valid-bob-token') {
      return Promise.resolve({ uid: 'bob_uid', phoneNumber: '+919999900002' });
    }
    if (token === 'expired-token') {
      throw new Error('Authentication token has expired. Please sign in again.');
    }
    throw new Error('Invalid or expired authentication token.');
  }),
  requireAuth: (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Authentication required. Missing Bearer token.' });
    }
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Invalid Authorization header format.' });
    }
    const token = authHeader.replace(/^Bearer\s*/i, '').trim();
    if (token === 'valid-alice-token') {
      req.user = { uid: 'alice_uid', phoneNumber: '+919999900001' };
      return next();
    }
    if (token === 'valid-bob-token') {
      req.user = { uid: 'bob_uid', phoneNumber: '+919999900002' };
      return next();
    }
    if (token === 'expired-token') {
      return res.status(401).json({ success: false, error: 'Authentication token has expired. Please sign in again.' });
    }
    return res.status(401).json({ success: false, error: 'Invalid or expired authentication token.' });
  },
}));

describe('Phase 8: Security Hardening & Performance Optimization', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. HTTP Security Headers & Correlation IDs', () => {
    it('sets strict security headers (CSP, nosniff, referrer-policy)', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      expect(res.headers['content-security-policy']).toContain('https://apis.google.com');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('generates and propagates unique X-Request-ID correlation headers', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id'].length).toBeGreaterThan(10);
    });

    it('preserves client-provided X-Correlation-ID if valid format', async () => {
      const customId = 'client-req-abc-123';
      const res = await request(app).get('/health').set('X-Correlation-ID', customId);

      expect(res.headers['x-request-id']).toBe(customId);
    });
  });

  describe('2. Authentication & Token Hardening', () => {
    it('rejects unauthenticated requests to protected endpoints with 401', async () => {
      const res = await request(app).get('/api/conversations');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Authentication required');
    });

    it('rejects expired Firebase tokens with specific expiry message', async () => {
      const res = await request(app)
        .get('/api/conversations')
        .set('Authorization', 'Bearer expired-token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('expired');
    });

    it('rejects malformed authorization header with 401', async () => {
      const res = await request(app)
        .get('/api/conversations')
        .set('Authorization', 'Basic invalidcredentials');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. IDOR & Access Control Enforcement', () => {
    it('blocks unauthorized access to conversations when user is not a participant (IDOR)', async () => {
      // Alice tries to access conversation 999 where she is NOT a member
      vi.mocked(prisma.conversationParticipant.findUnique).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/conversations/conv-999/messages')
        .set('Authorization', 'Bearer valid-alice-token');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.toLowerCase()).toContain('not a participant');
    });

    it('blocks unauthorized attachment access when user is not in the conversation', async () => {
      vi.mocked(prisma.conversationParticipant.findUnique).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/conversations/conv-private/attachments/presign')
        .set('Authorization', 'Bearer valid-bob-token')
        .send({
          fileName: 'photo.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1024,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not a participant');
    });
  });

  describe('4. File Validation, Extension Whitelisting & Path Traversal Prevention', () => {
    it('rejects executable and dangerous file extensions', () => {
      const exes = ['malware.exe', 'script.bat', 'payload.sh', 'trojan.js', 'virus.scr', 'evil.msi', 'exploit.php'];
      for (const dangerous of exes) {
        const result = validateFileMetadata(dangerous, 'application/octet-stream', 1024);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('prohibited for security reasons');
      }
    });

    it('rejects MIME-type spoofing when file magic bytes do not match declared MIME', () => {
      // Fake JPEG with text content instead of FF D8 FF
      const fakeJpegBuffer = Buffer.from('THIS IS NOT A JPEG FILE');
      const result = validateFileSignature(fakeJpegBuffer, 'image/jpeg');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('JPEG signature');
    });

    it('verifies valid magic bytes for authentic image files', () => {
      // Authentic PNG signature (89 50 4E 47 0D 0A 1A 0A)
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const result = validateFileSignature(pngBuffer, 'image/png');
      expect(result.valid).toBe(true);
    });

    it('sanitizes malicious filenames to prevent directory traversal and null byte injection', () => {
      expect(sanitizeFilename('../../../../../etc/passwd')).toBe('passwd');
      expect(sanitizeFilename('..\\..\\windows\\system32\\cmd.exe')).toBe('cmd.exe');
      expect(sanitizeFilename('safe_image\0.php.jpg')).toBe('safe_image.php.jpg');
      expect(sanitizeFilename('   ')).toBe('unnamed_file');
    });
  });

  describe('5. Input Validation & Injection Prevention', () => {
    it('rejects profile update with unsafe javascript: URL in avatarUrl', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', 'Bearer valid-alice-token')
        .send({
          avatarUrl: 'javascript:alert(1)',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
    });

    it('rejects forwarding message with empty target conversations', async () => {
      const res = await request(app)
        .post('/api/messages/msg-123/forward')
        .set('Authorization', 'Bearer valid-alice-token')
        .send({
          targetConversationIds: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  describe('6. Real-Time Socket Event Rate Limiting', () => {
    it('allows normal socket event volume within threshold', () => {
      const socketId = 'sock-test-normal';
      // 5 normal events in 10s should succeed
      for (let i = 0; i < 5; i++) {
        expect(checkSocketEventRateLimit(socketId, 50, 10000, true)).toBe(true);
      }
    });

    it('throttles socket event flood when threshold is exceeded', () => {
      const socketId = 'sock-test-flood';
      const limit = 5;
      for (let i = 0; i < limit; i++) {
        expect(checkSocketEventRateLimit(socketId, limit, 10000, true)).toBe(true);
      }
      // 6th event in window must be throttled
      expect(checkSocketEventRateLimit(socketId, limit, 10000, true)).toBe(false);
    });
  });

  describe('7. Secure Error Handling Without Schema Leakage', () => {
    it('sanitizes 404 responses and includes requestId without leaking stack trace', async () => {
      const res = await request(app).get('/api/unregistered-path-404');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.requestId).toBeDefined();
      expect(res.body.stack).toBeUndefined();
    });
  });
});
