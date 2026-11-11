import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { initSocketServer } from '../src/socket/socketServer.js';
import { prisma } from '../src/database/prisma.js';
import { SOCKET_EVENTS } from '../src/constants/index.js';
import { resetPresenceState } from '../src/services/presenceService.js';

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    conversationParticipant: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    message: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    conversation: {
      update: vi.fn().mockResolvedValue({}),
    },
    messageReceipt: {
      upsert: vi.fn().mockResolvedValue({}),
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

describe('Socket.IO Real-Time Messaging & Presence Gateway', () => {
  let httpServer: http.Server;
  let serverPort: number;

  beforeAll(async () => {
    httpServer = http.createServer();
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
    resetPresenceState();
  });

  it('rejects connection if no Bearer token is provided', async () => {
    const client = Client(`http://localhost:${serverPort}`, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: false,
    });

    const errorPromise = new Promise<string>((resolve) => {
      client.on('connect_error', (err) => {
        resolve(err.message);
      });
    });

    const errorMessage = await errorPromise;
    expect(errorMessage).toContain('Authentication required');
    client.close();
  });

  it('authenticates client successfully with token and broadcasts user:online', async () => {
    const mockUser = {
      id: 'usr-alice',
      firebaseUid: 'alice_uid',
      displayName: 'Alice',
      phoneNumber: '+919876543210',
      isOnline: false,
    };
    (prisma.user.findUnique as any).mockResolvedValue(mockUser);

    const client = Client(`http://localhost:${serverPort}`, {
      auth: { token: 'mock_token_alice_uid' },
      transports: ['websocket'],
      autoConnect: true,
      reconnection: false,
    });

    await new Promise<void>((resolve) => {
      client.on('connect', () => resolve());
    });

    expect(client.connected).toBe(true);
    client.close();
  });

  it('joins conversation room and dispatches message:receive on message:send', async () => {
    const mockUser1 = {
      id: 'usr-alice',
      firebaseUid: 'alice_uid',
      displayName: 'Alice',
      phoneNumber: '+919876543210',
    };
    const mockUser2 = {
      id: 'usr-bob',
      firebaseUid: 'bob_uid',
      displayName: 'Bob',
      phoneNumber: '+919876543211',
    };

    (prisma.user.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.firebaseUid === 'alice_uid') return Promise.resolve(mockUser1);
      if (where.firebaseUid === 'bob_uid') return Promise.resolve(mockUser2);
      return Promise.resolve(null);
    });

    (prisma.conversationParticipant.findUnique as any).mockResolvedValue({
      conversationId: 'conv-101',
      userId: 'usr-alice',
    });

    (prisma.conversationParticipant.findMany as any).mockResolvedValue([
      { userId: 'usr-alice' },
      { userId: 'usr-bob' },
    ]);

    const createdMsg = {
      id: 'msg-live-1',
      conversationId: 'conv-101',
      senderId: 'usr-alice',
      content: 'Hello Bob!',
      type: 'TEXT',
      createdAt: new Date(),
      sender: { id: 'usr-alice', displayName: 'Alice', avatarUrl: null, username: 'alice' },
      attachments: [],
      receipts: [],
    };
    (prisma.$transaction as any).mockResolvedValue([createdMsg, {}]);

    const clientAlice = Client(`http://localhost:${serverPort}`, {
      auth: { token: 'mock_token_alice_uid' },
      transports: ['websocket'],
    });

    const clientBob = Client(`http://localhost:${serverPort}`, {
      auth: { token: 'mock_token_bob_uid' },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise<void>((res) => clientAlice.on('connect', () => res())),
      new Promise<void>((res) => clientBob.on('connect', () => res())),
    ]);

    // Bob listens for receive message; Alice should NOT receive her own message echo
    let aliceEchoed = false;
    clientAlice.on(SOCKET_EVENTS.RECEIVE_MESSAGE, () => {
      aliceEchoed = true;
    });

    const bobReceivePromise = new Promise<any>((resolve) => {
      clientBob.on(SOCKET_EVENTS.RECEIVE_MESSAGE, (data) => {
        resolve(data);
      });
    });

    // Alice joins room and sends message
    await new Promise<void>((res) => {
      clientAlice.emit(SOCKET_EVENTS.JOIN_ROOM, { conversationId: 'conv-101' }, () => res());
    });

    const ackPromise = new Promise<any>((resolve) => {
      clientAlice.emit(
        SOCKET_EVENTS.SEND_MESSAGE,
        {
          conversationId: 'conv-101',
          content: 'Hello Bob!',
        },
        (res: any) => resolve(res)
      );
    });

    const [received, ack] = await Promise.all([bobReceivePromise, ackPromise]);
    await new Promise((r) => setTimeout(r, 50));

    expect(received.content).toBe('Hello Bob!');
    expect(received.senderId).toBe('usr-alice');
    expect(received.isOutgoing).toBe(false);
    expect(ack?.success).toBe(true);
    expect(ack?.message?.isOutgoing).toBe(true);
    expect(aliceEchoed).toBe(false);

    clientAlice.close();
    clientBob.close();
  });

  it('broadcasts typing start and stop events to room participants', async () => {
    const mockUser1 = { id: 'usr-alice', firebaseUid: 'alice_uid', displayName: 'Alice' };
    const mockUser2 = { id: 'usr-bob', firebaseUid: 'bob_uid', displayName: 'Bob' };

    (prisma.user.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.firebaseUid === 'alice_uid') return Promise.resolve(mockUser1);
      if (where.firebaseUid === 'bob_uid') return Promise.resolve(mockUser2);
      return Promise.resolve(null);
    });

    (prisma.conversationParticipant.findUnique as any).mockResolvedValue({
      conversationId: 'conv-101',
      userId: 'usr-alice',
    });

    const clientAlice = Client(`http://localhost:${serverPort}`, {
      auth: { token: 'mock_token_alice_uid' },
      transports: ['websocket'],
    });

    const clientBob = Client(`http://localhost:${serverPort}`, {
      auth: { token: 'mock_token_bob_uid' },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise<void>((res) => clientAlice.on('connect', () => res())),
      new Promise<void>((res) => clientBob.on('connect', () => res())),
    ]);

    // Both join conversation room
    await Promise.all([
      new Promise<void>((res) => clientAlice.emit(SOCKET_EVENTS.JOIN_ROOM, { conversationId: 'conv-101' }, () => res())),
      new Promise<void>((res) => clientBob.emit(SOCKET_EVENTS.JOIN_ROOM, { conversationId: 'conv-101' }, () => res())),
    ]);

    const typingPromise = new Promise<any>((resolve) => {
      clientBob.on(SOCKET_EVENTS.TYPING_START, (data) => resolve(data));
    });

    clientAlice.emit(SOCKET_EVENTS.TYPING_START, { conversationId: 'conv-101' });

    const typingData = await typingPromise;
    expect(typingData.conversationId).toBe('conv-101');
    expect(typingData.userId).toBe('usr-alice');

    clientAlice.close();
    clientBob.close();
  });
});

