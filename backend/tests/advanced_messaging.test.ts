import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../src/database/prisma.js';
import {
  editMessage,
  deleteMessage,
  toggleMessageReaction,
  pinMessage,
  unpinMessage,
  listPinnedMessages,
  toggleStarMessage,
  listStarredMessages,
  forwardMessage,
  searchMessages,
} from '../src/services/advancedMessagingService.js';
import { ConversationType, ParticipantRole } from '@prisma/client';

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    message: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    conversation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    conversationParticipant: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    messageReaction: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    pinnedMessage: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    starredMessage: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    userDeletedMessage: {
      upsert: vi.fn(),
    },
    mediaAttachment: {
      create: vi.fn(),
    },
    messageReceipt: {
      create: vi.fn(),
    },
    $transaction: vi.fn((arg) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg;
    }),
  },
}));

vi.mock('../src/socket/socketServer.js', () => ({
  getIo: vi.fn(() => ({
    to: vi.fn(() => ({
      emit: vi.fn(),
    })),
  })),
}));

describe('Advanced Messaging Service (Phase 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('editMessage', () => {
    it('allows sender to edit their own message within 15 minutes', async () => {
      const now = new Date();
      (prisma.message.findUnique as any).mockResolvedValue({
        id: 'msg-1',
        senderId: 'user-1',
        conversationId: 'conv-1',
        content: 'Original content',
        isDeleted: false,
        createdAt: new Date(now.getTime() - 5 * 60 * 1000), // 5 min ago
      });

      (prisma.message.update as any).mockResolvedValue({
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: 'user-1',
        content: 'Edited content',
        isEdited: true,
        editedAt: now,
        updatedAt: now,
        sender: { id: 'user-1', displayName: 'Alice', avatarUrl: null },
        attachments: [],
      });

      const result = await editMessage({
        messageId: 'msg-1',
        userId: 'user-1',
        newContent: 'Edited content',
      });

      expect(result.content).toBe('Edited content');
      expect(result.isEdited).toBe(true);
      expect(prisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'msg-1' },
          data: expect.objectContaining({
            content: 'Edited content',
            isEdited: true,
          }),
        })
      );
    });

    it('rejects edit if requester is not the sender (403)', async () => {
      (prisma.message.findUnique as any).mockResolvedValue({
        id: 'msg-1',
        senderId: 'user-1',
        conversationId: 'conv-1',
        content: 'Original',
        isDeleted: false,
        createdAt: new Date(),
      });

      await expect(
        editMessage({
          messageId: 'msg-1',
          userId: 'user-2', // different user
          newContent: 'Hacked content',
        })
      ).rejects.toThrow('Forbidden: You can only edit your own messages');
    });

    it('rejects edit if message is older than 15 minutes', async () => {
      const now = new Date();
      (prisma.message.findUnique as any).mockResolvedValue({
        id: 'msg-old',
        senderId: 'user-1',
        conversationId: 'conv-1',
        content: 'Old message',
        isDeleted: false,
        createdAt: new Date(now.getTime() - 16 * 60 * 1000), // 16 min ago
      });

      await expect(
        editMessage({
          messageId: 'msg-old',
          userId: 'user-1',
          newContent: 'Too late edit',
        })
      ).rejects.toThrow('Edit time limit expired');
    });

    it('rejects edit on a deleted message', async () => {
      (prisma.message.findUnique as any).mockResolvedValue({
        id: 'msg-del',
        senderId: 'user-1',
        conversationId: 'conv-1',
        content: 'This message was deleted',
        isDeleted: true,
        createdAt: new Date(),
      });

      await expect(
        editMessage({
          messageId: 'msg-del',
          userId: 'user-1',
          newContent: 'Revive deleted message',
        })
      ).rejects.toThrow('Cannot edit a deleted message');
    });
  });

  describe('deleteMessage', () => {
    it('deletes for me by creating a UserDeletedMessage record', async () => {
      (prisma.message.findUnique as any).mockResolvedValue({
        id: 'msg-1',
        senderId: 'user-2',
        conversationId: 'conv-1',
        conversation: {
          type: ConversationType.DIRECT,
          participants: [{ userId: 'user-1', role: ParticipantRole.MEMBER }],
        },
      });

      (prisma.userDeletedMessage.upsert as any).mockResolvedValue({});

      const result = await deleteMessage({
        messageId: 'msg-1',
        userId: 'user-1',
        deleteType: 'FOR_ME',
      });

      expect(result.success).toBe(true);
      expect(result.deleteType).toBe('FOR_ME');
      expect(prisma.userDeletedMessage.upsert).toHaveBeenCalledWith({
        where: {
          userId_messageId: {
            userId: 'user-1',
            messageId: 'msg-1',
          },
        },
        create: { userId: 'user-1', messageId: 'msg-1' },
        update: {},
      });
      // Ensure the message was NOT soft deleted for everyone
      expect(prisma.message.update).not.toHaveBeenCalled();
    });

    it('allows sender to delete for everyone', async () => {
      (prisma.message.findUnique as any).mockResolvedValue({
        id: 'msg-1',
        senderId: 'user-1',
        conversationId: 'conv-1',
        conversation: {
          type: ConversationType.DIRECT,
          participants: [{ userId: 'user-1', role: ParticipantRole.MEMBER }],
        },
      });

      (prisma.message.update as any).mockResolvedValue({
        id: 'msg-1',
        isDeleted: true,
        content: 'This message was deleted',
      });

      const result = await deleteMessage({
        messageId: 'msg-1',
        userId: 'user-1',
        deleteType: 'FOR_EVERYONE',
      });

      expect(result.success).toBe(true);
      expect(result.deleteType).toBe('FOR_EVERYONE');
      expect(prisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'msg-1' },
          data: expect.objectContaining({
            isDeleted: true,
            content: 'This message was deleted',
          }),
        })
      );
    });

    it('allows group ADMIN or OWNER to delete for everyone', async () => {
      (prisma.message.findUnique as any).mockResolvedValue({
        id: 'msg-group',
        senderId: 'user-2',
        conversationId: 'conv-group',
        conversation: {
          type: ConversationType.GROUP,
          participants: [{ userId: 'admin-1', role: ParticipantRole.ADMIN }],
        },
      });

      (prisma.message.update as any).mockResolvedValue({
        id: 'msg-group',
        isDeleted: true,
        content: 'This message was deleted',
      });

      const result = await deleteMessage({
        messageId: 'msg-group',
        userId: 'admin-1',
        deleteType: 'FOR_EVERYONE',
      });

      expect(result.success).toBe(true);
      expect(result.deleteType).toBe('FOR_EVERYONE');
    });

    it('rejects non-sender, non-admin from deleting for everyone (403)', async () => {
      (prisma.message.findUnique as any).mockResolvedValue({
        id: 'msg-group',
        senderId: 'user-2',
        conversationId: 'conv-group',
        conversation: {
          type: ConversationType.GROUP,
          participants: [{ userId: 'user-3', role: ParticipantRole.MEMBER }],
        },
      });

      await expect(
        deleteMessage({
          messageId: 'msg-group',
          userId: 'user-3',
          deleteType: 'FOR_EVERYONE',
        })
      ).rejects.toThrow('Forbidden: You can only delete your own messages for everyone');
    });
  });

  describe('toggleMessageReaction', () => {
    it('adds reaction when not previously reacted', async () => {
      (prisma.message.findUnique as any).mockResolvedValue({
        id: 'msg-1',
        conversationId: 'conv-1',
        conversation: {
          participants: [{ userId: 'user-1' }],
        },
      });

      (prisma.messageReaction.findUnique as any).mockResolvedValue(null);
      (prisma.messageReaction.create as any).mockResolvedValue({
        id: 'rx-1',
        messageId: 'msg-1',
        userId: 'user-1',
        emoji: '👍',
      });
      (prisma.messageReaction.findMany as any).mockResolvedValue([
        { emoji: '👍', userId: 'user-1', user: { displayName: 'Alice' } },
      ]);

      const result = await toggleMessageReaction({
        messageId: 'msg-1',
        userId: 'user-1',
        emoji: '👍',
      });

      expect(result.action).toBe('ADD');
      expect(result.reactions).toHaveLength(1);
      expect(result.reactions[0].emoji).toBe('👍');
      expect(result.reactions[0].count).toBe(1);
      expect(result.reactions[0].hasReacted).toBe(true);
    });

    it('removes reaction when already reacted with same emoji', async () => {
      (prisma.message.findUnique as any).mockResolvedValue({
        id: 'msg-1',
        conversationId: 'conv-1',
        conversation: {
          participants: [{ userId: 'user-1' }],
        },
      });

      (prisma.messageReaction.findUnique as any).mockResolvedValue({
        id: 'rx-1',
        messageId: 'msg-1',
        userId: 'user-1',
        emoji: '❤️',
      });
      (prisma.messageReaction.delete as any).mockResolvedValue({});
      (prisma.messageReaction.findMany as any).mockResolvedValue([]);

      const result = await toggleMessageReaction({
        messageId: 'msg-1',
        userId: 'user-1',
        emoji: '❤️',
      });

      expect(result.action).toBe('REMOVE');
      expect(result.reactions).toHaveLength(0);
      expect(prisma.messageReaction.delete).toHaveBeenCalledWith({
        where: { id: 'rx-1' },
      });
    });

    it('rejects reactions from non-participants (403)', async () => {
      (prisma.message.findUnique as any).mockResolvedValue({
        id: 'msg-1',
        conversationId: 'conv-1',
        conversation: {
          participants: [], // empty -> not participant
        },
      });

      await expect(
        toggleMessageReaction({
          messageId: 'msg-1',
          userId: 'stranger-1',
          emoji: '🔥',
        })
      ).rejects.toThrow('Forbidden: You are not a participant in this conversation');
    });
  });

  describe('pinMessage & unpinMessage', () => {
    it('pins a message in direct chat and respects pin limits', async () => {
      (prisma.conversationParticipant.findUnique as any).mockResolvedValue({
        conversationId: 'conv-1',
        userId: 'user-1',
        role: ParticipantRole.MEMBER,
        conversation: { type: ConversationType.DIRECT },
      });

      (prisma.pinnedMessage.count as any).mockResolvedValue(2);
      (prisma.pinnedMessage.create as any).mockResolvedValue({
        id: 'pin-1',
        conversationId: 'conv-1',
        messageId: 'msg-1',
        pinnedById: 'user-1',
        pinnedAt: new Date(),
        message: {
          content: 'Important info',
          sender: { displayName: 'Alice' },
          attachments: [],
        },
      });

      const pin = await pinMessage({
        conversationId: 'conv-1',
        messageId: 'msg-1',
        userId: 'user-1',
      });

      expect(pin.id).toBe('pin-1');
      expect(prisma.pinnedMessage.create).toHaveBeenCalled();
    });

    it('rejects pinning when maximum pin limit (5) is reached', async () => {
      (prisma.conversationParticipant.findUnique as any).mockResolvedValue({
        conversationId: 'conv-1',
        userId: 'user-1',
        role: ParticipantRole.MEMBER,
        conversation: { type: ConversationType.DIRECT },
      });

      (prisma.pinnedMessage.count as any).mockResolvedValue(5);

      await expect(
        pinMessage({
          conversationId: 'conv-1',
          messageId: 'msg-6',
          userId: 'user-1',
        })
      ).rejects.toThrow('Maximum limit of 5 pinned messages reached');
    });

    it('prevents regular member from pinning in group chat', async () => {
      (prisma.conversationParticipant.findUnique as any).mockResolvedValue({
        conversationId: 'conv-group',
        userId: 'user-1',
        role: ParticipantRole.MEMBER,
        conversation: { type: ConversationType.GROUP },
      });

      await expect(
        pinMessage({
          conversationId: 'conv-group',
          messageId: 'msg-1',
          userId: 'user-1',
        })
      ).rejects.toThrow('Forbidden: Only group admins can pin messages');
    });

    it('unpins a message successfully', async () => {
      (prisma.conversationParticipant.findUnique as any).mockResolvedValue({
        conversationId: 'conv-1',
        userId: 'user-1',
        role: ParticipantRole.MEMBER,
        conversation: { type: ConversationType.DIRECT },
      });

      (prisma.pinnedMessage.deleteMany as any).mockResolvedValue({ count: 1 });

      const result = await unpinMessage({
        conversationId: 'conv-1',
        messageId: 'msg-1',
        userId: 'user-1',
      });

      expect(result.success).toBe(true);
      expect(prisma.pinnedMessage.deleteMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv-1', messageId: 'msg-1' },
      });
    });

    it('lists pinned messages for a participant', async () => {
      (prisma.conversationParticipant.findUnique as any).mockResolvedValue({
        conversationId: 'conv-1',
        userId: 'user-1',
      });

      (prisma.pinnedMessage.findMany as any).mockResolvedValue([
        {
          id: 'pin-1',
          conversationId: 'conv-1',
          messageId: 'msg-1',
          message: { content: 'Pinned item', sender: { displayName: 'Bob' }, attachments: [] },
        },
      ]);

      const pins = await listPinnedMessages('conv-1', 'user-1');
      expect(pins).toHaveLength(1);
      expect(pins[0].message.content).toBe('Pinned item');
    });
  });

  describe('toggleStarMessage & listStarredMessages', () => {
    it('stars an unstarred message', async () => {
      (prisma.message.findUnique as any).mockResolvedValue({
        id: 'msg-1',
        conversation: {
          participants: [{ userId: 'user-1' }],
        },
      });

      (prisma.starredMessage.findUnique as any).mockResolvedValue(null);
      (prisma.starredMessage.create as any).mockResolvedValue({
        id: 'star-1',
        userId: 'user-1',
        messageId: 'msg-1',
      });

      const res = await toggleStarMessage({ messageId: 'msg-1', userId: 'user-1' });
      expect(res.isStarred).toBe(true);
      expect(prisma.starredMessage.create).toHaveBeenCalled();
    });

    it('unstars an already starred message', async () => {
      (prisma.message.findUnique as any).mockResolvedValue({
        id: 'msg-1',
        conversation: {
          participants: [{ userId: 'user-1' }],
        },
      });

      (prisma.starredMessage.findUnique as any).mockResolvedValue({
        id: 'star-1',
        userId: 'user-1',
        messageId: 'msg-1',
      });
      (prisma.starredMessage.delete as any).mockResolvedValue({});

      const res = await toggleStarMessage({ messageId: 'msg-1', userId: 'user-1' });
      expect(res.isStarred).toBe(false);
      expect(prisma.starredMessage.delete).toHaveBeenCalled();
    });

    it('lists starred messages for user', async () => {
      (prisma.starredMessage.findMany as any).mockResolvedValue([
        {
          id: 'star-1',
          message: {
            id: 'msg-1',
            content: 'Favorited quote',
            sender: { displayName: 'Alice' },
            conversation: { id: 'conv-1', title: null, type: ConversationType.DIRECT },
            attachments: [],
          },
        },
      ]);

      const list = await listStarredMessages('user-1');
      expect(list).toHaveLength(1);
      expect(list[0].message.content).toBe('Favorited quote');
    });
  });

  describe('forwardMessage', () => {
    it('forwards message to target conversations with attribution and cloned attachments', async () => {
      (prisma.message.findUnique as any).mockResolvedValue({
        id: 'orig-msg',
        content: 'Check this document',
        type: 'FILE',
        isDeleted: false,
        sender: { displayName: 'Original Sender' },
        attachments: [
          {
            fileName: 'report.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024,
            fileKey: 'key-123',
            fileUrl: 'https://example.com/report.pdf',
            fileType: 'FILE',
          },
        ],
      });

      // Target memberships check
      (prisma.conversationParticipant.findMany as any).mockResolvedValue([
        { conversationId: 'conv-target-1' },
        { conversationId: 'conv-target-2' },
      ]);

      (prisma.message.create as any).mockResolvedValue({
        id: 'fwd-1',
        conversationId: 'conv-target-1',
        senderId: 'user-1',
        content: 'Check this document',
        type: 'FILE',
        isForwarded: true,
        forwardedFrom: 'Original Sender',
        createdAt: new Date(),
        sender: { displayName: 'Forwarder', avatarUrl: null },
        attachments: [],
      });

      (prisma.mediaAttachment.create as any).mockResolvedValue({});
      (prisma.conversation.update as any).mockResolvedValue({});

      const forwarded = await forwardMessage({
        sourceMessageId: 'orig-msg',
        targetConversationIds: ['conv-target-1', 'conv-target-2'],
        senderId: 'user-1',
      });

      expect(forwarded).toHaveLength(2);
      expect(prisma.message.create).toHaveBeenCalledTimes(2);
    });

    it('rejects forward if user is not participant in all target conversations (403)', async () => {
      (prisma.message.findUnique as any).mockResolvedValue({
        id: 'orig-msg',
        content: 'Secret',
        isDeleted: false,
        sender: { displayName: 'Alice' },
        attachments: [],
      });

      // Only member of conv-1, but requested conv-1 and conv-unauthorized
      (prisma.conversationParticipant.findMany as any).mockResolvedValue([
        { conversationId: 'conv-1' },
      ]);

      await expect(
        forwardMessage({
          sourceMessageId: 'orig-msg',
          targetConversationIds: ['conv-1', 'conv-unauthorized'],
          senderId: 'user-1',
        })
      ).rejects.toThrow('Forbidden: You are not a participant in all selected conversations');
    });
  });

  describe('searchMessages', () => {
    it('searches messages across user conversations safely', async () => {
      (prisma.conversationParticipant.findMany as any).mockResolvedValue([
        { conversationId: 'conv-1' },
        { conversationId: 'conv-2' },
      ]);

      (prisma.message.findMany as any).mockResolvedValue([
        {
          id: 'msg-search-1',
          content: 'Found the meeting notes',
          conversationId: 'conv-1',
          sender: { displayName: 'Alice' },
          conversation: { id: 'conv-1', title: 'Work', type: ConversationType.GROUP },
          attachments: [],
        },
      ]);
      (prisma.message.count as any).mockResolvedValue(1);

      const res = await searchMessages({
        userId: 'user-1',
        query: 'meeting',
      });

      expect(res.total).toBe(1);
      expect(res.messages).toHaveLength(1);
      expect(res.messages[0].content).toContain('meeting');
    });

    it('rejects searching in conversation where user is not a member (403)', async () => {
      (prisma.conversationParticipant.findMany as any).mockResolvedValue([
        { conversationId: 'conv-1' },
      ]);

      await expect(
        searchMessages({
          userId: 'user-1',
          query: 'secret',
          conversationId: 'conv-forbidden',
        })
      ).rejects.toThrow('Forbidden: Not a participant in this conversation');
    });
  });
});
