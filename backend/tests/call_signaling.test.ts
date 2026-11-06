import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'http';
import request from 'supertest';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { initSocketServer } from '../src/socket/socketServer.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/database/prisma.js';
import { SOCKET_EVENTS } from '../src/constants/index.js';
import { getIceServers } from '../src/services/webrtcService.js';
import { checkCallRateLimit, isUserInActiveCall, endCallSession } from '../src/services/callService.js';

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    conversationParticipant: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    conversation: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    message: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    messageReceipt: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    callSession: {
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    callParticipant: {
      create: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
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

describe('WebRTC Call Signaling & Infrastructure (Phase 5)', () => {
  let httpServer: http.Server;
  let app: any;
  let serverPort: number;

  beforeAll(async () => {
    app = createApp();
    httpServer = http.createServer(app);
    initSocketServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ICE Server Configuration & REST Endpoint', () => {
    it('returns STUN servers list correctly', () => {
      const servers = getIceServers('usr-test');
      expect(servers).toBeDefined();
      expect(servers.length).toBeGreaterThan(0);
      expect(servers[0].urls).toBeDefined();
    });

    it('rejects unauthenticated request to /api/webrtc/ice-servers with 401', async () => {
      const res = await request(app).get('/api/webrtc/ice-servers');
      expect(res.status).toBe(401);
    });

    it('returns ICE servers to authenticated user via /api/webrtc/ice-servers', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        id: 'usr-alice',
        firebaseUid: 'alice_uid',
      });

      const res = await request(app)
        .get('/api/webrtc/ice-servers')
        .set('Authorization', 'Bearer mock_token_alice_uid');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.iceServers)).toBe(true);
    });

    it('returns call history for user via /api/calls/history', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        id: 'usr-alice',
        firebaseUid: 'alice_uid',
      });
      (prisma.callSession.findMany as any).mockResolvedValue([
        {
          id: 'call-101',
          conversationId: 'conv-1',
          type: 'VIDEO',
          status: 'ENDED',
          durationSec: 42,
        },
      ]);

      const res = await request(app)
        .get('/api/calls/history')
        .set('Authorization', 'Bearer mock_token_alice_uid');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.history).toHaveLength(1);
      expect(res.body.history[0].id).toBe('call-101');
    });
  });

  describe('Socket.IO Call Signaling Engine', () => {
    let clientAlice: ClientSocket;
    let clientBob: ClientSocket;

    beforeEach(async () => {
      (prisma.user.findUnique as any).mockImplementation(({ where }: any) => {
        if (where.firebaseUid === 'alice_uid' || where.id === 'usr-alice') {
          return Promise.resolve({
            id: 'usr-alice',
            firebaseUid: 'alice_uid',
            displayName: 'Alice',
            phoneNumber: '+919876543210',
          });
        }
        if (where.firebaseUid === 'bob_uid' || where.id === 'usr-bob') {
          return Promise.resolve({
            id: 'usr-bob',
            firebaseUid: 'bob_uid',
            displayName: 'Bob',
            phoneNumber: '+919876543211',
          });
        }
        return Promise.resolve(null);
      });

      // Connect Alice
      clientAlice = Client(`http://localhost:${serverPort}`, {
        auth: { token: 'mock_token_alice_uid' },
        transports: ['websocket'],
        reconnection: false,
      });

      // Connect Bob
      clientBob = Client(`http://localhost:${serverPort}`, {
        auth: { token: 'mock_token_bob_uid' },
        transports: ['websocket'],
        reconnection: false,
      });

      await Promise.all([
        new Promise<void>((resolve) => clientAlice.on('connect', () => resolve())),
        new Promise<void>((resolve) => clientBob.on('connect', () => resolve())),
      ]);
    });

    afterEach(() => {
      if (clientAlice?.connected) clientAlice.close();
      if (clientBob?.connected) clientBob.close();
    });

    it('rejects call initiation if caller is not in conversation', async () => {
      (prisma.conversationParticipant.findMany as any).mockResolvedValue([
        { userId: 'usr-bob' }, // Alice is missing
      ]);

      const res = await new Promise<any>((resolve) => {
        clientAlice.emit(
          SOCKET_EVENTS.CALL_INITIATE,
          { conversationId: 'conv-unauthorized', receiverId: 'usr-bob', type: 'AUDIO' },
          (ack: any) => resolve(ack)
        );
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Caller is not a participant/);
    });

    it('successfully initiates call, alerts receiver with call:incoming, and handles ringing', async () => {
      (prisma.conversationParticipant.findMany as any).mockResolvedValue([
        { userId: 'usr-alice' },
        { userId: 'usr-bob' },
      ]);
      (prisma.callSession.create as any).mockResolvedValue({
        id: 'call-active-1',
        conversationId: 'conv-direct-1',
        initiatorId: 'usr-alice',
        type: 'VIDEO',
        status: 'INITIATED',
      });

      // Listen for call:incoming on Bob
      const incomingPromise = new Promise<any>((resolve) => {
        clientBob.on(SOCKET_EVENTS.CALL_INCOMING, (payload) => resolve(payload));
      });

      // Alice initiates call
      const initAck = await new Promise<any>((resolve) => {
        clientAlice.emit(
          SOCKET_EVENTS.CALL_INITIATE,
          { conversationId: 'conv-direct-1', receiverId: 'usr-bob', type: 'VIDEO' },
          (ack: any) => resolve(ack)
        );
      });

      expect(initAck.success).toBe(true);
      expect(initAck.callId).toBe('call-active-1');

      const incoming = await incomingPromise;
      expect(incoming.callId).toBe('call-active-1');
      expect(incoming.callerId).toBe('usr-alice');
      expect(incoming.type).toBe('VIDEO');

      // Bob sends call:ringing acknowledgment
      const ringingPromise = new Promise<any>((resolve) => {
        clientAlice.on(SOCKET_EVENTS.CALL_RINGING, (payload) => resolve(payload));
      });

      clientBob.emit(SOCKET_EVENTS.CALL_RINGING, { callId: 'call-active-1' });
      const ringingData = await ringingPromise;
      expect(ringingData.callId).toBe('call-active-1');
    });

    it('completes offer, answer, and ice-candidate exchange after call acceptance', async () => {
      (prisma.conversationParticipant.findMany as any).mockResolvedValue([
        { userId: 'usr-alice' },
        { userId: 'usr-bob' },
      ]);
      (prisma.callSession.create as any).mockResolvedValue({
        id: 'call-webrtc-stream',
        conversationId: 'conv-direct-1',
        initiatorId: 'usr-alice',
        type: 'AUDIO',
        status: 'INITIATED',
      });

      // 1. Alice initiates
      await new Promise<any>((resolve) => {
        clientAlice.emit(
          SOCKET_EVENTS.CALL_INITIATE,
          { conversationId: 'conv-direct-1', receiverId: 'usr-bob', type: 'AUDIO' },
          resolve
        );
      });

      // 2. Bob accepts call
      const acceptPromise = new Promise<any>((resolve) => {
        clientAlice.on(SOCKET_EVENTS.CALL_ACCEPT, (data) => resolve(data));
      });

      const bobAck = await new Promise<any>((resolve) => {
        clientBob.emit(SOCKET_EVENTS.CALL_ACCEPT, { callId: 'call-webrtc-stream' }, resolve);
      });
      expect(bobAck.success).toBe(true);

      const acceptData = await acceptPromise;
      expect(acceptData.callId).toBe('call-webrtc-stream');

      // 3. Alice sends SDP Offer -> Bob receives
      const offerPromise = new Promise<any>((resolve) => {
        clientBob.on(SOCKET_EVENTS.CALL_OFFER, (data) => resolve(data));
      });
      clientAlice.emit(SOCKET_EVENTS.CALL_OFFER, {
        callId: 'call-webrtc-stream',
        sdp: { type: 'offer', sdp: 'v=0\r\no=alice...' },
      });
      const receivedOffer = await offerPromise;
      expect(receivedOffer.sdp.type).toBe('offer');

      // 4. Bob sends SDP Answer -> Alice receives
      const answerPromise = new Promise<any>((resolve) => {
        clientAlice.on(SOCKET_EVENTS.CALL_ANSWER, (data) => resolve(data));
      });
      clientBob.emit(SOCKET_EVENTS.CALL_ANSWER, {
        callId: 'call-webrtc-stream',
        sdp: { type: 'answer', sdp: 'v=0\r\no=bob...' },
      });
      const receivedAnswer = await answerPromise;
      expect(receivedAnswer.sdp.type).toBe('answer');

      // 5. ICE Candidate relay from Alice -> Bob
      const candidatePromise = new Promise<any>((resolve) => {
        clientBob.on(SOCKET_EVENTS.CALL_ICE_CANDIDATE, (data) => resolve(data));
      });
      clientAlice.emit(SOCKET_EVENTS.CALL_ICE_CANDIDATE, {
        callId: 'call-webrtc-stream',
        candidate: { candidate: 'candidate:1 1 UDP ...', sdpMid: '0', sdpMLineIndex: 0 },
      });
      const receivedCandidate = await candidatePromise;
      expect(receivedCandidate.candidate.candidate).toContain('UDP');

      // 6. Alice hangs up call -> Bob receives call:end
      const endPromise = new Promise<any>((resolve) => {
        clientBob.on(SOCKET_EVENTS.CALL_END, (data) => resolve(data));
      });
      clientAlice.emit(SOCKET_EVENTS.CALL_END, { callId: 'call-webrtc-stream', reason: 'USER_HANGUP' });
      const endData = await endPromise;
      expect(endData.callId).toBe('call-webrtc-stream');
    });

    it('handles call rejection by receiver', async () => {
      (prisma.conversationParticipant.findMany as any).mockResolvedValue([
        { userId: 'usr-alice' },
        { userId: 'usr-bob' },
      ]);
      (prisma.callSession.create as any).mockResolvedValue({
        id: 'call-reject-test',
        conversationId: 'conv-direct-1',
        initiatorId: 'usr-alice',
        type: 'AUDIO',
        status: 'INITIATED',
      });

      await new Promise<any>((resolve) => {
        clientAlice.emit(
          SOCKET_EVENTS.CALL_INITIATE,
          { conversationId: 'conv-direct-1', receiverId: 'usr-bob', type: 'AUDIO' },
          resolve
        );
      });

      const rejectPromise = new Promise<any>((resolve) => {
        clientAlice.on(SOCKET_EVENTS.CALL_REJECT, (data) => resolve(data));
      });

      clientBob.emit(SOCKET_EVENTS.CALL_REJECT, { callId: 'call-reject-test', reason: 'DECLINED' });
      const rejectData = await rejectPromise;
      expect(rejectData.callId).toBe('call-reject-test');
    });
  });
});
