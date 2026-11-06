import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { NotificationBell } from '../components/notifications/NotificationBell';
import { NotificationCenterDrawer } from '../components/notifications/NotificationCenterDrawer';
import { SettingsModal } from '../components/settings/SettingsModal';
import { ConversationItem } from '../components/chat/ConversationItem';
import { ChatHeader } from '../components/chat/ChatHeader';
import { Conversation } from '../types';

vi.mock('../services/apiClient', () => ({
  fetchNotificationsApi: vi.fn().mockResolvedValue({ notifications: [], unreadCount: 0 }),
  fetchUnreadNotificationCountApi: vi.fn().mockResolvedValue(0),
  markNotificationReadApi: vi.fn().mockResolvedValue({ success: true }),
  markAllNotificationsReadApi: vi.fn().mockResolvedValue({ success: true }),
  deleteNotificationApi: vi.fn().mockResolvedValue({ success: true }),
  clearAllNotificationsApi: vi.fn().mockResolvedValue({ success: true }),
  fetchNotificationPreferencesApi: vi.fn().mockResolvedValue({}),
  updateNotificationPreferencesApi: vi.fn().mockImplementation((_token, prefs) => Promise.resolve(prefs)),
  fetchPrivacySettingsApi: vi.fn().mockResolvedValue({}),
  updatePrivacySettingsApi: vi.fn().mockImplementation((_token, privacy) => Promise.resolve(privacy)),
  fetchBlockedUsersApi: vi.fn().mockResolvedValue([]),
  blockUserApi: vi.fn().mockResolvedValue({ success: true }),
  unblockUserApi: vi.fn().mockResolvedValue({ success: true }),
  muteConversationApi: vi.fn().mockResolvedValue({ success: true }),
  unmuteConversationApi: vi.fn().mockResolvedValue({ success: true }),
  fetchMutedConversationIdsApi: vi.fn().mockResolvedValue([]),
  fetchConversationMessagesApi: vi.fn().mockResolvedValue([]),
  fetchConversationsApi: vi.fn().mockResolvedValue([]),
  markConversationReadApi: vi.fn().mockResolvedValue({ success: true }),
  fetchVapidPublicKeyApi: vi.fn().mockResolvedValue('BMockVapidKey'),
  subscribePushApi: vi.fn().mockResolvedValue({ success: true }),
  unsubscribePushApi: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../services/socketService', () => ({
  socketService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    joinConversation: vi.fn(),
    leaveConversation: vi.fn(),
    markAsRead: vi.fn(),
    onReceiveMessage: vi.fn().mockReturnValue(() => {}),
    onMessageEdited: vi.fn().mockReturnValue(() => {}),
    onMessageDeleted: vi.fn().mockReturnValue(() => {}),
    onMessageReaction: vi.fn().mockReturnValue(() => {}),
    onMessagePinned: vi.fn().mockReturnValue(() => {}),
    onMessageUnpinned: vi.fn().mockReturnValue(() => {}),
    onUserOnline: vi.fn().mockReturnValue(() => {}),
    onUserOffline: vi.fn().mockReturnValue(() => {}),
    onTypingStart: vi.fn().mockReturnValue(() => {}),
    onTypingStop: vi.fn().mockReturnValue(() => {}),
    onMessageRead: vi.fn().mockReturnValue(() => {}),
    onNotificationReceive: vi.fn().mockReturnValue(() => {}),
    onNotificationRead: vi.fn().mockReturnValue(() => {}),
    onNotificationCount: vi.fn().mockReturnValue(() => {}),
    onNotificationCleared: vi.fn().mockReturnValue(() => {}),
    onConversationMuted: vi.fn().mockReturnValue(() => {}),
    onConversationUnmuted: vi.fn().mockReturnValue(() => {}),
    onPrivacyUpdated: vi.fn().mockReturnValue(() => {}),
    onUserBlocked: vi.fn().mockReturnValue(() => {}),
    onUserUnblocked: vi.fn().mockReturnValue(() => {}),
    muteConversationSocket: vi.fn().mockResolvedValue({ success: true }),
    unmuteConversationSocket: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('Phase 7: Notifications & Privacy Frontend Tests', () => {
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
      notifications: [
        {
          id: 'notif-1',
          userId: 'usr-alice',
          actorId: 'usr-bob',
          actorName: 'Bob Jones',
          conversationId: 'conv-100',
          conversationTitle: 'Direct Chat',
          type: 'DIRECT_MESSAGE',
          title: 'Bob Jones',
          body: 'Hello Alice, see you tomorrow!',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'notif-2',
          userId: 'usr-alice',
          actorId: 'usr-carol',
          actorName: 'Carol White',
          conversationId: 'conv-200',
          conversationTitle: 'Design Team',
          type: 'GROUP_MESSAGE',
          title: 'Design Team',
          body: 'Carol: Uploaded the new mocks.',
          isRead: true,
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
      ],
      unreadNotificationCount: 1,
      isNotificationDrawerOpen: false,
      isSettingsModalOpen: false,
      activeSettingsTab: 'notifications',
      notificationPreferences: {
        userId: 'usr-alice',
        directMessages: true,
        groupMessages: true,
        callIncoming: true,
        callMissed: true,
        pushEnabled: true,
        soundEnabled: true,
        showPreview: true,
      },
      privacySettings: {
        userId: 'usr-alice',
        lastSeenVisibility: 'EVERYONE',
        onlineStatusVisibility: 'EVERYONE',
        profilePhotoVisibility: 'EVERYONE',
        aboutVisibility: 'EVERYONE',
        readReceipts: true,
        typingIndicator: true,
      },
      blockedUsers: [
        {
          id: 'blk-1',
          blockedId: 'usr-spammer',
          blockedAt: new Date().toISOString(),
          user: {
            id: 'usr-spammer',
            displayName: 'Spam Bot',
            username: 'spambot',
          },
        },
      ],
      mutedConversationIds: ['conv-muted-1'],
    });
  });

  describe('1. NotificationBell Component', () => {
    it('renders notification bell with unread count badge', () => {
      render(<NotificationBell />);

      const bellBtn = screen.getByRole('button', { name: /notifications/i });
      expect(bellBtn).toBeDefined();

      const badge = screen.getByTestId('notification-badge');
      expect(badge.textContent).toBe('1');
    });

    it('toggles notification drawer on bell click', () => {
      render(<NotificationBell />);

      const bellBtn = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(bellBtn);

      expect(useChatStore.getState().isNotificationDrawerOpen).toBe(true);
    });
  });

  describe('2. NotificationCenterDrawer Component', () => {
    it('renders notification items and allows marking as read', async () => {
      useChatStore.setState({ isNotificationDrawerOpen: true });

      render(<NotificationCenterDrawer />);

      expect(screen.getByText('Notification Center')).toBeDefined();
      expect(screen.getByText('Bob Jones')).toBeDefined();
      expect(screen.getByText(/Hello Alice, see you tomorrow!/)).toBeDefined();

      // Filter by Unread
      const unreadTab = screen.getByRole('button', { name: /unread/i });
      fireEvent.click(unreadTab);

      expect(screen.getByText('Bob Jones')).toBeDefined();
      expect(screen.queryByText('Design Team')).toBeNull();

      // Click on notification item to mark as read
      const notifItem = screen.getByText('Bob Jones');
      fireEvent.click(notifItem);

      await waitFor(() => {
        const notif = useChatStore.getState().notifications.find((n) => n.id === 'notif-1');
        expect(notif?.isRead).toBe(true);
      });
    });

    it('clears all notifications when clear button is clicked', async () => {
      useChatStore.setState({ isNotificationDrawerOpen: true });

      render(<NotificationCenterDrawer />);

      const clearBtn = screen.getByTitle('Clear all notifications');
      fireEvent.click(clearBtn);

      await waitFor(() => {
        expect(useChatStore.getState().notifications).toHaveLength(0);
        expect(useChatStore.getState().unreadNotificationCount).toBe(0);
      });
    });
  });

  describe('3. SettingsModal Component', () => {
    it('renders notification preferences and toggles setting', async () => {
      useChatStore.setState({ isSettingsModalOpen: true, activeSettingsTab: 'notifications' });

      render(<SettingsModal />);

      expect(screen.getByText('Notification Alerts')).toBeDefined();
      expect(screen.getByText('Direct Messages')).toBeDefined();
      expect(screen.getByText('Browser Push Notifications')).toBeDefined();

      const dmCheckbox = screen.getAllByRole('checkbox')[0] as HTMLInputElement;
      expect(dmCheckbox.checked).toBe(true);

      fireEvent.click(dmCheckbox);

      await waitFor(() => {
        expect(useChatStore.getState().notificationPreferences?.directMessages).toBe(false);
      });
    });

    it('switches to privacy tab and updates visibility settings', async () => {
      useChatStore.setState({ isSettingsModalOpen: true, activeSettingsTab: 'privacy' });

      render(<SettingsModal />);

      expect(screen.getByText('Visibility Controls')).toBeDefined();
      expect(screen.getByText('Last Seen Visibility')).toBeDefined();

      const lastSeenSelect = screen.getByLabelText(/Last Seen Visibility/i) as HTMLSelectElement;
      expect(lastSeenSelect.value).toBe('EVERYONE');

      fireEvent.change(lastSeenSelect, { target: { value: 'NOBODY' } });

      await waitFor(() => {
        expect(useChatStore.getState().privacySettings?.lastSeenVisibility).toBe('NOBODY');
      });
    });

    it('switches to blocked tab and unblocks a user', async () => {
      useChatStore.setState({ isSettingsModalOpen: true, activeSettingsTab: 'blocked' });

      render(<SettingsModal />);

      expect(screen.getByText('Spam Bot')).toBeDefined();

      const unblockBtn = screen.getByRole('button', { name: /unblock/i });
      fireEvent.click(unblockBtn);

      await waitFor(() => {
        expect(useChatStore.getState().blockedUsers).toHaveLength(0);
      });
    });
  });

  describe('4. Mute Status & Context Controls', () => {
    it('displays muted bell icon on ConversationItem when conversation is muted', () => {
      const mutedConv: Conversation = {
        id: 'conv-muted-1',
        type: 'DIRECT',
        title: 'Muted User',
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
        participants: [{ id: 'user-2', displayName: 'Muted User', isOnline: false }],
        isMuted: true,
      };

      render(
        <ConversationItem
          conversation={mutedConv}
          isActive={false}
          onClick={() => {}}
        />
      );

      const mutedIcon = screen.getByTestId('conversation-muted-icon');
      expect(mutedIcon).toBeDefined();
    });

    it('renders ChatHeader with mute and options menu', () => {
      const activeConv: Conversation = {
        id: 'conv-active-1',
        type: 'DIRECT',
        title: 'Bob Jones',
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
        participants: [
          { id: 'usr-alice', displayName: 'Alice Smith', isOnline: true },
          { id: 'usr-bob', displayName: 'Bob Jones', isOnline: true },
        ],
      };

      render(<ChatHeader conversation={activeConv} />);

      expect(screen.getByText('Bob Jones')).toBeDefined();

      // Open Options Menu
      const moreBtn = screen.getByLabelText('Options');
      fireEvent.click(moreBtn);

      expect(screen.getByText('Mute for 8 hours')).toBeDefined();
      expect(screen.getByText('Block user')).toBeDefined();
    });
  });
});
