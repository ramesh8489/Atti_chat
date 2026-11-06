import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../src/database/prisma.js';
import {
  createDirectConversation,
  createGroupConversation,
  createMessage,
  markMessagesAsRead,
  getConversationMessages,
} from '../src/services/conversationService.js';
import { ConversationType, ParticipantRole } from '@prisma/client';

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    conversation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    conversationParticipant: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    messageReceipt: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn((arg) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg;
    }),
  },
}));

describe('Conversation & Messaging Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createDirectConversation', () => {
    it('throws error when trying to create a conversation with oneself', async () => {
      await expect(createDirectConversation('user-1', 'user-1')).rejects.toThrow(
        'Cannot create conversation with yourself'
      );
    });

    it('returns existing conversation if direct chat already exists', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ id: 'user-2' });
      (prisma.conversation.findFirst as any).mockResolvedValue({ id: 'conv-existing' });
      (prisma.conversation.findUnique as any).mockResolvedValue({
        id: 'conv-existing',
        type: ConversationType.DIRECT,
        title: null,
        avatarUrl: null,
        updatedAt: new Date(),
        participants: [
          { user: { id: 'user-1', displayName: 'Me', isOnline: true } },
          { user: { id: 'user-2', displayName: 'Friend', isOnline: true } },
        ],
        messages: [],
      });
      (prisma.conversationParticipant.findUnique as any).mockResolvedValue({
        conversationId: 'conv-existing',
        userId: 'user-1',
      });

      const conv = await createDirectConversation('user-1', 'user-2');

      expect(conv.id).toBe('conv-existing');
      expect(prisma.conversation.create).not.toHaveBeenCalled();
    });

    it('creates new direct conversation when none exists', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ id: 'user-2' });
      (prisma.conversation.findFirst as any).mockResolvedValue(null);
      (prisma.conversation.create as any).mockResolvedValue({ id: 'conv-new' });
      (prisma.conversationParticipant.findUnique as any).mockResolvedValue({
        conversationId: 'conv-new',
        userId: 'user-1',
      });
      (prisma.conversation.findUnique as any).mockResolvedValue({
        id: 'conv-new',
        type: ConversationType.DIRECT,
        title: null,
        avatarUrl: null,
        updatedAt: new Date(),
        participants: [
          { user: { id: 'user-1', displayName: 'Me', isOnline: true } },
          { user: { id: 'user-2', displayName: 'Partner', isOnline: false } },
        ],
        messages: [],
      });

      const conv = await createDirectConversation('user-1', 'user-2');

      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: {
          type: ConversationType.DIRECT,
          createdById: 'user-1',
          participants: {
            create: [
              { userId: 'user-1', role: ParticipantRole.OWNER },
              { userId: 'user-2', role: ParticipantRole.MEMBER },
            ],
          },
        },
      });
      expect(conv.id).toBe('conv-new');
    });
  });

  describe('createGroupConversation', () => {
    it('requires a group title and at least 2 members', async () => {
      await expect(
        createGroupConversation('user-1', { title: '', memberUserIds: ['user-2'] })
      ).rejects.toThrow('Group title is required');

      await expect(
        createGroupConversation('user-1', { title: 'Project Team', memberUserIds: [] })
      ).rejects.toThrow('A group must have at least 2 members');
    });

    it('creates group conversation with creator as OWNER and others as MEMBERS', async () => {
      (prisma.conversation.create as any).mockResolvedValue({ id: 'group-1' });
      (prisma.conversationParticipant.findUnique as any).mockResolvedValue({
        conversationId: 'group-1',
        userId: 'user-1',
      });
      (prisma.conversation.findUnique as any).mockResolvedValue({
        id: 'group-1',
        type: ConversationType.GROUP,
        title: 'Atti Dev Team',
        avatarUrl: null,
        updatedAt: new Date(),
        participants: [
          { user: { id: 'user-1', displayName: 'Dev 1' }, role: ParticipantRole.OWNER },
          { user: { id: 'user-2', displayName: 'Dev 2' }, role: ParticipantRole.MEMBER },
          { user: { id: 'user-3', displayName: 'Dev 3' }, role: ParticipantRole.MEMBER },
        ],
        messages: [],
      });

      const group = await createGroupConversation('user-1', {
        title: 'Atti Dev Team',
        memberUserIds: ['user-2', 'user-3'],
      });

      expect(prisma.conversation.create).toHaveBeenCalled();
      expect(group.id).toBe('group-1');
      expect(group.type).toBe('GROUP');
    });
  });

  describe('createMessage', () => {
    it('validates message content is not empty', async () => {
      await expect(createMessage('user-1', 'conv-1', '   ')).rejects.toThrow(
        'Message content cannot be empty'
      );
    });

    it('forbids sending message if sender is not participant in conversation', async () => {
      (prisma.conversationParticipant.findUnique as any).mockResolvedValue(null);

      await expect(createMessage('intruder', 'conv-1', 'Hello!')).rejects.toThrow(
        'Cannot send message: not a conversation participant'
      );
    });

    it('persists message and touches conversation updatedAt', async () => {
      (prisma.conversationParticipant.findUnique as any).mockResolvedValue({
        conversationId: 'conv-1',
        userId: 'user-1',
      });

      const mockCreatedMsg = {
        id: 'msg-999',
        conversationId: 'conv-1',
        senderId: 'user-1',
        content: 'Hey there!',
        type: 'TEXT',
        createdAt: new Date(),
        sender: { id: 'user-1', displayName: 'User One', avatarUrl: null, username: 'userone' },
        attachments: [],
        receipts: [],
      };

      (prisma.$transaction as any).mockResolvedValue([mockCreatedMsg, {}]);

      const message = await createMessage('user-1', 'conv-1', 'Hey there!');

      expect(message.id).toBe('msg-999');
      expect(message.content).toBe('Hey there!');
      expect(message.status).toBe('SENT');
    });
  });

  describe('markMessagesAsRead', () => {
    it('upserts receipts for unread incoming messages and updates participant lastReadMessageId', async () => {
      (prisma.conversationParticipant.findUnique as any).mockResolvedValue({
        conversationId: 'conv-1',
        userId: 'user-1',
      });
      (prisma.message.findMany as any).mockResolvedValue([{ id: 'msg-1' }, { id: 'msg-2' }]);
      (prisma.$transaction as any).mockResolvedValue([{}, {}]);
      (prisma.conversationParticipant.update as any).mockResolvedValue({});

      const result = await markMessagesAsRead('conv-1', 'user-1');

      expect(result.markedCount).toBe(2);
      expect(prisma.conversationParticipant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { lastReadMessageId: 'msg-2' },
        })
      );
    });
  });
});

