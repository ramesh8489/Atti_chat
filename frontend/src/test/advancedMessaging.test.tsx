import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useChatStore } from '../store/chatStore';
import { MessageInput } from '../components/chat/MessageInput';
import { PinnedMessagesBar } from '../components/chat/PinnedMessagesBar';
import { ForwardMessageModal } from '../components/chat/ForwardMessageModal';

describe('Phase 6: Advanced Messaging Frontend Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
      conversations: [
        {
          id: 'conv-preview-1',
          type: 'DIRECT',
          title: 'Alice Bob',
          unreadCount: 0,
          updatedAt: new Date().toISOString(),
          participants: [
            { id: 'user-alice', displayName: 'Alice', isOnline: true },
            { id: 'user-me', displayName: 'Me', isOnline: true },
          ],
        },
        {
          id: 'conv-preview-2',
          type: 'GROUP',
          title: 'Project Alpha',
          unreadCount: 0,
          updatedAt: new Date().toISOString(),
          participants: [
            { id: 'user-alice', displayName: 'Alice', isOnline: true },
            { id: 'user-me', displayName: 'Me', isOnline: true },
          ],
        },
      ],
      activeConversationId: 'conv-preview-1',
      messages: {
        'conv-preview-1': [
          {
            id: 'msg-1',
            conversationId: 'conv-preview-1',
            senderId: 'user-alice',
            senderName: 'Alice',
            content: 'Hello, are we ready for the release?',
            type: 'TEXT',
            createdAt: new Date().toISOString(),
            status: 'READ',
            isOutgoing: false,
            isPreview: true,
          },
          {
            id: 'msg-2',
            conversationId: 'conv-preview-1',
            senderId: 'user-me',
            senderName: 'Me',
            content: 'Yes, almost done with the tests.',
            type: 'TEXT',
            createdAt: new Date().toISOString(),
            status: 'SENT',
            isOutgoing: true,
            isPreview: true,
          },
        ],
      },
      replyingToMessage: null,
      editingMessage: null,
      pinnedMessages: {},
      isForwardDialogOpen: false,
      forwardingMessage: null,
      isSearchDrawerOpen: false,
      isStarredViewOpen: false,
      messageSearchQuery: '',
      messageSearchResults: [],
    });
  });

  describe('Reply to Messages', () => {
    it('displays replying banner in MessageInput and clears on cancel', () => {
      const targetMsg = useChatStore.getState().messages['conv-preview-1'][0];
      useChatStore.getState().setReplyingToMessage(targetMsg);

      render(<MessageInput />);

      expect(screen.getByText(/Replying to Alice/i)).toBeInTheDocument();
      expect(screen.getByText(/Hello, are we ready for the release\?/i)).toBeInTheDocument();

      const cancelBtn = screen.getByLabelText(/Cancel reply/i);
      fireEvent.click(cancelBtn);

      expect(useChatStore.getState().replyingToMessage).toBeNull();
    });

    it('sends reply message with replyTo reference in preview mode', async () => {
      const targetMsg = useChatStore.getState().messages['conv-preview-1'][0];
      useChatStore.getState().setReplyingToMessage(targetMsg);

      await useChatStore.getState().sendMessage('I am replying now!');

      const updatedMessages = useChatStore.getState().messages['conv-preview-1'];
      const lastMsg = updatedMessages[updatedMessages.length - 1];

      expect(lastMsg.content).toBe('I am replying now!');
      expect(lastMsg.replyToId).toBe('msg-1');
      expect(lastMsg.replyTo?.senderName).toBe('Alice');
      expect(useChatStore.getState().replyingToMessage).toBeNull();
    });
  });

  describe('Edit Messages', () => {
    it('activates editing mode in MessageInput and saves edit', async () => {
      const ownMsg = useChatStore.getState().messages['conv-preview-1'][1];
      useChatStore.getState().setEditingMessage(ownMsg);

      render(<MessageInput />);

      expect(screen.getByText(/Editing message/i)).toBeInTheDocument();
      const textarea = screen.getByPlaceholderText(/Edit message\.\.\./i) as HTMLTextAreaElement;
      expect(textarea.value).toBe('Yes, almost done with the tests.');

      // Modify content and click save
      fireEvent.change(textarea, { target: { value: 'Yes, tests are 100% complete!' } });
      const saveBtn = screen.getByLabelText(/Save changes/i);
      fireEvent.click(saveBtn);

      await waitFor(() => {
        const updatedMessages = useChatStore.getState().messages['conv-preview-1'];
        const edited = updatedMessages.find((m) => m.id === 'msg-2');
        expect(edited?.content).toBe('Yes, tests are 100% complete!');
        expect(edited?.isEdited).toBe(true);
        expect(useChatStore.getState().editingMessage).toBeNull();
      });
    });
  });

  describe('Delete Messages', () => {
    it('deletes for me removes message from local list', async () => {
      await useChatStore.getState().deleteMessage('msg-1', 'FOR_ME');

      const updated = useChatStore.getState().messages['conv-preview-1'];
      expect(updated.find((m) => m.id === 'msg-1')).toBeUndefined();
    });

    it('deletes for everyone soft-deletes message with placeholder', async () => {
      await useChatStore.getState().deleteMessage('msg-2', 'FOR_EVERYONE');

      const updated = useChatStore.getState().messages['conv-preview-1'];
      const deleted = updated.find((m) => m.id === 'msg-2');
      expect(deleted?.isDeleted).toBe(true);
      expect(deleted?.content).toBe('This message was deleted');
    });
  });

  describe('Message Reactions', () => {
    it('adds and removes reactions via toggleReaction', async () => {
      await useChatStore.getState().toggleReaction('msg-1', '❤️');

      let msg = useChatStore.getState().messages['conv-preview-1'].find((m) => m.id === 'msg-1');
      expect(msg?.reactions).toHaveLength(1);
      expect(msg?.reactions?.[0].emoji).toBe('❤️');
      expect(msg?.reactions?.[0].count).toBe(1);
      expect(msg?.reactions?.[0].hasReacted).toBe(true);

      // Toggle again to remove
      await useChatStore.getState().toggleReaction('msg-1', '❤️');
      msg = useChatStore.getState().messages['conv-preview-1'].find((m) => m.id === 'msg-1');
      expect(msg?.reactions).toHaveLength(0);
    });
  });

  describe('Pinned and Starred Messages', () => {
    it('pins a message and displays in PinnedMessagesBar', async () => {
      await useChatStore.getState().pinMessage('conv-preview-1', 'msg-1');

      const pins = useChatStore.getState().pinnedMessages['conv-preview-1'];
      expect(pins).toHaveLength(1);
      expect(pins[0].messageId).toBe('msg-1');

      render(<PinnedMessagesBar />);

      expect(screen.getByText(/Pinned Message/i)).toBeInTheDocument();
      expect(screen.getByText(/Hello, are we ready for the release\?/i)).toBeInTheDocument();

      // Unpin
      const unpinBtn = screen.getByLabelText(/Unpin message/i);
      fireEvent.click(unpinBtn);

      expect(useChatStore.getState().pinnedMessages['conv-preview-1']).toHaveLength(0);
    });

    it('toggles star on a message', async () => {
      await useChatStore.getState().toggleStarMessage('msg-1');
      let msg = useChatStore.getState().messages['conv-preview-1'].find((m) => m.id === 'msg-1');
      expect(msg?.isStarred).toBe(true);

      await useChatStore.getState().toggleStarMessage('msg-1');
      msg = useChatStore.getState().messages['conv-preview-1'].find((m) => m.id === 'msg-1');
      expect(msg?.isStarred).toBe(false);
    });
  });

  describe('Forward Messages', () => {
    it('opens forward modal and forwards message to destination chat', async () => {
      const sourceMsg = useChatStore.getState().messages['conv-preview-1'][0];
      useChatStore.getState().openForwardDialog(sourceMsg);

      render(<ForwardMessageModal />);

      expect(screen.getByText(/Forward Message/i)).toBeInTheDocument();
      expect(screen.getByText(/Project Alpha/i)).toBeInTheDocument();

      // Forward directly via store
      await useChatStore.getState().forwardMessage(['conv-preview-2']);

      const targetList = useChatStore.getState().messages['conv-preview-2'] || [];
      expect(targetList).toHaveLength(1);
      expect(targetList[0].content).toBe('Hello, are we ready for the release?');
      expect(targetList[0].isForwarded).toBe(true);
      expect(targetList[0].forwardedFrom).toBe('Alice');
      expect(useChatStore.getState().isForwardDialogOpen).toBe(false);
    });
  });

  describe('Search Messages', () => {
    it('searches messages matching query term in preview mode', async () => {
      await useChatStore.getState().searchMessages('release', undefined, 'conv-preview-1');

      const results = useChatStore.getState().messageSearchResults;
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('release');
    });
  });
});
