import { prisma } from '../database/prisma.js';
import { PrivacyVisibility } from '@prisma/client';
import { isBlocked } from './blockService.js';
import { getIo } from '../socket/socketServer.js';
import { SOCKET_EVENTS } from '../constants/index.js';

export async function getPrivacySettings(userId: string) {
  const defaultSettings = {
    id: `privacy-${userId}`,
    userId,
    lastSeenVisibility: PrivacyVisibility.EVERYONE,
    onlineStatusVisibility: PrivacyVisibility.EVERYONE,
    profilePhotoVisibility: PrivacyVisibility.EVERYONE,
    aboutVisibility: PrivacyVisibility.EVERYONE,
    readReceipts: true,
    typingIndicator: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (!prisma?.privacySetting?.findUnique) {
    return defaultSettings;
  }

  try {
    let settings = await prisma.privacySetting.findUnique({
      where: { userId },
    });

    if (!settings && prisma?.privacySetting?.create) {
      settings = await prisma.privacySetting.create({
        data: {
          userId,
          lastSeenVisibility: PrivacyVisibility.EVERYONE,
          onlineStatusVisibility: PrivacyVisibility.EVERYONE,
          profilePhotoVisibility: PrivacyVisibility.EVERYONE,
          aboutVisibility: PrivacyVisibility.EVERYONE,
          readReceipts: true,
          typingIndicator: true,
        },
      });
    }

    return settings || defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export async function updatePrivacySettings(
  userId: string,
  data: {
    lastSeenVisibility?: PrivacyVisibility;
    onlineStatusVisibility?: PrivacyVisibility;
    profilePhotoVisibility?: PrivacyVisibility;
    aboutVisibility?: PrivacyVisibility;
    readReceipts?: boolean;
    typingIndicator?: boolean;
  }
) {
  const settings = await prisma.privacySetting.upsert({
    where: { userId },
    create: {
      userId,
      ...data,
    },
    update: {
      ...data,
      updatedAt: new Date(),
    },
  });

  const io = getIo();
  if (io) {
    io.to(`user:${userId}`).emit(SOCKET_EVENTS.PRIVACY_UPDATED, {
      userId,
      privacySettings: settings,
    });
  }

  return settings;
}

/**
 * Checks whether userA and userB have an active mutual direct conversation (Contacts).
 */
async function areContacts(userAId: string, userBId: string): Promise<boolean> {
  const directConvs = await prisma.conversationParticipant.findMany({
    where: {
      userId: userAId,
      conversation: {
        type: 'DIRECT',
        participants: {
          some: { userId: userBId },
        },
      },
    },
  });
  return directConvs.length > 0;
}

/**
 * Evaluates visibility rule based on privacy setting, contact status, and blocks.
 */
async function evaluateVisibility(
  viewerId: string,
  targetUserId: string,
  visibility: PrivacyVisibility
): Promise<boolean> {
  if (viewerId === targetUserId) return true;

  // If either user has blocked the other, hide private info
  const blocked = await isBlocked(viewerId, targetUserId);
  if (blocked) return false;

  if (visibility === PrivacyVisibility.EVERYONE) return true;
  if (visibility === PrivacyVisibility.NOBODY) return false;

  if (visibility === PrivacyVisibility.CONTACTS) {
    return areContacts(viewerId, targetUserId);
  }

  return true;
}

export async function canViewOnlineStatus(viewerId: string, targetUserId: string): Promise<boolean> {
  const settings = await getPrivacySettings(targetUserId);
  return evaluateVisibility(viewerId, targetUserId, settings.onlineStatusVisibility);
}

export async function canViewLastSeen(viewerId: string, targetUserId: string): Promise<boolean> {
  const settings = await getPrivacySettings(targetUserId);
  return evaluateVisibility(viewerId, targetUserId, settings.lastSeenVisibility);
}

export async function canViewProfilePhoto(viewerId: string, targetUserId: string): Promise<boolean> {
  const settings = await getPrivacySettings(targetUserId);
  return evaluateVisibility(viewerId, targetUserId, settings.profilePhotoVisibility);
}

export async function canViewAbout(viewerId: string, targetUserId: string): Promise<boolean> {
  const settings = await getPrivacySettings(targetUserId);
  return evaluateVisibility(viewerId, targetUserId, settings.aboutVisibility);
}

export async function shouldSendReadReceipt(userId: string): Promise<boolean> {
  const settings = await getPrivacySettings(userId);
  return settings.readReceipts;
}

export async function shouldSendTypingIndicator(userId: string): Promise<boolean> {
  const settings = await getPrivacySettings(userId);
  return settings.typingIndicator;
}
