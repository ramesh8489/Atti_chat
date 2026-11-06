import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../src/database/prisma.js';
import {
  setUserOnline,
  setUserOffline,
  isUserOnline,
  getUserSockets,
  handleSocketDisconnect,
  resetPresenceState,
} from '../src/services/presenceService.js';

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    user: {
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('../src/redis/redisClient.js', () => ({
  getRedisClient: vi.fn().mockReturnValue(null),
}));

describe('Presence Management Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPresenceState();
  });

  it('marks user as online on first connected socket', async () => {
    const userId = 'user-1';
    const socketId = 'sock-abc';

    const result = await setUserOnline(userId, socketId);

    expect(result.isNewlyOnline).toBe(true);
    expect(isUserOnline(userId)).toBe(true);
    expect(getUserSockets(userId)).toEqual([socketId]);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userId },
        data: expect.objectContaining({ isOnline: true }),
      })
    );
  });

  it('handles multi-device connections for the same user without re-triggering online event', async () => {
    const userId = 'user-1';

    const first = await setUserOnline(userId, 'sock-desktop');
    expect(first.isNewlyOnline).toBe(true);

    const second = await setUserOnline(userId, 'sock-mobile');
    expect(second.isNewlyOnline).toBe(false);

    expect(getUserSockets(userId)).toHaveLength(2);
    expect(isUserOnline(userId)).toBe(true);
  });

  it('keeps user online if only one of multiple devices disconnects', async () => {
    const userId = 'user-1';
    await setUserOnline(userId, 'sock-desktop');
    await setUserOnline(userId, 'sock-mobile');

    const result = await setUserOffline(userId, 'sock-desktop');

    expect(result.isNowOffline).toBe(false);
    expect(isUserOnline(userId)).toBe(true);
    expect(getUserSockets(userId)).toEqual(['sock-mobile']);
  });

  it('marks user as offline when their last active socket disconnects', async () => {
    const userId = 'user-1';
    await setUserOnline(userId, 'sock-mobile');

    const result = await setUserOffline(userId, 'sock-mobile');

    expect(result.isNowOffline).toBe(true);
    expect(isUserOnline(userId)).toBe(false);
    expect(getUserSockets(userId)).toEqual([]);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userId },
        data: expect.objectContaining({ isOnline: false }),
      })
    );
  });

  it('cleans up presence via handleSocketDisconnect lookup', async () => {
    const userId = 'user-2';
    await setUserOnline(userId, 'sock-temp');

    const cleanupResult = await handleSocketDisconnect('sock-temp');

    expect(cleanupResult.userId).toBe(userId);
    expect(cleanupResult.isNowOffline).toBe(true);
    expect(isUserOnline(userId)).toBe(false);
  });
});

