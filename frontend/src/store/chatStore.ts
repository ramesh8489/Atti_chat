import { create } from 'zustand';
import {
  Conversation,
  Message,
  ActiveFilterTab,
  MessageType,
  MediaAttachment,
  PinnedMessageItem,
  StarredMessageItem,
  NotificationItem,
  NotificationPreference,
  PrivacySetting,
  BlockedUser,
} from '../types';
import { PREVIEW_CONVERSATIONS, PREVIEW_MESSAGES } from '../data/previewData';
import { socketService } from '../services/socketService';
import {
  fetchConversationsApi,
  fetchConversationMessagesApi,
  createDirectConversationApi,
  createGroupConversationApi,
  sendMessageApi,
  markConversationReadApi,
  searchUsersApi,
  requestAttachmentPresignApi,
  uploadAttachmentFile,
  confirmAttachmentUploadApi,
  editMessageApi,
  deleteMessageApi,
  toggleReactionApi,
  pinMessageApi,
  unpinMessageApi,
  fetchPinnedMessagesApi,
  toggleStarMessageApi,
  fetchStarredMessagesApi,
  forwardMessageApi,
  searchMessagesApi,
  fetchNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  deleteNotificationApi,
  clearAllNotificationsApi,
  fetchNotificationPreferencesApi,
  updateNotificationPreferencesApi,
  fetchVapidPublicKeyApi,
  subscribePushApi,
  fetchPrivacySettingsApi,
  updatePrivacySettingsApi,
  fetchBlockedUsersApi,
  blockUserApi,
  unblockUserApi,
  muteConversationApi,
  unmuteConversationApi,
  fetchMutedConversationIdsApi,
  ApiUser,
} from '../services/apiClient';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  searchQuery: string;
  activeTab: ActiveFilterTab;
  isMobileChatOpen: boolean;
  isCallModalOpen: boolean;
  callType: 'AUDIO' | 'VIDEO' | null;

  // Real-time state
  onlineUsers: Set<string>;
  typingMap: Record<string, { userId: string; userName?: string }>;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;

  // New Chat / Search state
  isNewChatModalOpen: boolean;
  isSearchingUsers: boolean;
  searchedUsers: ApiUser[];

  // Attachment / Upload state
  isUploadingAttachment: boolean;
  uploadProgress: number;
  uploadError: string | null;
  setUploadError: (err: string | null) => void;
  uploadAndSendAttachment: (
    file: File,
    caption?: string,
    token?: string,
    currentUserId?: string
  ) => Promise<void>;

  // Phase 6: Advanced Messaging state
  replyingToMessage: Message | null;
  editingMessage: Message | null;
  pinnedMessages: Record<string, PinnedMessageItem[]>;
  starredMessages: StarredMessageItem[];
  isStarredViewOpen: boolean;
  forwardingMessage: Message | null;
  isForwardDialogOpen: boolean;
  messageSearchQuery: string;
  isSearchingMessages: boolean;
  messageSearchResults: any[];
  isSearchDrawerOpen: boolean;

  // Phase 6 actions
  setReplyingToMessage: (msg: Message | null) => void;
  setEditingMessage: (msg: Message | null) => void;
  submitEditMessage: (messageId: string, newContent: string, token?: string) => Promise<void>;
  deleteMessage: (messageId: string, deleteType: 'FOR_ME' | 'FOR_EVERYONE', token?: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string, token?: string, currentUserId?: string) => Promise<void>;
  pinMessage: (conversationId: string, messageId: string, token?: string) => Promise<void>;
  unpinMessage: (conversationId: string, messageId: string, token?: string) => Promise<void>;
  loadPinnedMessages: (conversationId: string, token?: string) => Promise<void>;
  toggleStarMessage: (messageId: string, token?: string) => Promise<void>;
  loadStarredMessages: (token?: string) => Promise<void>;
  openForwardDialog: (message: Message) => void;
  closeForwardDialog: () => void;
  forwardMessage: (targetConversationIds: string[], token?: string) => Promise<void>;
  searchMessages: (query: string, token?: string, conversationId?: string) => Promise<void>;
  clearMessageSearch: () => void;
  setIsStarredViewOpen: (isOpen: boolean) => void;
  setIsSearchDrawerOpen: (isOpen: boolean) => void;

  // Phase 7: Notifications & Privacy state
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  notificationPreferences: NotificationPreference | null;
  privacySettings: PrivacySetting | null;
  blockedUsers: BlockedUser[];
  mutedConversationIds: string[];
  isNotificationDrawerOpen: boolean;
  isSettingsModalOpen: boolean;
  activeSettingsTab: 'notifications' | 'privacy' | 'blocked';

  // Phase 7 actions
  setIsNotificationDrawerOpen: (isOpen: boolean) => void;
  setIsSettingsModalOpen: (isOpen: boolean, tab?: 'notifications' | 'privacy' | 'blocked') => void;
  setActiveSettingsTab: (tab: 'notifications' | 'privacy' | 'blocked') => void;
  loadNotifications: (token: string, options?: { limit?: number; offset?: number; unreadOnly?: boolean }) => Promise<void>;
  markNotificationRead: (notificationId: string, token: string) => Promise<void>;
  markAllNotificationsRead: (token: string) => Promise<void>;
  removeNotification: (notificationId: string, token: string) => Promise<void>;
  clearAllNotifications: (token: string) => Promise<void>;
  loadNotificationPreferences: (token: string) => Promise<void>;
  updateNotificationPreferences: (preferences: Partial<NotificationPreference>, token: string) => Promise<void>;
  loadPrivacySettings: (token: string) => Promise<void>;
  updatePrivacySettings: (settings: Partial<PrivacySetting>, token: string) => Promise<void>;
  loadBlockedUsers: (token: string) => Promise<void>;
  blockUser: (targetUserId: string, token: string) => Promise<void>;
  unblockUser: (targetUserId: string, token: string) => Promise<void>;
  muteConversation: (conversationId: string, durationHours: number | undefined, token: string) => Promise<void>;
  unmuteConversation: (conversationId: string, token: string) => Promise<void>;
  loadMutedConversations: (token: string) => Promise<void>;
  registerPushNotifications: (token: string) => Promise<boolean>;

  // Actions
  setActiveConversationId: (id: string | null, token?: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setActiveTab: (tab: ActiveFilterTab) => void;
  setIsMobileChatOpen: (isOpen: boolean) => void;
  openCallModal: (type: 'AUDIO' | 'VIDEO') => void;
  closeCallModal: () => void;
  setIsNewChatModalOpen: (isOpen: boolean) => void;

  // Real-time lifecycle
  initRealtime: (token: string, currentUserId: string) => Promise<void>;
  cleanupRealtime: () => void;
  loadConversations: (token: string) => Promise<void>;

  // Messaging actions
  sendMessage: (content: string, token?: string, currentUserId?: string) => Promise<void>;
  sendTyping: (isTyping: boolean) => void;
  createDirectChat: (targetUserId: string, token: string) => Promise<string>;
  createGroupChat: (title: string, memberUserIds: string[], token: string, avatarUrl?: string) => Promise<string>;
  searchUsers: (query: string, token: string) => Promise<void>;
}

let socketUnsubscribers: Array<() => void> = [];

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: PREVIEW_CONVERSATIONS,
  activeConversationId: 'conv-preview-1',
  messages: PREVIEW_MESSAGES,
  searchQuery: '',
  activeTab: 'all',
  isMobileChatOpen: false,
  isCallModalOpen: false,
  callType: null,

  onlineUsers: new Set<string>(),
  typingMap: {},
  isLoadingConversations: false,
  isLoadingMessages: false,

  isNewChatModalOpen: false,
  isSearchingUsers: false,
  searchedUsers: [],

  isUploadingAttachment: false,
  uploadProgress: 0,
  uploadError: null,
  setUploadError: (err) => set({ uploadError: err }),

  // Phase 6 initial state
  replyingToMessage: null,
  editingMessage: null,
  pinnedMessages: {},
  starredMessages: [],
  isStarredViewOpen: false,
  forwardingMessage: null,
  isForwardDialogOpen: false,
  messageSearchQuery: '',
  isSearchingMessages: false,
  messageSearchResults: [],
  isSearchDrawerOpen: false,

  setReplyingToMessage: (msg) => set({ replyingToMessage: msg, editingMessage: null }),
  setEditingMessage: (msg) => set({ editingMessage: msg, replyingToMessage: null }),
  setIsStarredViewOpen: (isOpen) => set({ isStarredViewOpen: isOpen }),
  setIsSearchDrawerOpen: (isOpen) => set({ isSearchDrawerOpen: isOpen }),
  openForwardDialog: (message) => set({ isForwardDialogOpen: true, forwardingMessage: message }),
  closeForwardDialog: () => set({ isForwardDialogOpen: false, forwardingMessage: null }),
  clearMessageSearch: () => set({ messageSearchQuery: '', messageSearchResults: [], isSearchingMessages: false }),

  setIsNewChatModalOpen: (isOpen) => set({ isNewChatModalOpen: isOpen, searchedUsers: [] }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setIsMobileChatOpen: (isOpen) => set({ isMobileChatOpen: isOpen }),

  // Phase 7 initial state
  notifications: [],
  unreadNotificationCount: 0,
  notificationPreferences: null,
  privacySettings: null,
  blockedUsers: [],
  mutedConversationIds: [],
  isNotificationDrawerOpen: false,
  isSettingsModalOpen: false,
  activeSettingsTab: 'notifications',

  setIsNotificationDrawerOpen: (isOpen) => set({ isNotificationDrawerOpen: isOpen }),
  setIsSettingsModalOpen: (isOpen, tab) =>
    set({
      isSettingsModalOpen: isOpen,
      ...(tab ? { activeSettingsTab: tab } : {}),
    }),
  setActiveSettingsTab: (tab) => set({ activeSettingsTab: tab }),
  openCallModal: (type) => {
    set({ isCallModalOpen: true, callType: type });
  },
  closeCallModal: () => {
    set({ isCallModalOpen: false, callType: null });
  },

  setActiveConversationId: async (id, token) => {
    const prevId = get().activeConversationId;
    if (prevId && prevId !== id && !prevId.startsWith('conv-preview-')) {
      socketService.leaveConversation(prevId);
    }

    set({
      activeConversationId: id,
      isMobileChatOpen: id !== null,
      replyingToMessage: null,
      editingMessage: null,
    });

    if (!id) return;

    if (!id.startsWith('conv-preview-')) {
      socketService.joinConversation(id);

      if (token) {
        set({ isLoadingMessages: true });
        try {
          const apiMessages = await fetchConversationMessagesApi(token, id);
          set((state) => ({
            messages: {
              ...state.messages,
              [id]: apiMessages,
            },
            isLoadingMessages: false,
          }));

          // Load pinned messages for this conversation
          get().loadPinnedMessages(id, token);

          // Mark as read
          await markConversationReadApi(token, id);
          socketService.markAsRead(id);

          // Clear unread count locally
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === id ? { ...c, unreadCount: 0 } : c
            ),
          }));
        } catch (err) {
          console.error('[ChatStore] Error loading messages for conversation:', err);
          set({ isLoadingMessages: false });
        }
      }
    }
  },

  initRealtime: async (token, currentUserId) => {
    get().cleanupRealtime();

    socketService.connect(token);

    // 1. Subscribe to incoming messages
    const unsubMsg = socketService.onReceiveMessage((message: any) => {
      const activeId = get().activeConversationId;
      const convId = message.conversationId;
      const isCurrentActive = activeId === convId;

      set((state) => {
        const existingList = state.messages[convId] || [];
        const alreadyExists = existingList.some((m) => m.id === message.id);
        const updatedList = alreadyExists ? existingList : [...existingList, message];

        const updatedConversations = state.conversations.map((c) => {
          if (c.id === convId) {
            return {
              ...c,
              lastMessage: {
                id: message.id,
                content: message.content,
                createdAt: message.createdAt,
                senderName: message.senderName || 'User',
                type: message.type || 'TEXT',
                status: message.status || 'SENT',
              },
              updatedAt: message.createdAt,
              unreadCount: isCurrentActive ? 0 : c.unreadCount + 1,
            };
          }
          return c;
        });

        return {
          messages: {
            ...state.messages,
            [convId]: updatedList,
          },
          conversations: updatedConversations,
        };
      });

      if (isCurrentActive) {
        socketService.markAsRead(convId);
      }
    });

    // 2. Subscribe to message:edited
    const unsubEdited = socketService.onMessageEdited((data: any) => {
      const { conversationId, messageId, content, editedAt } = data;
      set((state) => {
        const list = state.messages[conversationId] || [];
        const updatedMessages = list.map((m) =>
          m.id === messageId ? { ...m, content, isEdited: true, editedAt } : m
        );
        return {
          messages: {
            ...state.messages,
            [conversationId]: updatedMessages,
          },
        };
      });
    });

    // 3. Subscribe to message:deleted
    const unsubDeleted = socketService.onMessageDeleted((data: any) => {
      const { conversationId, messageId, deleteType, deletedBy } = data;
      set((state) => {
        const list = state.messages[conversationId] || [];
        if (deleteType === 'FOR_ME' && deletedBy === currentUserId) {
          return {
            messages: {
              ...state.messages,
              [conversationId]: list.filter((m) => m.id !== messageId),
            },
          };
        }
        if (deleteType === 'FOR_EVERYONE') {
          const updatedMessages = list.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  isDeleted: true,
                  content: 'This message was deleted',
                  attachments: [],
                }
              : m
          );
          return {
            messages: {
              ...state.messages,
              [conversationId]: updatedMessages,
            },
          };
        }
        return state;
      });
    });

    // 4. Subscribe to message:reaction
    const unsubReaction = socketService.onMessageReaction((data: any) => {
      const { conversationId, messageId, reactions } = data;
      set((state) => {
        const list = state.messages[conversationId] || [];
        const updatedMessages = list.map((m) =>
          m.id === messageId ? { ...m, reactions } : m
        );
        return {
          messages: {
            ...state.messages,
            [conversationId]: updatedMessages,
          },
        };
      });
    });

    // 5. Subscribe to message:pinned
    const unsubPinned = socketService.onMessagePinned((data: any) => {
      const { conversationId, messageId, pinnedMessage } = data;
      set((state) => {
        const convPins = state.pinnedMessages[conversationId] || [];
        const alreadyPinned = convPins.some((p) => p.messageId === messageId);
        const updatedPins = alreadyPinned ? convPins : [pinnedMessage, ...convPins];

        const list = state.messages[conversationId] || [];
        const updatedMessages = list.map((m) =>
          m.id === messageId ? { ...m, isPinned: true } : m
        );

        return {
          pinnedMessages: {
            ...state.pinnedMessages,
            [conversationId]: updatedPins,
          },
          messages: {
            ...state.messages,
            [conversationId]: updatedMessages,
          },
        };
      });
    });

    // 6. Subscribe to message:unpinned
    const unsubUnpinned = socketService.onMessageUnpinned((data: any) => {
      const { conversationId, messageId } = data;
      set((state) => {
        const convPins = state.pinnedMessages[conversationId] || [];
        const updatedPins = convPins.filter((p) => p.messageId !== messageId);

        const list = state.messages[conversationId] || [];
        const updatedMessages = list.map((m) =>
          m.id === messageId ? { ...m, isPinned: false } : m
        );

        return {
          pinnedMessages: {
            ...state.pinnedMessages,
            [conversationId]: updatedPins,
          },
          messages: {
            ...state.messages,
            [conversationId]: updatedMessages,
          },
        };
      });
    });

    // 7. Subscribe to online status
    const unsubOnline = socketService.onUserOnline(({ userId }) => {
      set((state) => {
        const newSet = new Set(state.onlineUsers);
        newSet.add(userId);
        return {
          onlineUsers: newSet,
          conversations: state.conversations.map((c) => {
            if (c.type === 'DIRECT') {
              const hasUser = c.participants.some((p) => p.id === userId);
              if (hasUser) return { ...c, isOnline: true };
            }
            return c;
          }),
        };
      });
    });

    // 8. Subscribe to offline status
    const unsubOffline = socketService.onUserOffline(({ userId }) => {
      set((state) => {
        const newSet = new Set(state.onlineUsers);
        newSet.delete(userId);
        return {
          onlineUsers: newSet,
          conversations: state.conversations.map((c) => {
            if (c.type === 'DIRECT') {
              const other = c.participants.find((p) => p.id !== currentUserId);
              if (other && other.id === userId) return { ...c, isOnline: false };
            }
            return c;
          }),
        };
      });
    });

    // 9. Subscribe to typing indicators
    const unsubTypingStart = socketService.onTypingStart(({ conversationId, userId, userName }) => {
      if (userId === currentUserId) return;
      set((state) => ({
        typingMap: {
          ...state.typingMap,
          [conversationId]: { userId, userName },
        },
      }));
    });

    const unsubTypingStop = socketService.onTypingStop(({ conversationId, userId }) => {
      if (userId === currentUserId) return;
      set((state) => {
        const updated = { ...state.typingMap };
        delete updated[conversationId];
        return { typingMap: updated };
      });
    });

    // 10. Subscribe to read receipts
    const unsubRead = socketService.onMessageRead(({ conversationId, userId }) => {
      if (userId === currentUserId) return;
      set((state) => {
        const list = state.messages[conversationId] || [];
        const updatedMessages = list.map((m) =>
          m.isOutgoing ? { ...m, status: 'READ' as const } : m
        );
        return {
          messages: {
            ...state.messages,
            [conversationId]: updatedMessages,
          },
        };
      });
    });

    // 11. Subscribe to real-time notification events (Phase 7)
    const unsubNotifReceive = socketService.onNotificationReceive(({ notification, isMuted: _isMuted, soundEnabled }) => {
      set((state) => {
        const existing = state.notifications.some((n) => n.id === notification.id);
        const updated = existing ? state.notifications : [notification, ...state.notifications];
        return {
          notifications: updated,
          unreadNotificationCount: state.unreadNotificationCount + 1,
        };
      });

      if (soundEnabled && typeof Audio !== 'undefined') {
        try {
          const audio = new Audio('/notification.mp3');
          audio.play().catch(() => {});
        } catch {}
      }
    });

    const unsubNotifRead = socketService.onNotificationRead(({ notificationId, all, unreadCount }) => {
      set((state) => {
        if (all) {
          return {
            notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
            unreadNotificationCount: 0,
          };
        }
        return {
          notifications: state.notifications.map((n) =>
            n.id === notificationId ? { ...n, isRead: true } : n
          ),
          unreadNotificationCount:
            typeof unreadCount === 'number' ? unreadCount : Math.max(0, state.unreadNotificationCount - 1),
        };
      });
    });

    const unsubNotifCount = socketService.onNotificationCount(({ unreadCount }) => {
      set({ unreadNotificationCount: unreadCount });
    });

    const unsubNotifCleared = socketService.onNotificationCleared(({ notificationId, all, unreadCount }) => {
      set((state) => {
        if (all) {
          return { notifications: [], unreadNotificationCount: 0 };
        }
        return {
          notifications: state.notifications.filter((n) => n.id !== notificationId),
          unreadNotificationCount:
            typeof unreadCount === 'number' ? unreadCount : state.unreadNotificationCount,
        };
      });
    });

    const unsubConvMuted = socketService.onConversationMuted(({ conversationId, mutedUntil }) => {
      set((state) => ({
        mutedConversationIds: Array.from(new Set([...state.mutedConversationIds, conversationId])),
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, isMuted: true, mutedUntil: mutedUntil || undefined } : c
        ),
      }));
    });

    const unsubConvUnmuted = socketService.onConversationUnmuted(({ conversationId }) => {
      set((state) => ({
        mutedConversationIds: state.mutedConversationIds.filter((id) => id !== conversationId),
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, isMuted: false, mutedUntil: undefined } : c
        ),
      }));
    });

    const unsubPrivacy = socketService.onPrivacyUpdated((privacy) => {
      set({ privacySettings: privacy });
    });

    const unsubBlocked = socketService.onUserBlocked(() => {
      get().loadBlockedUsers(token).catch(() => {});
    });

    const unsubUnblocked = socketService.onUserUnblocked(() => {
      get().loadBlockedUsers(token).catch(() => {});
    });

    socketUnsubscribers = [
      unsubMsg,
      unsubEdited,
      unsubDeleted,
      unsubReaction,
      unsubPinned,
      unsubUnpinned,
      unsubOnline,
      unsubOffline,
      unsubTypingStart,
      unsubTypingStop,
      unsubRead,
      unsubNotifReceive,
      unsubNotifRead,
      unsubNotifCount,
      unsubNotifCleared,
      unsubConvMuted,
      unsubConvUnmuted,
      unsubPrivacy,
      unsubBlocked,
      unsubUnblocked,
    ];

    Promise.allSettled([
      get().loadConversations(token),
      get().loadNotifications(token),
      get().loadMutedConversations(token),
      get().loadNotificationPreferences(token),
      get().loadPrivacySettings(token),
    ]);
  },

  cleanupRealtime: () => {
    socketUnsubscribers.forEach((unsub) => unsub());
    socketUnsubscribers = [];
    socketService.disconnect();
  },

  loadConversations: async (token) => {
    set({ isLoadingConversations: true });
    try {
      const convs = await fetchConversationsApi(token);
      if (convs && convs.length > 0) {
        set({
          conversations: convs,
          isLoadingConversations: false,
          activeConversationId: convs[0].id,
        });
        await get().setActiveConversationId(convs[0].id, token);
      } else {
        set({ conversations: [], isLoadingConversations: false, activeConversationId: null });
      }
    } catch (err) {
      console.warn('[ChatStore] Could not fetch conversations from server, retaining preview fallback:', err);
      set({ isLoadingConversations: false });
    }
  },

  sendMessage: async (content: string, token?: string, currentUserId?: string) => {
    const activeId = get().activeConversationId;
    if (!activeId || !content.trim()) return;

    const trimmed = content.trim();
    const replying = get().replyingToMessage;
    const replyToId = replying?.id;

    // Reset replying preview
    set({ replyingToMessage: null });

    // Preview mode
    if (activeId.startsWith('conv-preview-')) {
      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        conversationId: activeId,
        senderId: currentUserId || 'current-user',
        senderName: 'You',
        content: trimmed,
        type: 'TEXT',
        createdAt: new Date().toISOString(),
        status: 'SENT',
        isOutgoing: true,
        isPreview: true,
        replyToId,
        replyTo: replying
          ? {
              id: replying.id,
              content: replying.content,
              type: replying.type,
              senderName: replying.senderName,
              isDeleted: replying.isDeleted,
            }
          : undefined,
        reactions: [],
      };

      set((state) => {
        const currentList = state.messages[activeId] || [];
        return {
          messages: {
            ...state.messages,
            [activeId]: [...currentList, newMessage],
          },
          conversations: state.conversations.map((c) =>
            c.id === activeId
              ? {
                  ...c,
                  lastMessage: {
                    id: newMessage.id,
                    content: newMessage.content,
                    createdAt: newMessage.createdAt,
                    senderName: 'You',
                    type: 'TEXT',
                    status: 'SENT',
                  },
                  updatedAt: newMessage.createdAt,
                }
              : c
          ),
        };
      });
      return;
    }

    // Authenticated real-time mode
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      conversationId: activeId,
      senderId: currentUserId || 'me',
      senderName: 'You',
      content: trimmed,
      type: 'TEXT',
      createdAt: new Date().toISOString(),
      status: 'SENDING',
      isOutgoing: true,
      replyToId,
      replyTo: replying
        ? {
            id: replying.id,
            content: replying.content,
            type: replying.type,
            senderName: replying.senderName,
            isDeleted: replying.isDeleted,
          }
        : undefined,
      reactions: [],
    };

    set((state) => {
      const currentList = state.messages[activeId] || [];
      return {
        messages: {
          ...state.messages,
          [activeId]: [...currentList, optimisticMessage],
        },
      };
    });

    try {
      let savedMessage: any;
      const socket = socketService.getSocket();
      if (socket && socket.connected) {
        savedMessage = await socketService.sendMessage(activeId, trimmed, 'TEXT', replyToId);
      } else if (token) {
        savedMessage = await sendMessageApi(token, activeId, trimmed, 'TEXT', replyToId);
      }

      if (savedMessage) {
        set((state) => {
          const list = state.messages[activeId] || [];
          const updated = list.map((m) =>
            m.id === tempId ? { ...savedMessage, isOutgoing: true } : m
          );
          return {
            messages: {
              ...state.messages,
              [activeId]: updated,
            },
            conversations: state.conversations.map((c) =>
              c.id === activeId
                ? {
                    ...c,
                    lastMessage: {
                      id: savedMessage.id,
                      content: savedMessage.content,
                      createdAt: savedMessage.createdAt,
                      senderName: 'You',
                      type: savedMessage.type,
                      status: 'SENT',
                    },
                    updatedAt: savedMessage.createdAt,
                  }
                : c
            ),
          };
        });
      }
    } catch (err) {
      console.error('[ChatStore] Failed to send message:', err);
    }
  },

  submitEditMessage: async (messageId, newContent, token) => {
    const activeId = get().activeConversationId;
    if (!activeId || !newContent.trim()) return;

    const trimmed = newContent.trim();
    set({ editingMessage: null });

    // Preview / local unauthenticated mode
    if (!token || activeId.startsWith('conv-preview-')) {
      set((state) => {
        const list = state.messages[activeId] || [];
        return {
          messages: {
            ...state.messages,
            [activeId]: list.map((m) =>
              m.id === messageId
                ? { ...m, content: trimmed, isEdited: true, editedAt: new Date().toISOString() }
                : m
            ),
          },
        };
      });
      return;
    }

    if (token) {
      try {
        const updated = await editMessageApi(token, messageId, trimmed);
        set((state) => {
          const list = state.messages[activeId] || [];
          return {
            messages: {
              ...state.messages,
              [activeId]: list.map((m) =>
                m.id === messageId
                  ? { ...m, content: updated.content, isEdited: true, editedAt: updated.editedAt }
                  : m
              ),
            },
          };
        });
      } catch (err) {
        console.error('[ChatStore] Edit message failed:', err);
      }
    }
  },

  deleteMessage: async (messageId, deleteType, token) => {
    const activeId = get().activeConversationId;
    if (!activeId) return;

    // Preview / local unauthenticated mode
    if (!token || activeId.startsWith('conv-preview-')) {
      set((state) => {
        const list = state.messages[activeId] || [];
        if (deleteType === 'FOR_ME') {
          return {
            messages: {
              ...state.messages,
              [activeId]: list.filter((m) => m.id !== messageId),
            },
          };
        }
        return {
          messages: {
            ...state.messages,
            [activeId]: list.map((m) =>
              m.id === messageId
                ? { ...m, isDeleted: true, content: 'This message was deleted', attachments: [] }
                : m
            ),
          },
        };
      });
      return;
    }

    if (token) {
      try {
        await deleteMessageApi(token, messageId, deleteType);
        set((state) => {
          const list = state.messages[activeId] || [];
          if (deleteType === 'FOR_ME') {
            return {
              messages: {
                ...state.messages,
                [activeId]: list.filter((m) => m.id !== messageId),
              },
            };
          }
          return {
            messages: {
              ...state.messages,
              [activeId]: list.map((m) =>
                m.id === messageId
                  ? { ...m, isDeleted: true, content: 'This message was deleted', attachments: [] }
                  : m
              ),
            },
          };
        });
      } catch (err) {
        console.error('[ChatStore] Delete message failed:', err);
      }
    }
  },

  toggleReaction: async (messageId, emoji, token, _currentUserId) => {
    const activeId = get().activeConversationId;
    if (!activeId) return;

    // Preview / local unauthenticated mode
    if (!token || activeId.startsWith('conv-preview-')) {
      set((state) => {
        const list = state.messages[activeId] || [];
        const updated = list.map((m) => {
          if (m.id !== messageId) return m;
          const currentReactions = m.reactions || [];
          const matchIndex = currentReactions.findIndex((r) => r.emoji === emoji);

          let newReactions = [...currentReactions];
          if (matchIndex >= 0) {
            const existing = newReactions[matchIndex];
            if (existing.hasReacted) {
              if (existing.count <= 1) {
                newReactions.splice(matchIndex, 1);
              } else {
                newReactions[matchIndex] = {
                  ...existing,
                  count: existing.count - 1,
                  hasReacted: false,
                  users: existing.users.filter((u) => u !== 'You'),
                };
              }
            } else {
              newReactions[matchIndex] = {
                ...existing,
                count: existing.count + 1,
                hasReacted: true,
                users: [...existing.users, 'You'],
              };
            }
          } else {
            newReactions.push({
              emoji,
              count: 1,
              hasReacted: true,
              users: ['You'],
            });
          }
          return { ...m, reactions: newReactions };
        });
        return {
          messages: {
            ...state.messages,
            [activeId]: updated,
          },
        };
      });
      return;
    }

    if (token) {
      try {
        const result = await toggleReactionApi(token, messageId, emoji);
        set((state) => {
          const list = state.messages[activeId] || [];
          return {
            messages: {
              ...state.messages,
              [activeId]: list.map((m) =>
                m.id === messageId ? { ...m, reactions: result.reactions } : m
              ),
            },
          };
        });
      } catch (err) {
        console.error('[ChatStore] Toggle reaction failed:', err);
      }
    }
  },

  pinMessage: async (conversationId, messageId, token) => {
    // Preview / local unauthenticated mode
    if (!token || conversationId.startsWith('conv-preview-')) {
      set((state) => {
        const list = state.messages[conversationId] || [];
        const targetMsg = list.find((m) => m.id === messageId);
        const convPins = state.pinnedMessages[conversationId] || [];
        const newPin: PinnedMessageItem = {
          id: `pin-${Date.now()}`,
          conversationId,
          messageId,
          pinnedById: 'current-user',
          pinnedAt: new Date().toISOString(),
          message: targetMsg || {
            id: messageId,
            content: 'Pinned message',
            type: 'TEXT',
          },
        };
        return {
          pinnedMessages: {
            ...state.pinnedMessages,
            [conversationId]: [newPin, ...convPins],
          },
          messages: {
            ...state.messages,
            [conversationId]: list.map((m) => (m.id === messageId ? { ...m, isPinned: true } : m)),
          },
        };
      });
      return;
    }

    if (token) {
      try {
        const pinned = await pinMessageApi(token, conversationId, messageId);
        set((state) => {
          const convPins = state.pinnedMessages[conversationId] || [];
          const list = state.messages[conversationId] || [];
          return {
            pinnedMessages: {
              ...state.pinnedMessages,
              [conversationId]: [pinned, ...convPins],
            },
            messages: {
              ...state.messages,
              [conversationId]: list.map((m) => (m.id === messageId ? { ...m, isPinned: true } : m)),
            },
          };
        });
      } catch (err) {
        console.error('[ChatStore] Pin message failed:', err);
      }
    }
  },

  unpinMessage: async (conversationId, messageId, token) => {
    // Preview / local unauthenticated mode
    if (!token || conversationId.startsWith('conv-preview-')) {
      set((state) => {
        const convPins = state.pinnedMessages[conversationId] || [];
        const list = state.messages[conversationId] || [];
        return {
          pinnedMessages: {
            ...state.pinnedMessages,
            [conversationId]: convPins.filter((p) => p.messageId !== messageId),
          },
          messages: {
            ...state.messages,
            [conversationId]: list.map((m) => (m.id === messageId ? { ...m, isPinned: false } : m)),
          },
        };
      });
      return;
    }

    if (token) {
      try {
        await unpinMessageApi(token, conversationId, messageId);
        set((state) => {
          const convPins = state.pinnedMessages[conversationId] || [];
          const list = state.messages[conversationId] || [];
          return {
            pinnedMessages: {
              ...state.pinnedMessages,
              [conversationId]: convPins.filter((p) => p.messageId !== messageId),
            },
            messages: {
              ...state.messages,
              [conversationId]: list.map((m) => (m.id === messageId ? { ...m, isPinned: false } : m)),
            },
          };
        });
      } catch (err) {
        console.error('[ChatStore] Unpin message failed:', err);
      }
    }
  },

  loadPinnedMessages: async (conversationId, token) => {
    if (!token || conversationId.startsWith('conv-preview-')) return;
    try {
      const apiFn = (fetchPinnedMessagesApi as any);
      if (typeof apiFn === 'function') {
        const pins = await apiFn(token, conversationId);
        if (Array.isArray(pins)) {
          set((state) => ({
            pinnedMessages: {
              ...state.pinnedMessages,
              [conversationId]: pins,
            },
          }));
        }
      }
    } catch (_err) {
      // Safe fallback for mocked environments
    }
  },

  toggleStarMessage: async (messageId, token) => {
    const activeId = get().activeConversationId;
    if (!activeId) return;

    // Preview / local unauthenticated mode
    if (!token || activeId.startsWith('conv-preview-')) {
      set((state) => {
        const list = state.messages[activeId] || [];
        return {
          messages: {
            ...state.messages,
            [activeId]: list.map((m) =>
              m.id === messageId ? { ...m, isStarred: !m.isStarred } : m
            ),
          },
        };
      });
      return;
    }

    if (token) {
      try {
        const res = await toggleStarMessageApi(token, messageId);
        set((state) => {
          const list = state.messages[activeId] || [];
          return {
            messages: {
              ...state.messages,
              [activeId]: list.map((m) =>
                m.id === messageId ? { ...m, isStarred: res.isStarred } : m
              ),
            },
          };
        });
      } catch (err) {
        console.error('[ChatStore] Toggle star message failed:', err);
      }
    }
  },

  loadStarredMessages: async (token) => {
    if (!token) return;
    try {
      const starred = await fetchStarredMessagesApi(token);
      set({ starredMessages: starred });
    } catch (err) {
      console.warn('[ChatStore] Failed to load starred messages:', err);
    }
  },

  forwardMessage: async (targetConversationIds, token) => {
    const forwarding = get().forwardingMessage;
    if (!forwarding || targetConversationIds.length === 0) return;

    // Preview mode
    if (forwarding.isPreview || forwarding.conversationId.startsWith('conv-preview-')) {
      targetConversationIds.forEach((targetId) => {
        const cloned: Message = {
          ...forwarding,
          id: `fwd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          conversationId: targetId,
          isForwarded: true,
          forwardedFrom: forwarding.senderName,
          createdAt: new Date().toISOString(),
          isOutgoing: true,
        };
        set((state) => {
          const list = state.messages[targetId] || [];
          return {
            messages: {
              ...state.messages,
              [targetId]: [...list, cloned],
            },
          };
        });
      });
      get().closeForwardDialog();
      return;
    }

    if (token) {
      try {
        const newMessages = await forwardMessageApi(token, forwarding.id, targetConversationIds);
        set((state) => {
          let updatedMessages = { ...state.messages };
          newMessages.forEach((msg: any) => {
            const list = updatedMessages[msg.conversationId] || [];
            updatedMessages[msg.conversationId] = [...list, msg];
          });
          return { messages: updatedMessages };
        });
        get().closeForwardDialog();
      } catch (err) {
        console.error('[ChatStore] Forward message failed:', err);
      }
    }
  },

  searchMessages: async (query, token, conversationId) => {
    if (!query.trim()) {
      get().clearMessageSearch();
      return;
    }

    set({ isSearchingMessages: true, messageSearchQuery: query });

    // Preview mode
    const activeId = conversationId || get().activeConversationId;
    if (!token || (activeId && activeId.startsWith('conv-preview-'))) {
      const allMessages = Object.values(get().messages).flat();
      const filtered = allMessages.filter(
        (m) =>
          !m.isDeleted &&
          m.content.toLowerCase().includes(query.toLowerCase()) &&
          (!conversationId || m.conversationId === conversationId)
      );
      set({ messageSearchResults: filtered, isSearchingMessages: false });
      return;
    }

    try {
      const res = await searchMessagesApi(token, query, conversationId);
      set({ messageSearchResults: res.messages || [], isSearchingMessages: false });
    } catch (err) {
      console.error('[ChatStore] Search messages failed:', err);
      set({ messageSearchResults: [], isSearchingMessages: false });
    }
  },

  uploadAndSendAttachment: async (file: File, caption?: string, token?: string, currentUserId?: string) => {
    const activeId = get().activeConversationId;
    if (!activeId || !file) return;

    const lowerName = file.name.toLowerCase();
    const forbiddenExtensions = [
      '.exe', '.bat', '.cmd', '.sh', '.bash', '.ps1', '.vbs', '.js', '.mjs',
      '.msi', '.com', '.scr', '.jar', '.pif', '.dll', '.bin', '.app', '.dmg', '.iso', '.php'
    ];
    const isForbidden = forbiddenExtensions.some((ext) => lowerName.endsWith(ext));
    if (isForbidden) {
      const err = 'Forbidden file type: Executable files and scripts are not allowed.';
      set({ uploadError: err });
      throw new Error(err);
    }

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isText = file.type === 'text/plain' || lowerName.endsWith('.txt');

    let maxBytes = 25 * 1024 * 1024;
    let typeName = 'File';
    if (isImage) {
      maxBytes = 10 * 1024 * 1024;
      typeName = 'Image';
    } else if (isVideo) {
      maxBytes = 50 * 1024 * 1024;
      typeName = 'Video';
    } else if (isText) {
      maxBytes = 25 * 1024 * 1024;
      typeName = 'Document';
    }

    if (file.size > maxBytes) {
      const err = `${typeName} size exceeds the maximum allowed limit of ${(maxBytes / (1024 * 1024)).toFixed(0)} MB.`;
      set({ uploadError: err });
      throw new Error(err);
    }

    const tempId = `temp-${Date.now()}`;
    const localBlobUrl = URL.createObjectURL(file);
    let resolvedType: MessageType = 'FILE';
    if (isImage) resolvedType = 'IMAGE';
    else if (isVideo) resolvedType = 'VIDEO';

    const optimisticAttachment: MediaAttachment = {
      id: `att-${Date.now()}`,
      fileKey: `temp/${file.name}`,
      fileUrl: localBlobUrl,
      fileType: resolvedType,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      fileName: file.name,
    };

    const replying = get().replyingToMessage;
    const replyToId = replying?.id;
    set({ replyingToMessage: null });

    // Preview Mode handling
    if (activeId.startsWith('conv-preview-')) {
      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        conversationId: activeId,
        senderId: currentUserId || 'current-user',
        senderName: 'You',
        content: caption?.trim() || file.name,
        type: resolvedType,
        createdAt: new Date().toISOString(),
        status: 'SENT',
        isOutgoing: true,
        isPreview: true,
        attachments: [optimisticAttachment],
        replyToId,
        replyTo: replying
          ? {
              id: replying.id,
              content: replying.content,
              type: replying.type,
              senderName: replying.senderName,
              isDeleted: replying.isDeleted,
            }
          : undefined,
      };

      set((state) => ({
        messages: {
          ...state.messages,
          [activeId]: [...(state.messages[activeId] || []), newMessage],
        },
        conversations: state.conversations.map((c) =>
          c.id === activeId
            ? {
                ...c,
                lastMessage: {
                  id: newMessage.id,
                  content: caption?.trim() || (resolvedType === 'IMAGE' ? '📷 Photo' : resolvedType === 'VIDEO' ? '🎥 Video' : '📎 Attachment'),
                  createdAt: newMessage.createdAt,
                  senderName: 'You',
                  type: resolvedType,
                  status: 'SENT',
                },
                updatedAt: newMessage.createdAt,
              }
            : c
        ),
      }));
      return;
    }

    if (!token) return;

    set({ isUploadingAttachment: true, uploadProgress: 15, uploadError: null });

    const optimisticMessage: Message = {
      id: tempId,
      conversationId: activeId,
      senderId: currentUserId || 'me',
      senderName: 'You',
      content: caption?.trim() || file.name,
      type: resolvedType,
      createdAt: new Date().toISOString(),
      status: 'SENDING',
      isOutgoing: true,
      attachments: [optimisticAttachment],
      replyToId,
      replyTo: replying
        ? {
            id: replying.id,
            content: replying.content,
            type: replying.type,
            senderName: replying.senderName,
            isDeleted: replying.isDeleted,
          }
        : undefined,
    };

    set((state) => ({
      messages: {
        ...state.messages,
        [activeId]: [...(state.messages[activeId] || []), optimisticMessage],
      },
    }));

    try {
      const presign = await requestAttachmentPresignApi(token, activeId, {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
      });

      set({ uploadProgress: 50 });

      await uploadAttachmentFile(
        presign.uploadUrl,
        presign.storageMode,
        file,
        token,
        presign.fileKey
      );

      set({ uploadProgress: 85 });

      const savedMessage = await confirmAttachmentUploadApi(token, activeId, {
        fileKey: presign.fileKey,
        fileName: presign.sanitizedFilename,
        fileSize: file.size,
        mimeType: presign.mimeType || file.type || 'application/octet-stream',
        fileType: presign.fileType,
        textContent: caption?.trim() || undefined,
        replyToId,
      });

      set((state) => {
        const list = state.messages[activeId] || [];
        const updated = list.map((m) =>
          m.id === tempId ? { ...savedMessage, isOutgoing: true } : m
        );

        return {
          isUploadingAttachment: false,
          uploadProgress: 0,
          uploadError: null,
          messages: {
            ...state.messages,
            [activeId]: updated,
          },
          conversations: state.conversations.map((c) =>
            c.id === activeId
              ? {
                  ...c,
                  lastMessage: {
                    id: savedMessage.id,
                    content: savedMessage.content || (savedMessage.type === 'IMAGE' ? '📷 Photo' : savedMessage.type === 'VIDEO' ? '🎥 Video' : '📎 Attachment'),
                    createdAt: savedMessage.createdAt,
                    senderName: 'You',
                    type: savedMessage.type,
                    status: 'SENT',
                  },
                  updatedAt: savedMessage.createdAt,
                }
              : c
          ),
        };
      });
    } catch (err: any) {
      console.error('[ChatStore] Attachment upload failed:', err);
      set((state) => {
        const list = state.messages[activeId] || [];
        return {
          uploadError: err?.message || 'Failed to upload attachment',
          isUploadingAttachment: false,
          uploadProgress: 0,
          messages: {
            ...state.messages,
            [activeId]: list.filter((m) => m.id !== tempId),
          },
        };
      });
      throw err;
    }
  },

  sendTyping: (isTyping) => {
    const activeId = get().activeConversationId;
    if (!activeId || activeId.startsWith('conv-preview-')) return;
    if (isTyping) {
      socketService.sendTypingStart(activeId);
    } else {
      socketService.sendTypingStop(activeId);
    }
  },

  createDirectChat: async (targetUserId, token) => {
    const conv = await createDirectConversationApi(token, targetUserId);
    set((state) => {
      const existing = state.conversations.find((c) => c.id === conv.id);
      const updated = existing ? state.conversations : [conv, ...state.conversations];
      return {
        conversations: updated,
        activeConversationId: conv.id,
        isNewChatModalOpen: false,
      };
    });
    await get().setActiveConversationId(conv.id, token);
    return conv.id;
  },

  createGroupChat: async (title, memberUserIds, token, avatarUrl) => {
    const conv = await createGroupConversationApi(token, title, memberUserIds, avatarUrl);
    set((state) => ({
      conversations: [conv, ...state.conversations],
      activeConversationId: conv.id,
      isNewChatModalOpen: false,
    }));
    await get().setActiveConversationId(conv.id, token);
    return conv.id;
  },

  searchUsers: async (query, token) => {
    set({ isSearchingUsers: true });
    try {
      const users = await searchUsersApi(token, query);
      set({ searchedUsers: users, isSearchingUsers: false });
    } catch (err) {
      console.error('[ChatStore] Search users failed:', err);
      set({ searchedUsers: [], isSearchingUsers: false });
    }
  },

  // Phase 7 Actions
  loadNotifications: async (token, options) => {
    try {
      const data = await fetchNotificationsApi(token, options);
      set({
        notifications: data.notifications || [],
        unreadNotificationCount: data.unreadCount || 0,
      });
    } catch (err) {
      console.warn('[ChatStore] Load notifications error:', err);
    }
  },

  markNotificationRead: async (notificationId, token) => {
    try {
      await markNotificationReadApi(token, notificationId);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notificationId ? { ...n, isRead: true } : n
        ),
        unreadNotificationCount: Math.max(0, state.unreadNotificationCount - 1),
      }));
    } catch (err) {
      console.warn('[ChatStore] Mark notification read error:', err);
    }
  },

  markAllNotificationsRead: async (token) => {
    try {
      await markAllNotificationsReadApi(token);
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadNotificationCount: 0,
      }));
    } catch (err) {
      console.warn('[ChatStore] Mark all read error:', err);
    }
  },

  removeNotification: async (notificationId, token) => {
    try {
      await deleteNotificationApi(token, notificationId);
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== notificationId),
      }));
    } catch (err) {
      console.warn('[ChatStore] Delete notification error:', err);
    }
  },

  clearAllNotifications: async (token) => {
    try {
      await clearAllNotificationsApi(token);
      set({ notifications: [], unreadNotificationCount: 0 });
    } catch (err) {
      console.warn('[ChatStore] Clear all notifications error:', err);
    }
  },

  loadNotificationPreferences: async (token) => {
    try {
      const preferences = await fetchNotificationPreferencesApi(token);
      set({ notificationPreferences: preferences });
    } catch (err) {
      console.warn('[ChatStore] Load preferences error:', err);
    }
  },

  updateNotificationPreferences: async (preferences, token) => {
    try {
      const updated = await updateNotificationPreferencesApi(token, preferences);
      set({ notificationPreferences: updated });
    } catch (err) {
      console.error('[ChatStore] Update preferences error:', err);
      throw err;
    }
  },

  loadPrivacySettings: async (token) => {
    try {
      const settings = await fetchPrivacySettingsApi(token);
      set({ privacySettings: settings });
    } catch (err) {
      console.warn('[ChatStore] Load privacy settings error:', err);
    }
  },

  updatePrivacySettings: async (settings, token) => {
    try {
      const updated = await updatePrivacySettingsApi(token, settings);
      set({ privacySettings: updated });
    } catch (err) {
      console.error('[ChatStore] Update privacy error:', err);
      throw err;
    }
  },

  loadBlockedUsers: async (token) => {
    try {
      const blockedUsers = await fetchBlockedUsersApi(token);
      set({ blockedUsers });
    } catch (err) {
      console.warn('[ChatStore] Load blocked users error:', err);
    }
  },

  blockUser: async (targetUserId, token) => {
    try {
      await blockUserApi(token, targetUserId);
      await get().loadBlockedUsers(token);
    } catch (err) {
      console.error('[ChatStore] Block user error:', err);
      throw err;
    }
  },

  unblockUser: async (targetUserId, token) => {
    try {
      await unblockUserApi(token, targetUserId);
      set((state) => ({
        blockedUsers: state.blockedUsers.filter((b) => b.blockedId !== targetUserId),
      }));
    } catch (err) {
      console.error('[ChatStore] Unblock user error:', err);
      throw err;
    }
  },

  muteConversation: async (conversationId, durationHours, token) => {
    try {
      await muteConversationApi(token, conversationId, durationHours);
      set((state) => ({
        mutedConversationIds: Array.from(new Set([...state.mutedConversationIds, conversationId])),
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, isMuted: true } : c
        ),
      }));
    } catch (err) {
      console.error('[ChatStore] Mute error:', err);
      throw err;
    }
  },

  unmuteConversation: async (conversationId, token) => {
    try {
      await unmuteConversationApi(token, conversationId);
      set((state) => ({
        mutedConversationIds: state.mutedConversationIds.filter((id) => id !== conversationId),
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, isMuted: false, mutedUntil: undefined } : c
        ),
      }));
    } catch (err) {
      console.error('[ChatStore] Unmute error:', err);
      throw err;
    }
  },

  loadMutedConversations: async (token) => {
    try {
      const ids = await fetchMutedConversationIdsApi(token);
      set((state) => ({
        mutedConversationIds: ids,
        conversations: state.conversations.map((c) => ({
          ...c,
          isMuted: ids.includes(c.id),
        })),
      }));
    } catch (err) {
      console.warn('[ChatStore] Load muted conversations error:', err);
    }
  },

  registerPushNotifications: async (token) => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[Push] Service workers or push messaging not supported by this browser');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('[Push] User denied notification permissions');
        return false;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const vapidPublicKey = await fetchVapidPublicKeyApi();
      if (!vapidPublicKey) {
        console.warn('[Push] Server returned no VAPID public key');
        return false;
      }

      // Convert VAPID key to Uint8Array
      const padding = '='.repeat((4 - (vapidPublicKey.length % 4)) % 4);
      const base64 = (vapidPublicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: outputArray,
      });

      await subscribePushApi(token, subscription.toJSON(), navigator.userAgent);
      return true;
    } catch (err) {
      console.error('[Push] Registration failed:', err);
      return false;
    }
  },
}));
