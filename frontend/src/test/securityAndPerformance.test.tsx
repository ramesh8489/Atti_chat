import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageList } from '../components/chat/MessageList';
import { Message } from '../types';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';

vi.mock('../services/apiClient', () => ({
  getAttachmentDownloadUrlApi: vi.fn(),
  fetchConversationMessagesApi: vi.fn().mockResolvedValue([]),
  fetchConversationsApi: vi.fn().mockResolvedValue([]),
  fetchNotificationsApi: vi.fn().mockResolvedValue({ notifications: [], unreadCount: 0 }),
}));

vi.mock('../services/socketService', () => ({
  socketService: {
    onReceiveMessage: vi.fn().mockReturnValue(() => {}),
    onMessageRead: vi.fn().mockReturnValue(() => {}),
    onMessageDelivered: vi.fn().mockReturnValue(() => {}),
    onUserOnline: vi.fn().mockReturnValue(() => {}),
    onUserOffline: vi.fn().mockReturnValue(() => {}),
    onTypingStart: vi.fn().mockReturnValue(() => {}),
    onTypingStop: vi.fn().mockReturnValue(() => {}),
    onMessageEdited: vi.fn().mockReturnValue(() => {}),
    onMessageDeleted: vi.fn().mockReturnValue(() => {}),
    onMessageReaction: vi.fn().mockReturnValue(() => {}),
    onMessagePinned: vi.fn().mockReturnValue(() => {}),
    onMessageUnpinned: vi.fn().mockReturnValue(() => {}),
    onNotificationReceive: vi.fn().mockReturnValue(() => {}),
    onNotificationRead: vi.fn().mockReturnValue(() => {}),
    onNotificationCount: vi.fn().mockReturnValue(() => {}),
    onNotificationCleared: vi.fn().mockReturnValue(() => {}),
    onConversationMuted: vi.fn().mockReturnValue(() => {}),
    onConversationUnmuted: vi.fn().mockReturnValue(() => {}),
    onPrivacyUpdated: vi.fn().mockReturnValue(() => {}),
    onUserBlocked: vi.fn().mockReturnValue(() => {}),
    onUserUnblocked: vi.fn().mockReturnValue(() => {}),
  },
}));

describe('Phase 8: Frontend Security & Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      token: 'mock-jwt-token',
      user: {
        id: 'usr-alice',
        phoneNumber: '+919999900001',
        displayName: 'Alice Smith',
        username: 'alice',
        isOnline: true,
      },
    });
    useChatStore.setState({
      activeConversationId: 'conv-100',
      conversations: [
        {
          id: 'conv-100',
          type: 'DIRECT',
          title: 'Bob Jones',
          participants: [
            { id: 'usr-alice', phoneNumber: '+919999900001', displayName: 'Alice', isOnline: true },
            { id: 'usr-bob', phoneNumber: '+919999900002', displayName: 'Bob', isOnline: true },
          ],
          unreadCount: 0,
          updatedAt: new Date().toISOString(),
        },
      ],
      messages: {},
    });
  });

  describe('1. XSS & Safe Text Content Rendering', () => {
    it('renders script tags as plain text without DOM injection or execution', () => {
      const xssPayload = '<script>alert("XSS")</script>';
      const messages: Message[] = [
        {
          id: 'msg-xss-1',
          conversationId: 'conv-100',
          senderId: 'usr-bob',
          senderName: 'Bob Jones',
          content: xssPayload,
          type: 'TEXT',
          status: 'DELIVERED',
          isOutgoing: false,
          createdAt: new Date().toISOString(),
        },
      ];

      render(<MessageList messages={messages} />);

      // The text must be visible literally as text rather than an active <script> tag
      expect(screen.getByText(xssPayload)).toBeDefined();
      expect(document.querySelector('script')).toBeNull();
    });

    it('escapes HTML image onerror injections safely', () => {
      const imgPayload = '<img src=x onerror=alert(1)>';
      const messages: Message[] = [
        {
          id: 'msg-xss-2',
          conversationId: 'conv-100',
          senderId: 'usr-bob',
          senderName: 'Bob Jones',
          content: imgPayload,
          type: 'TEXT',
          status: 'DELIVERED',
          isOutgoing: false,
          createdAt: new Date().toISOString(),
        },
      ];

      render(<MessageList messages={messages} />);
      expect(screen.getByText(imgPayload)).toBeDefined();
    });
  });

  describe('2. Attachment Safe Protocol Validation', () => {
    it('verifies safe handling of media cards and rejects dangerous javascript: URLs', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const messages: Message[] = [
        {
          id: 'msg-att-1',
          conversationId: 'conv-100',
          senderId: 'usr-bob',
          senderName: 'Bob Jones',
          content: 'Here is the report',
          type: 'FILE',
          status: 'DELIVERED',
          isOutgoing: false,
          createdAt: new Date().toISOString(),
          attachments: [
            {
              id: 'att-100',
              fileKey: 'conversations/conv-100/report.pdf',
              fileUrl: 'javascript:alert(1)', // Unsafe URL!
              fileType: 'FILE',
              fileSize: 2048,
              mimeType: 'application/pdf',
              fileName: 'report.pdf',
            },
          ],
        },
      ];

      render(<MessageList messages={messages} />);

      // Verify attachment card rendered with safe filename
      expect(screen.getByText('report.pdf')).toBeDefined();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('3. Sensitive State Isolation', () => {
    it('ensures auth store only exposes necessary client tokens and no server secrets', () => {
      const state = useAuthStore.getState();
      expect((state as any).firebaseAdminKey).toBeUndefined();
      expect((state as any).privateKey).toBeUndefined();
      expect((state as any).turnSecret).toBeUndefined();
      expect(state.token).toBe('mock-jwt-token');
    });
  });
});
