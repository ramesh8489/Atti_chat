import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/database/prisma.js';

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    conversationParticipant: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    conversation: {
      update: vi.fn().mockResolvedValue({}),
    },
    message: {
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    mediaAttachment: {
      findUnique: vi.fn(),
      delete: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: vi.fn((arg) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg;
    }),
  },
}));

vi.mock('../src/redis/redisClient.js', () => ({
  getRedisClient: vi.fn().mockReturnValue(null),
}));

describe('Attachments & Secure Storage API', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const authUser = {
    id: 'usr-member',
    firebaseUid: 'member_uid',
    displayName: 'Member User',
    phoneNumber: '+919876543210',
  };

  const validToken = 'Bearer mock_token_member_uid';

  describe('POST /api/conversations/:id/attachments/presign', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post('/api/conversations/conv-1/attachments/presign')
        .send({
          fileName: 'photo.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1024,
        });

      expect(res.status).toBe(401);
    });

    it('rejects non-participants with 403 Forbidden', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(authUser);
      (prisma.conversationParticipant.findUnique as any).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/conversations/conv-private/attachments/presign')
        .set('Authorization', validToken)
        .send({
          fileName: 'photo.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1024,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');
    });

    it('rejects prohibited executable files with 400 Bad Request', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(authUser);
      (prisma.conversationParticipant.findUnique as any).mockResolvedValue({
        conversationId: 'conv-1',
        userId: 'usr-member',
      });

      const res = await request(app)
        .post('/api/conversations/conv-1/attachments/presign')
        .set('Authorization', validToken)
        .send({
          fileName: 'trojan.exe',
          mimeType: 'application/octet-stream',
          fileSize: 1024,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('prohibited');
    });

    it('issues presigned upload metadata for valid files to verified conversation members', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(authUser);
      (prisma.conversationParticipant.findUnique as any).mockResolvedValue({
        conversationId: 'conv-1',
        userId: 'usr-member',
      });

      const res = await request(app)
        .post('/api/conversations/conv-1/attachments/presign')
        .set('Authorization', validToken)
        .send({
          fileName: 'invoice.pdf',
          mimeType: 'application/pdf',
          fileSize: 50000,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.fileKey).toContain('conversations/conv-1/');
      expect(res.body.fileType).toBe('FILE');
      expect(res.body.uploadUrl).toBeDefined();
    });
  });

  describe('POST /api/conversations/:id/attachments/confirm', () => {
    it('creates message with media attachment and returns 201', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(authUser);
      (prisma.conversationParticipant.findUnique as any).mockResolvedValue({
        conversationId: 'conv-1',
        userId: 'usr-member',
      });

      const mockCreatedMsg = {
        id: 'msg-attachment-1',
        conversationId: 'conv-1',
        senderId: 'usr-member',
        content: 'Project Documentation',
        type: 'FILE',
        createdAt: new Date(),
        sender: { id: 'usr-member', displayName: 'Member User', avatarUrl: null, username: 'member' },
        attachments: [
          {
            id: 'att-1',
            fileKey: 'conversations/conv-1/abc-doc.pdf',
            fileName: 'doc.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
          },
        ],
        receipts: [],
      };

      (prisma.$transaction as any).mockResolvedValue([mockCreatedMsg, {}]);

      const res = await request(app)
        .post('/api/conversations/conv-1/attachments/confirm')
        .set('Authorization', validToken)
        .send({
          fileKey: 'conversations/conv-1/abc-doc.pdf',
          fileName: 'doc.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          fileType: 'FILE',
          textContent: 'Project Documentation',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message.attachments).toHaveLength(1);
    });
  });

  describe('GET /api/attachments/:id/download-url (IDOR Prevention)', () => {
    it('rejects access if user is not a participant of the owning conversation', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(authUser);

      // Attachment belongs to a conversation where usr-member is NOT a participant
      (prisma.mediaAttachment.findUnique as any).mockResolvedValue({
        id: 'att-secret-1',
        fileKey: 'conversations/conv-secret/secret.pdf',
        fileName: 'secret.pdf',
        fileSize: 5000,
        mimeType: 'application/pdf',
        message: {
          conversation: {
            participants: [
              { userId: 'usr-other-1', role: 'OWNER' },
              { userId: 'usr-other-2', role: 'MEMBER' },
            ],
          },
        },
      });

      const res = await request(app)
        .get('/api/attachments/att-secret-1/download-url')
        .set('Authorization', validToken);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');
    });

    it('issues download URL to verified conversation participant', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(authUser);

      (prisma.mediaAttachment.findUnique as any).mockResolvedValue({
        id: 'att-allowed-1',
        fileKey: 'conversations/conv-1/shared.jpg',
        fileName: 'shared.jpg',
        fileSize: 20000,
        mimeType: 'image/jpeg',
        message: {
          conversation: {
            participants: [
              { userId: 'usr-member', role: 'MEMBER' },
              { userId: 'usr-other-1', role: 'OWNER' },
            ],
          },
        },
      });

      const res = await request(app)
        .get('/api/attachments/att-allowed-1/download-url')
        .set('Authorization', validToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.downloadUrl).toBeDefined();
    });
  });

  describe('DELETE /api/attachments/:id', () => {
    it('forbids stranger from deleting an attachment', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(authUser);

      (prisma.mediaAttachment.findUnique as any).mockResolvedValue({
        id: 'att-1',
        uploaderId: 'usr-someone-else',
        fileKey: 'conversations/conv-1/doc.pdf',
        messageId: 'msg-1',
        message: {
          senderId: 'usr-someone-else',
          conversation: {
            participants: [
              { userId: 'usr-member', role: 'MEMBER' },
              { userId: 'usr-someone-else', role: 'OWNER' },
            ],
          },
        },
      });

      const res = await request(app)
        .delete('/api/attachments/att-1')
        .set('Authorization', validToken);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Permission denied');
    });

    it('allows uploader to delete their own attachment', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(authUser);

      (prisma.mediaAttachment.findUnique as any).mockResolvedValue({
        id: 'att-1',
        uploaderId: 'usr-member',
        fileKey: 'conversations/conv-1/my-photo.jpg',
        messageId: 'msg-1',
        message: {
          senderId: 'usr-member',
          conversation: {
            participants: [
              { userId: 'usr-member', role: 'MEMBER' },
            ],
          },
        },
      });

      (prisma.$transaction as any).mockResolvedValue([{}, {}]);

      const res = await request(app)
        .delete('/api/attachments/att-1')
        .set('Authorization', validToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
