import { prisma } from '../database/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { HTTP_STATUS } from '../constants/index.js';

export interface UpdateProfileInput {
  displayName?: string;
  username?: string;
  bio?: string;
  avatarUrl?: string;
}

export async function findUserByFirebaseUid(firebaseUid: string) {
  try {
    return await prisma.user.findUnique({
      where: { firebaseUid },
      select: {
        id: true,
        firebaseUid: true,
        phoneNumber: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        statusMessage: true,
        isOnline: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
  } catch (error: any) {
    throw new AppError(`Database query failed: ${error.message}`, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export interface SyncUserResult {
  user: any;
  isNewUser: boolean;
}

/**
 * Synchronize user from verified Firebase authentication identity.
 * Handles initial registration, repeat logins, and concurrent creation safely.
 */
export async function syncUserFromFirebase(firebaseUid: string, phoneNumber: string): Promise<SyncUserResult> {
  try {
    // 1. Check if user already exists by Firebase UID
    const existingByUid = await prisma.user.findUnique({
      where: { firebaseUid },
    });

    if (existingByUid) {
      const updated = await prisma.user.update({
        where: { id: existingByUid.id },
        data: {
          phoneNumber,
          lastSeenAt: new Date(),
        },
      });
      return {
        user: updated,
        isNewUser: !updated.username,
      };
    }

    // 2. Check if user exists by Phone Number (e.g. account recreation)
    const existingByPhone = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (existingByPhone) {
      const updated = await prisma.user.update({
        where: { id: existingByPhone.id },
        data: {
          firebaseUid,
          lastSeenAt: new Date(),
        },
      });
      return {
        user: updated,
        isNewUser: !updated.username,
      };
    }

    // 3. Brand new user - create record
    const newUser = await prisma.user.create({
      data: {
        firebaseUid,
        phoneNumber,
        displayName: phoneNumber,
      },
    });

    return {
      user: newUser,
      isNewUser: true,
    };
  } catch (error: any) {
    // Handle concurrent creation race condition (Prisma P2002 unique constraint)
    if (error?.code === 'P2002') {
      const concurrent = await prisma.user.findFirst({
        where: {
          OR: [{ firebaseUid }, { phoneNumber }],
        },
      });
      if (concurrent) {
        return {
          user: concurrent,
          isNewUser: !concurrent.username,
        };
      }
    }
    throw new AppError(`Failed to sync user: ${error.message}`, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * Backward compatible alias for Phase 1 code
 */
export async function upsertUserWithPhone(firebaseUid: string, phoneNumber: string) {
  const result = await syncUserFromFirebase(firebaseUid, phoneNumber);
  return result.user;
}

export async function updateUserProfile(userId: string, input: UpdateProfileInput) {
  if (input.username) {
    // Check if username taken by another user
    const existing = await prisma.user.findFirst({
      where: {
        username: input.username,
        NOT: { id: userId },
      },
    });
    if (existing) {
      throw new AppError('Username is already taken', HTTP_STATUS.CONFLICT);
    }
  }

  try {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.username !== undefined ? { username: input.username } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      },
    });
  } catch (error: any) {
    throw new AppError(`Failed to update profile: ${error.message}`, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function searchUsers(query: string, currentUserId: string) {
  const q = (query || '').trim();

  return await prisma.user.findMany({
    where: {
      AND: [
        { NOT: { id: currentUserId } },
        ...(q.length > 0
          ? [
              {
                OR: [
                  { username: { contains: q, mode: 'insensitive' as const } },
                  { displayName: { contains: q, mode: 'insensitive' as const } },
                  { phoneNumber: { contains: q } },
                ],
              },
            ]
          : []),
      ],
    },
    take: 20,
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      isOnline: true,
      lastSeenAt: true,
    },
  });
}
