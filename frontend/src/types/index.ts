export type ThemeMode = 'light' | 'dark' | 'system';

export interface UserProfile {
  id: string;
  phoneNumber: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  isOnline: boolean;
  lastSeenAt?: string;
}

export type ConversationType = 'DIRECT' | 'GROUP';

export interface ConversationParticipant {
  id: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  phoneNumber?: string;
  isOnline: boolean;
  role?: 'OWNER' | 'ADMIN' | 'MEMBER';
}

export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'SYSTEM';
export type MessageDeliveryStatus = 'SENDING' | 'SENT' | 'DELIVERED' | 'READ';

export interface MediaAttachment {
  id: string;
  fileKey: string;
  fileUrl: string;
  fileType: MessageType;
  fileSize: number;
  mimeType: string;
  fileName?: string;
  width?: number;
  height?: number;
  durationSec?: number;
}

export interface MessageReactionGroup {
  emoji: string;
  count: number;
  users: string[];
  hasReacted: boolean;
}

export interface ReplyToPreview {
  id: string;
  content: string;
  type: MessageType;
  senderName: string;
  isDeleted?: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  type: MessageType;
  createdAt: string;
  status: MessageDeliveryStatus;
  isOutgoing: boolean;
  isPreview?: boolean;
  attachments?: MediaAttachment[];

  // Phase 6 Advanced Messaging
  replyToId?: string;
  replyTo?: ReplyToPreview;
  reactions?: MessageReactionGroup[];
  isEdited?: boolean;
  editedAt?: string;
  isDeleted?: boolean;
  isForwarded?: boolean;
  forwardedFrom?: string;
  isPinned?: boolean;
  isStarred?: boolean;
}

export interface PinnedMessageItem {
  id: string;
  conversationId: string;
  messageId: string;
  pinnedById: string;
  pinnedAt: string;
  message: {
    id: string;
    content: string;
    type: MessageType;
    sender?: { id: string; displayName: string; avatarUrl?: string };
    attachments?: MediaAttachment[];
  };
}

export interface StarredMessageItem {
  id: string;
  userId: string;
  messageId: string;
  starredAt: string;
  message: {
    id: string;
    content: string;
    type: MessageType;
    conversationId: string;
    createdAt: string;
    sender?: { id: string; displayName: string; avatarUrl?: string };
    conversation?: { id: string; title: string; type: ConversationType };
    attachments?: MediaAttachment[];
  };
}

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string;
  avatarUrl?: string;
  isOnline?: boolean;
  unreadCount: number;
  lastMessage?: {
    id: string;
    content: string;
    createdAt: string;
    senderName: string;
    type: MessageType;
    status: MessageDeliveryStatus;
  };
  participants: ConversationParticipant[];
  updatedAt: string;
  isPreview?: boolean;
  isMuted?: boolean;
  mutedUntil?: string;
}

export type ActiveFilterTab = 'all' | 'unread' | 'groups';

// ==========================================
// PHASE 7: NOTIFICATIONS & PRIVACY TYPES
// ==========================================

export type NotificationType =
  | 'DIRECT_MESSAGE'
  | 'GROUP_MESSAGE'
  | 'GROUP_MEMBERSHIP'
  | 'CALL_INCOMING'
  | 'CALL_MISSED'
  | 'MENTION'
  | 'SYSTEM';

export interface NotificationItem {
  id: string;
  userId: string;
  actorId?: string;
  actorName?: string;
  actorAvatar?: string;
  conversationId?: string;
  conversationTitle?: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: any;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  id?: string;
  userId: string;
  directMessages: boolean;
  groupMessages: boolean;
  callIncoming: boolean;
  callMissed: boolean;
  pushEnabled: boolean;
  soundEnabled: boolean;
  showPreview: boolean;
}

export type PrivacyVisibility = 'EVERYONE' | 'CONTACTS' | 'NOBODY';

export interface PrivacySetting {
  id?: string;
  userId: string;
  lastSeenVisibility: PrivacyVisibility;
  onlineStatusVisibility: PrivacyVisibility;
  profilePhotoVisibility: PrivacyVisibility;
  aboutVisibility: PrivacyVisibility;
  readReceipts: boolean;
  typingIndicator: boolean;
}

export interface BlockedUser {
  id: string;
  blockedId: string;
  blockedAt: string;
  user: {
    id: string;
    displayName: string;
    username?: string;
    avatarUrl?: string;
    bio?: string;
  };
}
