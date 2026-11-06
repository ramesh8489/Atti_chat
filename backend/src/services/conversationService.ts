import { prisma } from '../database/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { HTTP_STATUS } from '../constants/index.js';
import { ConversationType, MessageType, ReceiptStatus, ParticipantRole, NotificationType } from '@prisma/client';
import { isUserOnline } from './presenceService.js';
import { SupportedFileType } from './mediaValidationService.js';
import { isBlocked } from './blockService.js';
import { createAndSendNotification } from './notificationService.js';
import { logger } from '../config/logger.js';

export interface CreateGroupInput {
  title: string;
  avatarUrl?: string;
  memberUserIds: string[];
}

export async function getUserConversations(userId: string) {
  try {
    const participants = await prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    displayName: true,
                    username: true,
                    avatarUrl: true,
                    phoneNumber: true,
                    isOnline: true,
                    lastSeenAt: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sender: {
                  select: { id: true, displayName: true },
                },
                receipts: true,
              },
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
    });

    const result = await Promise.all(
      participants.map(async (p) => {
        const conv = p.conversation;
        const lastMessage = conv.messages[0] || null;
        const otherParticipants = conv.participants
          .filter((cp) => cp.userId !== userId)
          .map((cp) => ({
            ...cp.user,
            isOnline: isUserOnline(cp.user.id) || cp.user.isOnline,
            role: cp.role,
          }));

        let displayTitle: string | null = conv.title;
        let displayAvatar: string | null = conv.avatarUrl;
        let isDirectOnline = false;

        if (conv.type === ConversationType.DIRECT) {
          const directPartner = otherParticipants[0];
          if (directPartner) {
            displayTitle = directPartner.displayName || directPartner.username || directPartner.phoneNumber;
            displayAvatar = directPartner.avatarUrl || null;
            isDirectOnline = directPartner.isOnline;
          }
        }

        // Calculate unread count (messages sent by others after user's lastReadMessageId)
        let unreadCount = 0;
        try {
          unreadCount = await prisma.message.count({
            where: {
              conversationId: conv.id,
              senderId: { not: userId },
              receipts: {
                none: {
                  userId,
                  status: ReceiptStatus.READ,
                },
              },
            },
          });
        } catch {
          unreadCount = 0;
        }

        let messageStatus = 'SENT';
        if (lastMessage) {
          const receipts = lastMessage.receipts || [];
          const readReceipt = receipts.find((r) => r.userId !== userId && r.status === ReceiptStatus.READ);
          const deliveredReceipt = receipts.find((r) => r.userId !== userId && r.status === ReceiptStatus.DELIVERED);
          if (readReceipt) {
            messageStatus = 'READ';
          } else if (deliveredReceipt) {
            messageStatus = 'DELIVERED';
          }
        }

        return {
          id: conv.id,
          type: conv.type,
          title: displayTitle || (conv.type === ConversationType.GROUP ? 'Group Chat' : 'Direct Chat'),
          avatarUrl: displayAvatar || undefined,
          isOnline: conv.type === ConversationType.DIRECT ? isDirectOnline : undefined,
          updatedAt: conv.updatedAt.toISOString(),
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content,
                createdAt: lastMessage.createdAt.toISOString(),
                senderId: lastMessage.senderId,
                senderName: lastMessage.sender.displayName || 'User',
                type: lastMessage.type,
                status: messageStatus,
              }
            : null,
          participants: conv.participants.map((cp) => ({
            id: cp.user.id,
            displayName: cp.user.displayName || cp.user.phoneNumber,
            username: cp.user.username || undefined,
            avatarUrl: cp.user.avatarUrl || undefined,
            phoneNumber: cp.user.phoneNumber,
            isOnline: isUserOnline(cp.user.id) || cp.user.isOnline,
            role: cp.role,
          })),
          unreadCount,
        };
      })
    );

    return result;
  } catch (error: any) {
    throw new AppError(`Failed to fetch conversations: ${error.message}`, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function getConversationById(conversationId: string, userId: string) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  });

  if (!participant) {
    throw new AppError('Conversation not found or access denied', HTTP_STATUS.FORBIDDEN);
  }

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              username: true,
              avatarUrl: true,
              phoneNumber: true,
              isOnline: true,
              lastSeenAt: true,
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 50,
        include: {
          sender: {
            select: { id: true, displayName: true, avatarUrl: true, username: true },
          },
          attachments: true,
          receipts: true,
        },
      },
    },
  });

  if (!conv) {
    throw new AppError('Conversation not found', HTTP_STATUS.NOT_FOUND);
  }

  const otherParticipants = conv.participants
    .filter((cp) => cp.userId !== userId)
    .map((cp) => ({
      ...cp.user,
      isOnline: isUserOnline(cp.user.id) || cp.user.isOnline,
      role: cp.role,
    }));

  let displayTitle: string | null = conv.title;
  let displayAvatar: string | null = conv.avatarUrl;
  let isDirectOnline = false;

  if (conv.type === ConversationType.DIRECT) {
    const directPartner = otherParticipants[0];
    if (directPartner) {
      displayTitle = directPartner.displayName || directPartner.username || directPartner.phoneNumber;
      displayAvatar = directPartner.avatarUrl || null;
      isDirectOnline = directPartner.isOnline;
    }
  }

  return {
    id: conv.id,
    type: conv.type,
    title: displayTitle || (conv.type === ConversationType.GROUP ? 'Group Chat' : 'Direct Chat'),
    avatarUrl: displayAvatar || undefined,
    isOnline: conv.type === ConversationType.DIRECT ? isDirectOnline : undefined,
    updatedAt: conv.updatedAt.toISOString(),
    participants: conv.participants.map((cp) => ({
      id: cp.user.id,
      displayName: cp.user.displayName || cp.user.phoneNumber,
      username: cp.user.username || undefined,
      avatarUrl: cp.user.avatarUrl || undefined,
      phoneNumber: cp.user.phoneNumber,
      isOnline: isUserOnline(cp.user.id) || cp.user.isOnline,
      role: cp.role,
    })),
    messages: conv.messages.map((m) => {
      const isOutgoing = m.senderId === userId;
      let status: 'SENT' | 'DELIVERED' | 'READ' = 'SENT';
      const receipts = m.receipts || [];
      if (receipts.some((r) => r.userId !== userId && r.status === ReceiptStatus.READ)) {
        status = 'READ';
      } else if (receipts.some((r) => r.userId !== userId && r.status === ReceiptStatus.DELIVERED)) {
        status = 'DELIVERED';
      }

      return {
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        senderName: m.sender.displayName || 'User',
        senderAvatar: m.sender.avatarUrl || undefined,
        content: m.content,
        type: m.type,
        createdAt: m.createdAt.toISOString(),
        status,
        isOutgoing,
        attachments: m.attachments,
      };
    }),
  };
}

export async function createDirectConversation(userId: string, targetUserId: string) {
  if (userId === targetUserId) {
    throw new AppError('Cannot create conversation with yourself', HTTP_STATUS.BAD_REQUEST);
  }

  // Check if communication is blocked
  const blocked = await isBlocked(userId, targetUserId);
  if (blocked) {
    throw new AppError('Cannot create conversation with this user due to privacy/block settings', HTTP_STATUS.FORBIDDEN);
  }

  // Check target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });
  if (!targetUser) {
    throw new AppError('Target user does not exist', HTTP_STATUS.NOT_FOUND);
  }

  // Check if direct conversation already exists between these two users
  const existing = await prisma.conversation.findFirst({
    where: {
      type: ConversationType.DIRECT,
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: targetUserId } } },
      ],
    },
    include: {
      participants: {
        include: { user: true },
      },
    },
  });

  if (existing) {
    return await getConversationById(existing.id, userId);
  }

  // Create new direct conversation
  const created = await prisma.conversation.create({
    data: {
      type: ConversationType.DIRECT,
      createdById: userId,
      participants: {
        create: [
          { userId, role: ParticipantRole.OWNER },
          { userId: targetUserId, role: ParticipantRole.MEMBER },
        ],
      },
    },
  });

  return await getConversationById(created.id, userId);
}

export async function createGroupConversation(creatorId: string, input: CreateGroupInput) {
  const { title, avatarUrl, memberUserIds } = input;

  if (!title || title.trim().length === 0) {
    throw new AppError('Group title is required', HTTP_STATUS.BAD_REQUEST);
  }

  // Deduplicate and ensure creator is included
  const participantIds = Array.from(new Set([creatorId, ...memberUserIds]));

  if (participantIds.length < 2) {
    throw new AppError('A group must have at least 2 members', HTTP_STATUS.BAD_REQUEST);
  }

  // Create group conversation
  const created = await prisma.conversation.create({
    data: {
      type: ConversationType.GROUP,
      title: title.trim(),
      avatarUrl: avatarUrl || null,
      createdById: creatorId,
      participants: {
        create: participantIds.map((id) => ({
          userId: id,
          role: id === creatorId ? ParticipantRole.OWNER : ParticipantRole.MEMBER,
        })),
      },
    },
  });

  // Notify other members about group membership
  for (const memberId of participantIds) {
    if (memberId !== creatorId) {
      createAndSendNotification({
        userId: memberId,
        conversationId: created.id,
        type: NotificationType.GROUP_MEMBERSHIP,
        title: title.trim(),
        body: `You were added to the group "${title.trim()}"`,
        senderId: creatorId,
      }).catch((err) => {
        logger.warn(`Failed to dispatch group membership notification to ${memberId}:`, { message: err?.message });
      });
    }
  }

  return await getConversationById(created.id, creatorId);
}

export async function getConversationMessages(conversationId: string, userId: string, limit = 50) {
  const isParticipant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  });

  if (!isParticipant) {
    throw new AppError('Access denied: You are not a participant in this conversation', HTTP_STATUS.FORBIDDEN);
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      deletedForUsers: {
        none: { userId },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: {
      sender: {
        select: { id: true, displayName: true, avatarUrl: true, username: true },
      },
      attachments: true,
      receipts: true,
      reactions: {
        include: {
          user: { select: { id: true, displayName: true, username: true } },
        },
      },
      replyTo: {
        select: {
          id: true,
          content: true,
          type: true,
          isDeleted: true,
          sender: { select: { displayName: true } },
        },
      },
      pinnedIn: {
        where: { conversationId },
      },
      starredBy: {
        where: { userId },
      },
    },
  });

  return messages.map((m) => {
    const isOutgoing = m.senderId === userId;
    let status: 'SENT' | 'DELIVERED' | 'READ' = 'SENT';
    const receipts = m.receipts || [];
    if (receipts.some((r) => r.userId !== userId && r.status === ReceiptStatus.READ)) {
      status = 'READ';
    } else if (receipts.some((r) => r.userId !== userId && r.status === ReceiptStatus.DELIVERED)) {
      status = 'DELIVERED';
    }

    // Aggregate reactions
    const reactionMap = new Map<string, { emoji: string; count: number; users: any[]; hasReacted: boolean }>();
    (m.reactions || []).forEach((r) => {
      const existing = reactionMap.get(r.emoji) || {
        emoji: r.emoji,
        count: 0,
        users: [],
        hasReacted: false,
      };
      existing.count += 1;
      existing.users.push({
        id: r.user.id,
        displayName: r.user.displayName || r.user.username || 'User',
      });
      if (r.userId === userId) {
        existing.hasReacted = true;
      }
      reactionMap.set(r.emoji, existing);
    });

    const isDeleted = m.isDeleted;

    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      senderName: m.sender.displayName || 'User',
      senderAvatar: m.sender.avatarUrl || undefined,
      content: isDeleted ? 'This message was deleted' : m.content,
      type: m.type,
      createdAt: m.createdAt.toISOString(),
      status,
      isOutgoing,
      attachments: isDeleted ? [] : m.attachments,
      isEdited: m.isEdited,
      editedAt: m.editedAt ? m.editedAt.toISOString() : undefined,
      isDeleted: m.isDeleted,
      isForwarded: m.isForwarded,
      forwardedFrom: m.forwardedFrom || undefined,
      isPinned: Boolean(m.pinnedIn && m.pinnedIn.length > 0),
      isStarred: Boolean(m.starredBy && m.starredBy.length > 0),
      replyTo: m.replyTo
        ? {
            id: m.replyTo.id,
            content: m.replyTo.isDeleted ? 'This message was deleted' : m.replyTo.content,
            type: m.replyTo.type,
            senderName: m.replyTo.sender?.displayName || 'User',
            isDeleted: m.replyTo.isDeleted,
          }
        : undefined,
      reactions: Array.from(reactionMap.values()),
    };
  });
}

export async function createMessage(
  senderId: string,
  conversationId: string,
  content: string,
  type: MessageType = MessageType.TEXT,
  replyToId?: string
) {
  if (!content || content.trim().length === 0) {
    throw new AppError('Message content cannot be empty', HTTP_STATUS.BAD_REQUEST);
  }

  // Verify sender is participant
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: senderId,
      },
    },
  });

  if (!participant) {
    throw new AppError('Cannot send message: not a conversation participant', HTTP_STATUS.FORBIDDEN);
  }

  // Check if conversation is direct and if users are blocked
  let conversation: any = null;
  if (prisma?.conversation?.findUnique) {
    try {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          participants: {
            select: { userId: true },
          },
        },
      });
    } catch {
      conversation = null;
    }
  }

  if (conversation && conversation.type === ConversationType.DIRECT) {
    const otherParticipant = conversation.participants.find((p: any) => p.userId !== senderId);
    if (otherParticipant) {
      const blocked = await isBlocked(senderId, otherParticipant.userId);
      if (blocked) {
        throw new AppError('Cannot send message. Communication is blocked between these users.', HTTP_STATUS.FORBIDDEN);
      }
    }
  }

  const now = new Date();

  // Create message and touch conversation in one transaction
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        senderId,
        content: content.trim(),
        type,
        replyToId: replyToId || null,
        createdAt: now,
        receipts: {
          create: {
            userId: senderId,
            status: ReceiptStatus.READ,
            timestamp: now,
          },
        },
      },
      include: {
        sender: {
          select: { id: true, displayName: true, avatarUrl: true, username: true },
        },
        attachments: true,
        receipts: true,
        replyTo: {
          select: {
            id: true,
            content: true,
            type: true,
            isDeleted: true,
            sender: {
              select: { displayName: true },
            },
          },
        },
      },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: now },
    }),
  ]);

  // Dispatch real-time and push notifications to other participants
  if (conversation && conversation.participants) {
    const senderName = message.sender.displayName || message.sender.username || 'PingUp User';
    const isDirect = conversation.type === ConversationType.DIRECT;
    const notifTitle = isDirect ? senderName : (conversation.title || 'Group Message');
    const notifBody = isDirect ? message.content : `${senderName}: ${message.content}`;

    for (const p of conversation.participants) {
      if (p.userId !== senderId) {
        createAndSendNotification({
          userId: p.userId,
          conversationId,
          messageId: message.id,
          type: isDirect ? NotificationType.DIRECT_MESSAGE : NotificationType.GROUP_MESSAGE,
          title: notifTitle,
          body: notifBody,
          senderId,
          senderName,
          senderAvatar: message.sender.avatarUrl || undefined,
        }).catch((err) => {
          logger.warn(`Failed to dispatch notification for user ${p.userId}:`, { message: err?.message });
        });
      }
    }
  }

  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    senderName: message.sender.displayName || 'User',
    senderAvatar: message.sender.avatarUrl || undefined,
    content: message.content,
    type: message.type,
    createdAt: message.createdAt.toISOString(),
    status: 'SENT' as const,
    isOutgoing: true,
    attachments: message.attachments,
    replyToId: message.replyToId,
    replyTo: message.replyTo
      ? {
          id: message.replyTo.id,
          content: message.replyTo.isDeleted ? 'This message was deleted' : message.replyTo.content,
          type: message.replyTo.type,
          senderName: message.replyTo.sender?.displayName || 'User',
          isDeleted: message.replyTo.isDeleted,
        }
      : undefined,
    reactions: [],
    isEdited: false,
    editedAt: null,
    isDeleted: false,
    isForwarded: false,
    forwardedFrom: null,
    isPinned: false,
    isStarred: false,
  };
}

export async function markMessagesAsRead(conversationId: string, userId: string) {
  // Verify participant
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  });

  if (!participant) {
    return { markedCount: 0 };
  }

  // Find unread messages not sent by userId
  const unreadMessages = await prisma.message.findMany({
    where: {
      conversationId,
      senderId: { not: userId },
      receipts: {
        none: {
          userId,
          status: ReceiptStatus.READ,
        },
      },
    },
    select: { id: true },
  });

  if (unreadMessages.length === 0) {
    return { markedCount: 0 };
  }

  const now = new Date();
  await prisma.$transaction(
    unreadMessages.map((m) =>
      prisma.messageReceipt.upsert({
        where: {
          messageId_userId: {
            messageId: m.id,
            userId,
          },
        },
        create: {
          messageId: m.id,
          userId,
          status: ReceiptStatus.READ,
          timestamp: now,
        },
        update: {
          status: ReceiptStatus.READ,
          timestamp: now,
        },
      })
    )
  );

  // Update last read message
  const lastMessage = unreadMessages[unreadMessages.length - 1];
  if (lastMessage) {
    await prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        lastReadMessageId: lastMessage.id,
      },
    });
  }

  return { markedCount: unreadMessages.length };
}

export async function getConversationParticipantUserIds(conversationId: string): Promise<string[]> {
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  return participants.map((p) => p.userId);
}

export interface CreateAttachmentMessageInput {
  conversationId: string;
  senderId: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileType: SupportedFileType;
  textContent?: string;
  replyToId?: string;
  width?: number;
  height?: number;
  durationSec?: number;
}

export async function createMessageWithAttachment(input: CreateAttachmentMessageInput) {
  const {
    conversationId,
    senderId,
    fileKey,
    fileName,
    fileSize,
    mimeType,
    fileType,
    textContent,
    replyToId,
    width,
    height,
    durationSec,
  } = input;

  // 1. Verify sender is a conversation participant
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: senderId,
      },
    },
  });

  if (!participant) {
    throw new AppError('Cannot send attachment: not a conversation participant', HTTP_STATUS.FORBIDDEN);
  }

  // Check if conversation is direct and if users are blocked
  let conversation: any = null;
  if (prisma?.conversation?.findUnique) {
    try {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          participants: {
            select: { userId: true },
          },
        },
      });
    } catch {
      conversation = null;
    }
  }

  if (conversation && conversation.type === ConversationType.DIRECT) {
    const otherParticipant = conversation.participants?.find((p: any) => p.userId !== senderId);
    if (otherParticipant) {
      const blocked = await isBlocked(senderId, otherParticipant.userId);
      if (blocked) {
        throw new AppError('Cannot send attachment. Communication is blocked between these users.', HTTP_STATUS.FORBIDDEN);
      }
    }
  }

  const now = new Date();
  const finalContent = textContent?.trim() || fileName;

  // 2. Persist Message and MediaAttachment in transaction
  const [createdMessage] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        senderId,
        type: fileType as MessageType,
        content: finalContent,
        replyToId: replyToId || null,
        createdAt: now,
        receipts: {
          create: {
            userId: senderId,
            status: ReceiptStatus.READ,
            timestamp: now,
          },
        },
        attachments: {
          create: {
            fileKey,
            fileUrl: `/api/attachments/stream/${encodeURIComponent(fileKey)}`,
            fileType,
            fileSize,
            mimeType,
            fileName,
            uploaderId: senderId,
            status: 'READY',
            width: width || null,
            height: height || null,
            durationSec: durationSec || null,
            createdAt: now,
          },
        },
      },
      include: {
        sender: {
          select: { id: true, displayName: true, avatarUrl: true, username: true },
        },
        attachments: true,
        receipts: true,
      },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: now },
    }),
  ]);

  // Dispatch real-time and push notifications to other participants
  if (conversation && conversation.participants) {
    const senderName = createdMessage.sender.displayName || createdMessage.sender.username || 'PingUp User';
    const isDirect = conversation.type === ConversationType.DIRECT;
    const notifTitle = isDirect ? senderName : (conversation.title || 'Group Message');
    const notifBody = isDirect
      ? (textContent?.trim() || `Sent an attachment: ${fileName}`)
      : `${senderName}: ${textContent?.trim() || `Sent an attachment: ${fileName}`}`;

    for (const p of conversation.participants) {
      if (p.userId !== senderId) {
        createAndSendNotification({
          userId: p.userId,
          conversationId,
          messageId: createdMessage.id,
          type: isDirect ? NotificationType.DIRECT_MESSAGE : NotificationType.GROUP_MESSAGE,
          title: notifTitle,
          body: notifBody,
          senderId,
          senderName,
          senderAvatar: createdMessage.sender.avatarUrl || undefined,
        }).catch((err) => {
          logger.warn(`Failed to dispatch attachment notification for user ${p.userId}:`, { message: err?.message });
        });
      }
    }
  }

  return {
    id: createdMessage.id,
    conversationId: createdMessage.conversationId,
    senderId: createdMessage.senderId,
    senderName: createdMessage.sender.displayName || 'User',
    senderAvatar: createdMessage.sender.avatarUrl || undefined,
    content: createdMessage.content,
    type: createdMessage.type,
    createdAt: createdMessage.createdAt.toISOString(),
    status: 'SENT' as const,
    isOutgoing: true,
    attachments: createdMessage.attachments,
  };
}

export async function getAttachmentById(attachmentId: string, userId: string) {
  const attachment = await prisma.mediaAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      message: {
        include: {
          conversation: {
            include: {
              participants: {
                select: { userId: true, role: true },
              },
            },
          },
        },
      },
    },
  });

  if (!attachment) {
    throw new AppError('Attachment not found', HTTP_STATUS.NOT_FOUND);
  }

  // Check if requesting user is a participant in the conversation
  const isParticipant = attachment.message.conversation.participants.some(
    (p) => p.userId === userId
  );

  if (!isParticipant) {
    throw new AppError('Access denied: You are not a member of this conversation', HTTP_STATUS.FORBIDDEN);
  }

  return attachment;
}

export async function deleteAttachment(attachmentId: string, userId: string) {
  const attachment = await prisma.mediaAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      message: {
        include: {
          conversation: {
            include: {
              participants: {
                select: { userId: true, role: true },
              },
            },
          },
        },
      },
    },
  });

  if (!attachment) {
    throw new AppError('Attachment not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization: must be uploader, message sender, or conversation OWNER/ADMIN
  const participant = attachment.message.conversation.participants.find((p) => p.userId === userId);
  if (!participant) {
    throw new AppError('Access denied: You are not a participant in this conversation', HTTP_STATUS.FORBIDDEN);
  }

  const isUploader = attachment.uploaderId === userId || attachment.message.senderId === userId;
  const isPrivileged = participant.role === ParticipantRole.OWNER || participant.role === ParticipantRole.ADMIN;

  if (!isUploader && !isPrivileged) {
    throw new AppError('Permission denied: You cannot delete this attachment', HTTP_STATUS.FORBIDDEN);
  }

  // Delete attachment record and soft-delete/update message
  await prisma.$transaction([
    prisma.mediaAttachment.delete({
      where: { id: attachmentId },
    }),
    prisma.message.update({
      where: { id: attachment.messageId },
      data: { isDeleted: true },
    }),
  ]);

  return { success: true, fileKey: attachment.fileKey };
}

export async function listConversationAttachments(conversationId: string, userId: string, limit = 50, page = 1) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  });

  if (!participant) {
    throw new AppError('Access denied: You are not a participant in this conversation', HTTP_STATUS.FORBIDDEN);
  }

  const skip = (page - 1) * limit;

  const [attachments, totalCount] = await Promise.all([
    prisma.mediaAttachment.findMany({
      where: {
        message: {
          conversationId,
          isDeleted: false,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        message: {
          select: { id: true, senderId: true, createdAt: true },
        },
      },
    }),
    prisma.mediaAttachment.count({
      where: {
        message: {
          conversationId,
          isDeleted: false,
        },
      },
    }),
  ]);

  return {
    attachments,
    totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
  };
}

