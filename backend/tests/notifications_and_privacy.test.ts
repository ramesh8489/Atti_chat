import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/database/prisma.js';
import {
  isBlocked,
  hasBlocked,
  blockUser,
  unblockUser,
  listBlockedUsers,
} from '../src/services/blockService.js';
import {
  muteConversation,
  unmuteConversation,
  isConversationMuted,
  getMutedConversationIds,
} from '../src/services/conversationMuteService.js';
import {
  getPrivacySettings,
  updatePrivacySettings,
  canViewOnlineStatus,
  canViewLastSeen,
  shouldSendReadReceipt,
  shouldSendTypingIndicator,
} from '../src/services/privacyService.js';
import {
  createAndSendNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  listNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../src/services/notificationService.js';
import {
  savePushSubscription,
  deletePushSubscription,
  getVapidPublicKey,
} from '../src/services/pushNotificationService.js';
import { NotificationType, PrivacyVisibility } from '@prisma/client';

// Mock dependencies
vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    conversation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    conversationParticipant: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    notificationPreference: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    privacySetting: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    blockedUser: {
      count: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    pushSubscription: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((arg) => (Array.isArray(arg) ? Promise.all(arg) : arg)),
  },
}));

vi.mock('../src/middleware/firebaseAuth.js', () => ({
  verifyAuthToken: vi.fn().mockImplementation((token: string) => {
    if (token === 'valid-alice-token') {
      return Promise.resolve({ uid: 'alice_uid', phone_number: '+919999900001' });
    }
    if (token === 'valid-bob-token') {
      return Promise.resolve({ uid: 'bob_uid', phone_number: '+919999900002' });
    }
    throw new Error('Invalid token');
  }),
  requireAuth: (req: any, _res: any, next: any) => {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer valid-alice-token')) {
      req.user = { uid: 'alice_uid', phone_number: '+919999900001' };
      return next();
    }
    if (auth && auth.startsWith('Bearer valid-bob-token')) {
      req.user = { uid: 'bob_uid', phone_number: '+919999900002' };
      return next();
    }
    return _res.status(401).json({ success: false, message: 'Authentication required' });
  },
}));

vi.mock('../src/services/userService.js', () => ({
  findUserByFirebaseUid: vi.fn().mockImplementation((uid: string) => {
    if (uid === 'alice_uid') {
      return Promise.resolve({
        id: 'usr-alice',
        firebaseUid: 'alice_uid',
        displayName: 'Alice Smith',
        username: 'alice',
      });
    }
    if (uid === 'bob_uid') {
      return Promise.resolve({
        id: 'usr-bob',
        firebaseUid: 'bob_uid',
        displayName: 'Bob Jones',
        username: 'bob',
      });
    }
    return Promise.resolve(null);
  }),
}));

vi.mock('../src/socket/socketServer.js', () => ({
  getIo: vi.fn().mockReturnValue({
    to: vi.fn().mockReturnValue({
      emit: vi.fn(),
    }),
    emit: vi.fn(),
    fetchSockets: vi.fn().mockResolvedValue([]),
  }),
}));

describe('Notifications & Privacy Controls (Phase 7)', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Block & Unblock System', () => {
    it('blocks a user successfully and prevents blocking self', async () => {
      // Blocking self throws BAD_REQUEST
      await expect(blockUser('usr-alice', 'usr-alice')).rejects.toThrow(/Cannot block yourself/);

      // Target user exists
      (prisma.user.findUnique as any).mockResolvedValue({ id: 'usr-bob', displayName: 'Bob' });
      (prisma.blockedUser.upsert as any).mockResolvedValue({
        id: 'blk-1',
        blockerId: 'usr-alice',
        blockedId: 'usr-bob',
      });

      const res = await blockUser('usr-alice', 'usr-bob');
      expect(res.success).toBe(true);
      expect(res.blockedUser.blockedId).toBe('usr-bob');
    });

    it('unblocks a user safely', async () => {
      (prisma.blockedUser.findUnique as any).mockResolvedValue({
        id: 'blk-1',
        blockerId: 'usr-alice',
        blockedId: 'usr-bob',
      });
      (prisma.blockedUser.delete as any).mockResolvedValue({});

      const res = await unblockUser('usr-alice', 'usr-bob');
      expect(res.success).toBe(true);
    });

    it('detects bidirectional blocking correctly via isBlocked', async () => {
      (prisma.blockedUser.count as any).mockResolvedValueOnce(1);
      const blocked1 = await isBlocked('usr-alice', 'usr-bob');
      expect(blocked1).toBe(true);

      (prisma.blockedUser.count as any).mockResolvedValueOnce(0);
      const blocked2 = await isBlocked('usr-alice', 'usr-charlie');
      expect(blocked2).toBe(false);
    });

    it('REST: POST /api/privacy/blocks/:userId and GET /api/privacy/blocks', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ id: 'usr-bob', displayName: 'Bob' });
      (prisma.blockedUser.upsert as any).mockResolvedValue({
        id: 'blk-1',
        blockerId: 'usr-alice',
        blockedId: 'usr-bob',
      });

      const blockRes = await request(app)
        .post('/api/privacy/blocks/usr-bob')
        .set('Authorization', 'Bearer valid-alice-token');

      expect(blockRes.status).toBe(200);
      expect(blockRes.body.success).toBe(true);

      (prisma.blockedUser.findMany as any).mockResolvedValue([
        {
          id: 'blk-1',
          blockedId: 'usr-bob',
          createdAt: new Date('2026-11-06T10:00:00Z'),
          blocked: { id: 'usr-bob', displayName: 'Bob' },
        },
      ]);

      const listRes = await request(app)
        .get('/api/privacy/blocks')
        .set('Authorization', 'Bearer valid-alice-token');

      expect(listRes.status).toBe(200);
      expect(listRes.body.blockedUsers).toHaveLength(1);
      expect(listRes.body.blockedUsers[0].blockedId).toBe('usr-bob');
    });
  });

  describe('2. Chat Mute Controls', () => {
    it('mutes conversation for 8 hours, 1 week, or permanently', async () => {
      (prisma.conversationParticipant.findUnique as any).mockResolvedValue({
        conversationId: 'conv-100',
        userId: 'usr-alice',
      });

      const eightHoursAhead = new Date(Date.now() + 8 * 3600 * 1000);
      (prisma.conversationParticipant.update as any).mockResolvedValue({
        mutedUntil: eightHoursAhead,
      });

      const res = await muteConversation({
        conversationId: 'conv-100',
        userId: 'usr-alice',
        durationHours: 8,
      });

      expect(res.success).toBe(true);
      expect(res.mutedUntil).toBeDefined();
    });

    it('unmutes a conversation', async () => {
      (prisma.conversationParticipant.findUnique as any).mockResolvedValue({
        conversationId: 'conv-100',
        userId: 'usr-alice',
      });
      (prisma.conversationParticipant.update as any).mockResolvedValue({
        mutedUntil: null,
      });

      const res = await unmuteConversation('usr-alice', 'conv-100');
      expect(res.success).toBe(true);
    });

    it('checks if conversation is muted via isConversationMuted', async () => {
      // Future mutedUntil -> true
      (prisma.conversationParticipant.findUnique as any).mockResolvedValueOnce({
        mutedUntil: new Date(Date.now() + 60000),
      });
      const muted = await isConversationMuted('usr-alice', 'conv-100');
      expect(muted).toBe(true);

      // Expired mutedUntil -> false
      (prisma.conversationParticipant.findUnique as any).mockResolvedValueOnce({
        mutedUntil: new Date(Date.now() - 60000),
      });
      const unmuted = await isConversationMuted('usr-alice', 'conv-100');
      expect(unmuted).toBe(false);
    });

    it('REST: POST /api/conversations/:id/mute and DELETE /api/conversations/:id/mute', async () => {
      (prisma.conversationParticipant.findUnique as any).mockResolvedValue({
        conversationId: 'conv-100',
        userId: 'usr-alice',
      });
      (prisma.conversationParticipant.update as any).mockResolvedValue({
        mutedUntil: new Date('2026-11-07T00:00:00Z'),
      });

      const muteRes = await request(app)
        .post('/api/conversations/conv-100/mute')
        .set('Authorization', 'Bearer valid-alice-token')
        .send({ durationHours: 8 });

      expect(muteRes.status).toBe(200);
      expect(muteRes.body.success).toBe(true);

      const unmuteRes = await request(app)
        .delete('/api/conversations/conv-100/mute')
        .set('Authorization', 'Bearer valid-alice-token');

      expect(unmuteRes.status).toBe(200);
      expect(unmuteRes.body.success).toBe(true);
    });
  });

  describe('3. Privacy Settings & Visibility Rules', () => {
    it('retrieves and updates user privacy settings', async () => {
      (prisma.privacySetting.findUnique as any).mockResolvedValue({
        userId: 'usr-alice',
        lastSeenVisibility: PrivacyVisibility.EVERYONE,
        onlineStatusVisibility: PrivacyVisibility.EVERYONE,
        profilePhotoVisibility: PrivacyVisibility.EVERYONE,
        aboutVisibility: PrivacyVisibility.EVERYONE,
        readReceipts: true,
        typingIndicator: true,
      });

      const settings = await getPrivacySettings('usr-alice');
      expect(settings.readReceipts).toBe(true);
      expect(settings.lastSeenVisibility).toBe(PrivacyVisibility.EVERYONE);

      (prisma.privacySetting.upsert as any).mockResolvedValue({
        userId: 'usr-alice',
        readReceipts: false,
        typingIndicator: false,
        onlineStatusVisibility: PrivacyVisibility.NOBODY,
      });

      const updated = await updatePrivacySettings('usr-alice', {
        readReceipts: false,
        typingIndicator: false,
        onlineStatusVisibility: PrivacyVisibility.NOBODY,
      });

      expect(updated.readReceipts).toBe(false);
      expect(updated.typingIndicator).toBe(false);
    });

    it('enforces onlineStatus and lastSeen visibility (EVERYONE / NOBODY / BLOCKED)', async () => {
      // 1. Viewer blocked -> false
      (prisma.blockedUser.count as any).mockResolvedValueOnce(1);
      (prisma.privacySetting.findUnique as any).mockResolvedValue({
        onlineStatusVisibility: PrivacyVisibility.EVERYONE,
      });
      const blockedCanSee = await canViewOnlineStatus('usr-blocked', 'usr-alice');
      expect(blockedCanSee).toBe(false);

      // 2. NOBODY setting -> false
      (prisma.blockedUser.count as any).mockResolvedValueOnce(0);
      (prisma.privacySetting.findUnique as any).mockResolvedValue({
        onlineStatusVisibility: PrivacyVisibility.NOBODY,
      });
      const nobodyCanSee = await canViewOnlineStatus('usr-bob', 'usr-alice');
      expect(nobodyCanSee).toBe(false);

      // 3. EVERYONE setting -> true
      (prisma.blockedUser.count as any).mockResolvedValueOnce(0);
      (prisma.privacySetting.findUnique as any).mockResolvedValue({
        onlineStatusVisibility: PrivacyVisibility.EVERYONE,
      });
      const everyoneCanSee = await canViewOnlineStatus('usr-bob', 'usr-alice');
      expect(everyoneCanSee).toBe(true);
    });

    it('REST: GET and PUT /api/privacy', async () => {
      (prisma.privacySetting.findUnique as any).mockResolvedValue({
        userId: 'usr-alice',
        lastSeenVisibility: PrivacyVisibility.EVERYONE,
        onlineStatusVisibility: PrivacyVisibility.EVERYONE,
        profilePhotoVisibility: PrivacyVisibility.EVERYONE,
        aboutVisibility: PrivacyVisibility.EVERYONE,
        readReceipts: true,
        typingIndicator: true,
      });

      const getRes = await request(app)
        .get('/api/privacy')
        .set('Authorization', 'Bearer valid-alice-token');

      expect(getRes.status).toBe(200);
      expect(getRes.body.privacySettings.readReceipts).toBe(true);

      (prisma.privacySetting.upsert as any).mockResolvedValue({
        userId: 'usr-alice',
        readReceipts: false,
      });

      const putRes = await request(app)
        .put('/api/privacy')
        .set('Authorization', 'Bearer valid-alice-token')
        .send({ readReceipts: false });

      expect(putRes.status).toBe(200);
      expect(putRes.body.privacySettings.readReceipts).toBe(false);
    });
  });

  describe('4. Notification Center & Preferences', () => {
    it('creates notification and honors muted conversations / preferences', async () => {
      (prisma.blockedUser.count as any).mockResolvedValue(0);
      (prisma.notificationPreference.findUnique as any).mockResolvedValue({
        userId: 'usr-bob',
        directMessages: true,
        pushEnabled: true,
        soundEnabled: true,
      });
      // Conversation not muted
      (prisma.conversationParticipant.findUnique as any).mockResolvedValue({
        mutedUntil: null,
      });

      (prisma.notification.create as any).mockResolvedValue({
        id: 'notif-1',
        userId: 'usr-bob',
        actorId: 'usr-alice',
        conversationId: 'conv-1',
        type: NotificationType.DIRECT_MESSAGE,
        title: 'Alice Smith',
        body: 'Hello Bob!',
        isRead: false,
        createdAt: new Date('2026-11-06T11:00:00Z'),
        actor: { displayName: 'Alice Smith' },
        conversation: { title: 'Direct Chat' },
      });

      const notif = await createAndSendNotification({
        userId: 'usr-bob',
        actorId: 'usr-alice',
        conversationId: 'conv-1',
        type: NotificationType.DIRECT_MESSAGE,
        title: 'Alice Smith',
        body: 'Hello Bob!',
      });

      expect(notif).toBeDefined();
      expect(notif?.id).toBe('notif-1');
      expect(notif?.title).toBe('Alice Smith');
    });

    it('suppresses notification if directMessages preference is disabled', async () => {
      (prisma.blockedUser.count as any).mockResolvedValue(0);
      (prisma.notificationPreference.findUnique as any).mockResolvedValue({
        userId: 'usr-bob',
        directMessages: false,
      });

      const notif = await createAndSendNotification({
        userId: 'usr-bob',
        actorId: 'usr-alice',
        conversationId: 'conv-1',
        type: NotificationType.DIRECT_MESSAGE,
        title: 'Alice Smith',
        body: 'Hello Bob!',
      });

      expect(notif).toBeNull();
    });

    it('REST: GET, PATCH, and POST /api/notifications operations', async () => {
      (prisma.notification.findMany as any).mockResolvedValue([
        {
          id: 'notif-1',
          userId: 'usr-alice',
          actorId: 'usr-bob',
          conversationId: 'conv-1',
          type: NotificationType.DIRECT_MESSAGE,
          title: 'Bob Jones',
          body: 'Hey Alice',
          isRead: false,
          createdAt: new Date('2026-11-06T12:00:00Z'),
          actor: { displayName: 'Bob Jones' },
          conversation: { title: 'Direct' },
        },
      ]);
      (prisma.notification.count as any)
        .mockResolvedValueOnce(1) // total
        .mockResolvedValueOnce(1); // unreadCount

      const listRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', 'Bearer valid-alice-token');

      expect(listRes.status).toBe(200);
      expect(listRes.body.notifications).toHaveLength(1);
      expect(listRes.body.unreadCount).toBe(1);

      // Mark single notification read
      (prisma.notification.findUnique as any).mockResolvedValue({
        id: 'notif-1',
        userId: 'usr-alice',
      });
      (prisma.notification.update as any).mockResolvedValue({
        id: 'notif-1',
        isRead: true,
      });
      (prisma.notification.count as any).mockResolvedValue(0);

      const readRes = await request(app)
        .patch('/api/notifications/notif-1/read')
        .set('Authorization', 'Bearer valid-alice-token');

      expect(readRes.status).toBe(200);
      expect(readRes.body.success).toBe(true);

      // Mark all read
      (prisma.notification.updateMany as any).mockResolvedValue({ count: 5 });
      const readAllRes = await request(app)
        .post('/api/notifications/read-all')
        .set('Authorization', 'Bearer valid-alice-token');

      expect(readAllRes.status).toBe(200);
      expect(readAllRes.body.success).toBe(true);
    });

    it('REST: GET and PUT /api/notifications/preferences', async () => {
      (prisma.notificationPreference.findUnique as any).mockResolvedValue({
        userId: 'usr-alice',
        directMessages: true,
        groupMessages: true,
        callIncoming: true,
        callMissed: true,
        pushEnabled: true,
        soundEnabled: true,
        showPreview: true,
      });

      const getPrefRes = await request(app)
        .get('/api/notifications/preferences')
        .set('Authorization', 'Bearer valid-alice-token');

      expect(getPrefRes.status).toBe(200);
      expect(getPrefRes.body.preferences.showPreview).toBe(true);

      (prisma.notificationPreference.upsert as any).mockResolvedValue({
        userId: 'usr-alice',
        showPreview: false,
        soundEnabled: false,
      });

      const putPrefRes = await request(app)
        .put('/api/notifications/preferences')
        .set('Authorization', 'Bearer valid-alice-token')
        .send({ showPreview: false, soundEnabled: false });

      expect(putPrefRes.status).toBe(200);
      expect(putPrefRes.body.preferences.showPreview).toBe(false);
    });
  });

  describe('5. Browser Push Subscription APIs', () => {
    it('returns public VAPID key without requiring authentication', async () => {
      const res = await request(app).get('/api/notifications/push/vapid-key');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('vapidPublicKey');
    });

    it('subscribes and unsubscribes web push endpoint', async () => {
      (prisma.pushSubscription.upsert as any).mockResolvedValue({
        id: 'sub-1',
        userId: 'usr-alice',
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
      });

      const subRes = await request(app)
        .post('/api/notifications/push/subscribe')
        .set('Authorization', 'Bearer valid-alice-token')
        .send({
          subscription: {
            endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
            keys: {
              p256dh: 'mock-p256dh-key',
              auth: 'mock-auth-secret',
            },
          },
          userAgent: 'Mozilla/5.0 Chrome/120.0',
        });

      expect(subRes.status).toBe(201);
      expect(subRes.body.success).toBe(true);

      (prisma.pushSubscription.findUnique as any).mockResolvedValue({
        id: 'sub-1',
        userId: 'usr-alice',
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
      });
      (prisma.pushSubscription.delete as any).mockResolvedValue({});

      const unsubRes = await request(app)
        .post('/api/notifications/push/unsubscribe')
        .set('Authorization', 'Bearer valid-alice-token')
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
        });

      expect(unsubRes.status).toBe(200);
      expect(unsubRes.body.success).toBe(true);
    });
  });
});
