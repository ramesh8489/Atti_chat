import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChatStore } from '../store/chatStore';
import * as apiClient from '../services/apiClient';
import { socketService } from '../services/socketService';

vi.mock('../services/apiClient', () => ({
  fetchConversationsApi: vi.fn(),
  fetchConversationMessagesApi: vi.fn(),
  createDirectConversationApi: vi.fn(),
  createGroupConversationApi: vi.fn(),
  sendMessageApi: vi.fn(),
  markConversationReadApi: vi.fn(),
  searchUsersApi: vi.fn(),
}));

vi.mock('../services/socketService', () => ({
  socketService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    joinConversation: vi.fn(),
    leaveConversation: vi.fn(),
    sendMessage: vi.fn(),
    sendTypingStart: vi.fn(),
    sendTypingStop: vi.fn(),
    markAsRead: vi.fn(),
    onReceiveMessage: vi.fn(() => () => {}),
    onUserOnline: vi.fn(() => () => {}),
    onUserOffline: vi.fn(() => () => {}),
    onTypingStart: vi.fn(() => () => {}),
    onTypingStop: vi.fn(() => () => {}),
    onMessageRead: vi.fn(() => () => {}),
    getSocket: vi.fn(() => null),
  },
}));

describe('ChatStore Real-Time & Messaging Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads conversations from API and selects the first conversation', async () => {
    const mockConversations = [
      {
        id: 'conv-real-1',
        type: 'DIRECT' as const,
        title: 'Deepa',
        unreadCount: 2,
        updatedAt: new Date().toISOString(),
        participants: [],
      },
    ];

    (apiClient.fetchConversationsApi as any).mockResolvedValue(mockConversations);
    (apiClient.fetchConversationMessagesApi as any).mockResolvedValue([]);
    (apiClient.markConversationReadApi as any).mockResolvedValue({ success: true });

    await useChatStore.getState().loadConversations('mock-token');

    expect(useChatStore.getState().conversations).toHaveLength(1);
    expect(useChatStore.getState().activeConversationId).toBe('conv-real-1');
    expect(socketService.joinConversation).toHaveBeenCalledWith('conv-real-1');
  });

  it('creates direct conversation and sets it active', async () => {
    const createdConv = {
      id: 'conv-new-direct',
      type: 'DIRECT' as const,
      title: 'Vikram',
      unreadCount: 0,
      updatedAt: new Date().toISOString(),
      participants: [],
    };

    (apiClient.createDirectConversationApi as any).mockResolvedValue(createdConv);
    (apiClient.fetchConversationMessagesApi as any).mockResolvedValue([]);
    (apiClient.markConversationReadApi as any).mockResolvedValue({ success: true });

    const newId = await useChatStore.getState().createDirectChat('usr-vikram', 'mock-token');

    expect(newId).toBe('conv-new-direct');
    expect(useChatStore.getState().activeConversationId).toBe('conv-new-direct');
    expect(useChatStore.getState().isNewChatModalOpen).toBe(false);
  });

  it('creates group conversation with title and participants', async () => {
    const createdGroup = {
      id: 'conv-group-99',
      type: 'GROUP' as const,
      title: 'Bangalore Trip',
      unreadCount: 0,
      updatedAt: new Date().toISOString(),
      participants: [],
    };

    (apiClient.createGroupConversationApi as any).mockResolvedValue(createdGroup);
    (apiClient.fetchConversationMessagesApi as any).mockResolvedValue([]);
    (apiClient.markConversationReadApi as any).mockResolvedValue({ success: true });

    const groupId = await useChatStore
      .getState()
      .createGroupChat('Bangalore Trip', ['usr-1', 'usr-2'], 'mock-token');

    expect(groupId).toBe('conv-group-99');
    expect(useChatStore.getState().activeConversationId).toBe('conv-group-99');
  });

  it('searches users through API and populates searchedUsers', async () => {
    const mockUsers = [
      {
        id: 'usr-1',
        displayName: 'Priya',
        username: 'priya',
        phoneNumber: '+919876543210',
        isOnline: true,
      },
    ];

    (apiClient.searchUsersApi as any).mockResolvedValue(mockUsers);

    await useChatStore.getState().searchUsers('priya', 'mock-token');

    expect(useChatStore.getState().searchedUsers).toHaveLength(1);
    expect(useChatStore.getState().searchedUsers[0].displayName).toBe('Priya');
  });

  it('sends typing indicators via socketService', () => {
    useChatStore.setState({ activeConversationId: 'conv-real-1' });

    useChatStore.getState().sendTyping(true);
    expect(socketService.sendTypingStart).toHaveBeenCalledWith('conv-real-1');

    useChatStore.getState().sendTyping(false);
    expect(socketService.sendTypingStop).toHaveBeenCalledWith('conv-real-1');
  });
});

