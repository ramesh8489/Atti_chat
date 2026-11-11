import crypto from 'crypto';
import { prisma } from '../database/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { HTTP_STATUS } from '../constants/index.js';
import { hashPassword, signAttiToken, verifyPassword } from './authTokenService.js';

export interface UpdateProfileInput {
  displayName?: string;
  username?: string;
  bio?: string;
  avatarUrl?: string;
}

export const PUBLIC_USER_SELECT = {
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
} as const;

export async function findUserByFirebaseUid(firebaseUid: string) {
  try {
    return await prisma.user.findUnique({
      where: { firebaseUid },
      select: PUBLIC_USER_SELECT,
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
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.username !== undefined ? { username: input.username } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      },
    });
    if (!updated) return updated;
    const { passwordHash: _passwordHash, ...safeUser } = updated as any;
    return safeUser;
  } catch (error: any) {
    throw new AppError(`Failed to update profile: ${error.message}`, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export function normalizePhoneNumber(rawPhoneNumber: string): string {
  const cleaned = (rawPhoneNumber || '').replace(/[\s\-()]/g, '').trim();
  const normalized = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
    throw new AppError(
      'Please enter a valid phone number with country code (e.g. +919876543210).',
      HTTP_STATUS.BAD_REQUEST
    );
  }
  return normalized;
}

export async function checkPhoneExists(rawPhoneNumber: string): Promise<{ exists: boolean; hasPassword: boolean }> {
  const phoneNumber = normalizePhoneNumber(rawPhoneNumber);
  try {
    const existing = await prisma.user.findUnique({
      where: { phoneNumber },
      select: {
        id: true,
        passwordHash: true,
      },
    });
    return {
      exists: Boolean(existing),
      hasPassword: Boolean(existing?.passwordHash),
    };
  } catch (error: any) {
    throw new AppError(`Failed to check phone number: ${error.message}`, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export interface PhonePasswordAuthInput {
  phoneNumber: string;
  password: string;
  mode?: 'login' | 'register' | 'auto';
}

export async function authenticateWithPhonePassword(input: PhonePasswordAuthInput) {
  const phoneNumber = normalizePhoneNumber(input.phoneNumber);
  const password = input.password || '';
  const mode = input.mode || 'auto';

  if (password.length < 4 || password.length > 128) {
    throw new AppError('PIN or password must be between 4 and 128 characters.', HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!existing) {
      if (mode === 'login') {
        throw new AppError(
          'No account found for this phone number. Create a PIN to register.',
          HTTP_STATUS.NOT_FOUND
        );
      }

      const passwordHash = hashPassword(password);
      const created = await prisma.user.create({
        data: {
          firebaseUid: `phone_${crypto.randomUUID()}`,
          phoneNumber,
          displayName: phoneNumber,
          passwordHash,
        },
        select: PUBLIC_USER_SELECT,
      });

      const token = signAttiToken({
        userId: created.id,
        firebaseUid: created.firebaseUid,
        phoneNumber: created.phoneNumber,
      });

      return {
        user: created,
        token,
        isNewUser: true,
      };
    }

    if (mode === 'register' && existing.passwordHash) {
      throw new AppError(
        'This phone number is already registered. Please enter your PIN/password to log in.',
        HTTP_STATUS.CONFLICT
      );
    }

    if (!existing.passwordHash) {
      if (mode === 'login') {
        throw new AppError(
          'No PIN/password is set for this account yet. Use Register to set your PIN.',
          HTTP_STATUS.UNAUTHORIZED
        );
      }

      const passwordHash = hashPassword(password);
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          lastSeenAt: new Date(),
        },
        select: PUBLIC_USER_SELECT,
      });

      const token = signAttiToken({
        userId: updated.id,
        firebaseUid: updated.firebaseUid,
        phoneNumber: updated.phoneNumber,
      });

      return {
        user: updated,
        token,
        isNewUser: !updated.username,
      };
    }

    const isValid = verifyPassword(password, existing.passwordHash);
    if (!isValid) {
      throw new AppError('Incorrect PIN or password. Please try again.', HTTP_STATUS.UNAUTHORIZED);
    }

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        lastSeenAt: new Date(),
      },
      select: PUBLIC_USER_SELECT,
    });

    const token = signAttiToken({
      userId: updated.id,
      firebaseUid: updated.firebaseUid,
      phoneNumber: updated.phoneNumber,
    });

    return {
      user: updated,
      token,
      isNewUser: !updated.username,
    };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error?.code === 'P2002') {
      throw new AppError(
        'This phone number is already registered. Please enter your PIN/password to log in.',
        HTTP_STATUS.CONFLICT
      );
    }
    throw new AppError(`Authentication failed: ${error.message}`, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function searchUsers(query: string, currentUserId: string) {
  const q = (query || '').trim();
  const qDigits = q.replace(/[\s\-()]/g, '');

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
                  ...(qDigits.length >= 3 && qDigits !== q
                    ? [{ phoneNumber: { contains: qDigits } }]
                    : []),
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
