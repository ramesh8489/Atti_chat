const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export interface ApiUser {
  id: string;
  firebaseUid: string;
  phoneNumber: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isOnline: boolean;
  lastSeenAt: string;
  createdAt: string;
}

export interface SyncResponse {
  success: boolean;
  user: ApiUser;
  isNewUser: boolean;
  message?: string;
}

export interface MeResponse {
  success: boolean;
  user: ApiUser | null;
  phone?: string;
  message?: string;
}

export async function fetchCurrentUser(token: string): Promise<MeResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch user profile');
  }
  return data;
}

export async function syncFirebaseUser(token: string): Promise<SyncResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to sync account with backend');
  }
  return data;
}

export async function updateUserProfile(
  token: string,
  profile: { displayName?: string; username?: string; bio?: string; avatarUrl?: string }
): Promise<{ success: boolean; user: ApiUser }> {
  const res = await fetch(`${API_BASE_URL}/users/profile`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(profile),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update user profile');
  }
  return data;
}

export async function searchUsersApi(token: string, query: string): Promise<ApiUser[]> {
  const res = await fetch(`${API_BASE_URL}/users/search?q=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to search users');
  }
  return data.users || [];
}

export async function fetchConversationsApi(token: string) {
  const res = await fetch(`${API_BASE_URL}/conversations`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch conversations');
  }
  return data.conversations || [];
}

export async function fetchConversationMessagesApi(token: string, conversationId: string) {
  const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch messages');
  }
  return data.messages || [];
}

export async function createDirectConversationApi(token: string, targetUserId: string) {
  const res = await fetch(`${API_BASE_URL}/conversations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ targetUserId }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create direct conversation');
  }
  return data.conversation;
}

export async function createGroupConversationApi(
  token: string,
  title: string,
  memberUserIds: string[],
  avatarUrl?: string
) {
  const res = await fetch(`${API_BASE_URL}/conversations/group`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, memberUserIds, avatarUrl }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create group conversation');
  }
  return data.conversation;
}

export async function sendMessageApi(
  token: string,
  conversationId: string,
  content: string,
  type = 'TEXT',
  replyToId?: string
) {
  const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content, type, replyToId }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to send message');
  }
  return data.message;
}

export async function markConversationReadApi(token: string, conversationId: string) {
  const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/read`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to mark messages as read');
  }
  return data;
}

export interface PresignUploadPayload {
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface PresignUploadResponse {
  success: boolean;
  uploadUrl: string;
  fileKey: string;
  storageMode: 'S3' | 'LOCAL';
  expiresAt: string;
  sanitizedFilename: string;
  fileType: 'IMAGE' | 'VIDEO' | 'FILE' | 'AUDIO';
  mimeType?: string;
  uploadHeaders?: Record<string, string>;
}

export async function requestAttachmentPresignApi(
  token: string,
  conversationId: string,
  payload: PresignUploadPayload
): Promise<PresignUploadResponse> {
  const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/attachments/presign`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to request upload authorization');
  }
  return data;
}

export async function uploadAttachmentFile(
  uploadUrl: string,
  storageMode: 'S3' | 'LOCAL',
  file: File,
  token?: string,
  fileKey?: string
): Promise<void> {
  if (storageMode === 'S3') {
    // S3 PUT with file binary body
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!res.ok) {
      throw new Error(`S3 upload failed with status ${res.status}`);
    }
    return;
  }

  // Local development storage via multipart/form-data
  const formData = new FormData();
  formData.append('file', file);
  if (fileKey) {
    formData.append('fileKey', fileKey);
  }

  const destination = uploadUrl.startsWith('http') ? uploadUrl : `${API_BASE_URL.replace('/api', '')}${uploadUrl}`;

  const res = await fetch(destination, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to upload attachment file to server');
  }
}

export interface ConfirmAttachmentPayload {
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileType: 'IMAGE' | 'VIDEO' | 'FILE' | 'AUDIO';
  textContent?: string;
  replyToId?: string;
  width?: number;
  height?: number;
  durationSec?: number;
}

export async function confirmAttachmentUploadApi(
  token: string,
  conversationId: string,
  payload: ConfirmAttachmentPayload
) {
  const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/attachments/confirm`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to confirm attachment upload');
  }
  return data.message;
}

export async function getAttachmentDownloadUrlApi(token: string, attachmentId: string) {
  const res = await fetch(`${API_BASE_URL}/attachments/${attachmentId}/download-url`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to obtain secure download URL');
  }
  return data;
}

export async function fetchIceServersApi(token: string) {
  const res = await fetch(`${API_BASE_URL}/webrtc/ice-servers`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch ICE servers');
  }
  return data.iceServers;
}

export async function fetchCallHistoryApi(token: string, limit = 20) {
  const res = await fetch(`${API_BASE_URL}/calls/history?limit=${limit}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch call history');
  }
  return data.history;
}

// ==========================================
// Phase 6: Advanced Messaging APIs
// ==========================================

export async function editMessageApi(token: string, messageId: string, content: string) {
  const res = await fetch(`${API_BASE_URL}/messages/${messageId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to edit message');
  }
  return data.message;
}

export async function deleteMessageApi(
  token: string,
  messageId: string,
  deleteType: 'FOR_ME' | 'FOR_EVERYONE'
) {
  const res = await fetch(`${API_BASE_URL}/messages/${messageId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ deleteType }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete message');
  }
  return data;
}

export async function toggleReactionApi(token: string, messageId: string, emoji: string) {
  const res = await fetch(`${API_BASE_URL}/messages/${messageId}/reactions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ emoji }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to toggle reaction');
  }
  return data;
}

export async function pinMessageApi(token: string, conversationId: string, messageId: string) {
  const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/pins/${messageId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to pin message');
  }
  return data.pinnedMessage;
}

export async function unpinMessageApi(token: string, conversationId: string, messageId: string) {
  const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/pins/${messageId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to unpin message');
  }
  return data;
}

export async function fetchPinnedMessagesApi(token: string, conversationId: string) {
  const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/pins`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch pinned messages');
  }
  return data.pinnedMessages || [];
}

export async function toggleStarMessageApi(token: string, messageId: string) {
  const res = await fetch(`${API_BASE_URL}/messages/${messageId}/star`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to star/unstar message');
  }
  return data;
}

export async function fetchStarredMessagesApi(token: string) {
  const res = await fetch(`${API_BASE_URL}/messages/starred`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch starred messages');
  }
  return data.starredMessages || [];
}

export async function forwardMessageApi(token: string, messageId: string, targetConversationIds: string[]) {
  const res = await fetch(`${API_BASE_URL}/messages/${messageId}/forward`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ targetConversationIds }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to forward message');
  }
  return data.messages || [];
}

export async function searchMessagesApi(
  token: string,
  query: string,
  conversationId?: string,
  limit = 30,
  offset = 0
) {
  let url = `${API_BASE_URL}/messages/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`;
  if (conversationId) {
    url += `&conversationId=${encodeURIComponent(conversationId)}`;
  }

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to search messages');
  }
  return data;
}

// ==========================================
// PHASE 7: NOTIFICATIONS & PRIVACY API
// ==========================================

export async function fetchNotificationsApi(
  token: string,
  options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
) {
  const { limit = 30, offset = 0, unreadOnly = false } = options;
  const res = await fetch(
    `${API_BASE_URL}/notifications?limit=${limit}&offset=${offset}&unreadOnly=${unreadOnly}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch notifications');
  }
  return data;
}

export async function fetchUnreadNotificationCountApi(token: string): Promise<number> {
  const res = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch unread notification count');
  }
  return data.unreadCount || 0;
}

export async function markNotificationReadApi(token: string, notificationId: string) {
  const res = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to mark notification as read');
  }
  return data;
}

export async function markAllNotificationsReadApi(token: string) {
  const res = await fetch(`${API_BASE_URL}/notifications/read-all`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to mark all notifications as read');
  }
  return data;
}

export async function deleteNotificationApi(token: string, notificationId: string) {
  const res = await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete notification');
  }
  return data;
}

export async function clearAllNotificationsApi(token: string) {
  const res = await fetch(`${API_BASE_URL}/notifications`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to clear notifications');
  }
  return data;
}

export async function fetchNotificationPreferencesApi(token: string) {
  const res = await fetch(`${API_BASE_URL}/notifications/preferences`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch notification preferences');
  }
  return data.preferences;
}

export async function updateNotificationPreferencesApi(token: string, preferences: any) {
  const res = await fetch(`${API_BASE_URL}/notifications/preferences`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(preferences),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update notification preferences');
  }
  return data.preferences;
}

export async function fetchVapidPublicKeyApi(): Promise<string | null> {
  const res = await fetch(`${API_BASE_URL}/notifications/push/vapid-key`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch VAPID public key');
  }
  return data.vapidPublicKey || null;
}

export async function subscribePushApi(token: string, subscription: any, userAgent?: string) {
  const res = await fetch(`${API_BASE_URL}/notifications/push/subscribe`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subscription, userAgent }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to register push subscription');
  }
  return data.subscription;
}

export async function unsubscribePushApi(token: string, endpoint: string) {
  const res = await fetch(`${API_BASE_URL}/notifications/push/unsubscribe`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ endpoint }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to remove push subscription');
  }
  return data;
}

export async function fetchPrivacySettingsApi(token: string) {
  const res = await fetch(`${API_BASE_URL}/privacy`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch privacy settings');
  }
  return data.privacySettings;
}

export async function updatePrivacySettingsApi(token: string, privacySettings: any) {
  const res = await fetch(`${API_BASE_URL}/privacy`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(privacySettings),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update privacy settings');
  }
  return data.privacySettings;
}

export async function fetchBlockedUsersApi(token: string) {
  const res = await fetch(`${API_BASE_URL}/privacy/blocks`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch blocked users');
  }
  return data.blockedUsers || [];
}

export async function blockUserApi(token: string, targetUserId: string) {
  const res = await fetch(`${API_BASE_URL}/privacy/blocks/${targetUserId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to block user');
  }
  return data;
}

export async function unblockUserApi(token: string, targetUserId: string) {
  const res = await fetch(`${API_BASE_URL}/privacy/blocks/${targetUserId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to unblock user');
  }
  return data;
}

export async function muteConversationApi(token: string, conversationId: string, durationHours?: number) {
  const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/mute`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ durationHours }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to mute conversation');
  }
  return data;
}

export async function unmuteConversationApi(token: string, conversationId: string) {
  const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/mute`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to unmute conversation');
  }
  return data;
}

export async function fetchMutedConversationIdsApi(token: string): Promise<string[]> {
  const res = await fetch(`${API_BASE_URL}/privacy/muted`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch muted conversations');
  }
  return data.mutedConversationIds || [];
}



