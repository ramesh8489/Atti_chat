import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../src/database/prisma.js';
import { syncUserFromFirebase } from '../src/services/userService.js';

vi.mock('../src/database/prisma.js', () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

describe('User Synchronization & Login Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates new user on first-time login and flags isNewUser as true', async () => {
    // Neither UID nor Phone found in database
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const createdRecord = {
      id: 'usr_new_123',
      firebaseUid: 'firebase_uid_abc',
      phoneNumber: '+919876543210',
      displayName: '+919876543210',
      username: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (prisma.user.create as any).mockResolvedValue(createdRecord);

    const result = await syncUserFromFirebase('firebase_uid_abc', '+919876543210');

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        firebaseUid: 'firebase_uid_abc',
        phoneNumber: '+919876543210',
        displayName: '+919876543210',
      },
    });
    expect(result.isNewUser).toBe(true);
    expect(result.user.id).toBe('usr_new_123');
  });

  it('handles repeat login for existing user with completed profile (isNewUser: false)', async () => {
    const existingRecord = {
      id: 'usr_existing_456',
      firebaseUid: 'firebase_uid_abc',
      phoneNumber: '+919876543210',
      displayName: 'Aravind',
      username: 'aravind',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (prisma.user.findUnique as any).mockResolvedValueOnce(existingRecord);

    const updatedRecord = {
      ...existingRecord,
      lastSeenAt: new Date(),
    };
    (prisma.user.update as any).mockResolvedValue(updatedRecord);

    const result = await syncUserFromFirebase('firebase_uid_abc', '+919876543210');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'usr_existing_456' },
      data: expect.objectContaining({
        phoneNumber: '+919876543210',
      }),
    });
    expect(result.isNewUser).toBe(false);
    expect(result.user.username).toBe('aravind');
  });

  it('re-links user if found by verified phone number under new Firebase UID', async () => {
    // 1st lookup by UID returns null
    (prisma.user.findUnique as any).mockResolvedValueOnce(null);
    // 2nd lookup by Phone returns existing record
    const existingByPhone = {
      id: 'usr_phone_789',
      firebaseUid: 'old_uid_xyz',
      phoneNumber: '+919876543210',
      displayName: 'Karthik',
      username: 'karthik',
    };
    (prisma.user.findUnique as any).mockResolvedValueOnce(existingByPhone);

    const updated = {
      ...existingByPhone,
      firebaseUid: 'new_uid_123',
    };
    (prisma.user.update as any).mockResolvedValue(updated);

    const result = await syncUserFromFirebase('new_uid_123', '+919876543210');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'usr_phone_789' },
      data: expect.objectContaining({
        firebaseUid: 'new_uid_123',
      }),
    });
    expect(result.user.firebaseUid).toBe('new_uid_123');
    expect(result.isNewUser).toBe(false);
  });

  it('safely handles concurrent creation conflict (P2002) without failing', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const p2002Error: any = new Error('Unique constraint failed');
    p2002Error.code = 'P2002';
    (prisma.user.create as any).mockRejectedValueOnce(p2002Error);

    const concurrentUser = {
      id: 'usr_concurrent_999',
      firebaseUid: 'firebase_concurrent_uid',
      phoneNumber: '+919876543210',
      username: 'concurrent_user',
    };
    (prisma.user.findFirst as any).mockResolvedValueOnce(concurrentUser);

    const result = await syncUserFromFirebase('firebase_concurrent_uid', '+919876543210');

    expect(result.user.id).toBe('usr_concurrent_999');
    expect(result.isNewUser).toBe(false);
  });
});

