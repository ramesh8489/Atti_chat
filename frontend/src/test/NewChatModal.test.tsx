import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NewChatModal } from '../components/chat/NewChatModal';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';

vi.mock('../services/apiClient', () => ({
  searchUsersApi: vi.fn().mockResolvedValue([
    {
      id: 'target-1',
      displayName: 'Kavitha',
      username: 'kavitha',
      phoneNumber: '+919876543219',
      isOnline: true,
      firebaseUid: 'target_uid',
      avatarUrl: null,
      bio: null,
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  ]),
  createDirectConversationApi: vi.fn().mockResolvedValue({
    id: 'conv-new-1',
    type: 'DIRECT',
    title: 'Kavitha',
    participants: [],
  }),
  createGroupConversationApi: vi.fn().mockResolvedValue({
    id: 'conv-group-1',
    type: 'GROUP',
    title: 'Test Group',
    participants: [],
  }),
  fetchConversationMessagesApi: vi.fn().mockResolvedValue([]),
  markConversationReadApi: vi.fn().mockResolvedValue({ success: true }),
}));

describe('NewChatModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      token: 'valid-test-token',
      authToken: 'valid-test-token',
      currentUser: {
        id: 'me-1',
        phoneNumber: '+919876543210',
        displayName: 'My Name',
        username: 'myname',
        isOnline: true,
      },
      step: 'AUTHENTICATED',
    });
    useChatStore.setState({
      isNewChatModalOpen: true,
    });
  });

  it('renders modal with Direct Chat and Create Group tabs', () => {
    render(<NewChatModal />);

    expect(screen.getByText('New Conversation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /direct chat/i })).toBeInTheDocument();
  });

  it('displays search results and allows initiating direct chat', async () => {
    render(<NewChatModal />);

    await waitFor(() => {
      expect(screen.getByText('Kavitha')).toBeInTheDocument();
    });

    const chatButton = screen.getByRole('button', { name: /^Chat$/i });
    fireEvent.click(chatButton);

    await waitFor(() => {
      expect(useChatStore.getState().isNewChatModalOpen).toBe(false);
    });
  });

  it('enforces group title requirement on group creation tab', async () => {
    render(<NewChatModal />);

    const tabButtons = screen.getAllByRole('button');
    const groupTab = tabButtons.find((btn) => btn.textContent?.includes('Create Group'));
    expect(groupTab).toBeDefined();
    fireEvent.click(groupTab!);

    expect(screen.getByText('Group Title')).toBeInTheDocument();

    const createButtons = screen.getAllByRole('button', { name: /create group/i });
    // The submit action button is at the bottom
    const submitBtn = createButtons[createButtons.length - 1];
    expect(submitBtn).toBeDisabled();
  });
});
