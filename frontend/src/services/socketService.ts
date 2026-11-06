import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

class SocketService {
  private socket: Socket | null = null;
  private currentToken: string | null = null;

  public connect(token: string): Socket {
    if (this.socket && this.socket.connected && this.currentToken === token) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    this.currentToken = token;
    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      console.log('[SocketService] Connected to real-time gateway:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[SocketService] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[SocketService] Connection error:', err.message);
    });

    return this.socket;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentToken = null;
    }
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public joinConversation(conversationId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('room:join', { conversationId });
    }
  }

  public leaveConversation(conversationId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('room:leave', { conversationId });
    }
  }

  public sendMessage(
    conversationId: string,
    content: string,
    type = 'TEXT',
    replyToId?: string
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket is not connected'));
        return;
      }

      this.socket.emit(
        'message:send',
        { conversationId, content, type, replyToId },
        (res: any) => {
          if (res && res.success) {
            resolve(res.message);
          } else {
            reject(new Error(res?.error || 'Failed to send message'));
          }
        }
      );
    });
  }

  public sendTypingStart(conversationId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('typing:start', { conversationId });
    }
  }

  public sendTypingStop(conversationId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('typing:stop', { conversationId });
    }
  }

  public markAsRead(conversationId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('message:read', { conversationId });
    }
  }

  public onReceiveMessage(callback: (message: any) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('message:receive', callback);
    return () => this.socket?.off('message:receive', callback);
  }

  public onUserOnline(callback: (data: { userId: string }) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('user:online', callback);
    return () => this.socket?.off('user:online', callback);
  }

  public onUserOffline(callback: (data: { userId: string; lastSeenAt: string }) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('user:offline', callback);
    return () => this.socket?.off('user:offline', callback);
  }

  public onTypingStart(callback: (data: { conversationId: string; userId: string; userName?: string }) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('typing:start', callback);
    return () => this.socket?.off('typing:start', callback);
  }

  public onTypingStop(callback: (data: { conversationId: string; userId: string }) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('typing:stop', callback);
    return () => this.socket?.off('typing:stop', callback);
  }

  public onMessageRead(callback: (data: { conversationId: string; userId: string }) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('message:read', callback);
    return () => this.socket?.off('message:read', callback);
  }

  // ==========================================
  // WebRTC Call Signaling (Phase 5)
  // ==========================================

  public initiateCall(
    conversationId: string,
    receiverId: string,
    type: 'AUDIO' | 'VIDEO'
  ): Promise<{ success: boolean; callId?: string; error?: string; isBusy?: boolean }> {
    return new Promise((resolve) => {
      if (!this.socket || !this.socket.connected) {
        resolve({ success: false, error: 'Socket disconnected' });
        return;
      }

      this.socket.emit(
        'call:initiate',
        { conversationId, receiverId, type },
        (res: any) => {
          resolve(res || { success: false, error: 'Call initiation timeout' });
        }
      );
    });
  }

  public sendCallRinging(callId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('call:ringing', { callId });
    }
  }

  public acceptCall(callId: string): Promise<{ success: boolean; callId?: string; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket || !this.socket.connected) {
        resolve({ success: false, error: 'Socket disconnected' });
        return;
      }

      this.socket.emit('call:accept', { callId }, (res: any) => {
        resolve(res || { success: false, error: 'Call acceptance failed' });
      });
    });
  }

  public rejectCall(callId: string, reason?: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('call:reject', { callId, reason });
    }
  }

  public sendCallOffer(callId: string, sdp: RTCSessionDescriptionInit): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('call:offer', { callId, sdp });
    }
  }

  public sendCallAnswer(callId: string, sdp: RTCSessionDescriptionInit): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('call:answer', { callId, sdp });
    }
  }

  public sendIceCandidate(callId: string, candidate: RTCIceCandidateInit): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('call:ice-candidate', { callId, candidate });
    }
  }

  public endCall(callId: string, reason?: string): Promise<{ success: boolean; durationSec?: number }> {
    return new Promise((resolve) => {
      if (!this.socket || !this.socket.connected) {
        resolve({ success: false });
        return;
      }

      this.socket.emit('call:end', { callId, reason }, (res: any) => {
        resolve(res || { success: true });
      });
    });
  }

  // Call Event Subscriptions
  public onCallIncoming(
    callback: (data: {
      callId: string;
      conversationId: string;
      callerId: string;
      callerName: string;
      callerAvatar?: string;
      type: 'AUDIO' | 'VIDEO';
    }) => void
  ): () => void {
    if (!this.socket) return () => {};
    this.socket.on('call:incoming', callback);
    return () => this.socket?.off('call:incoming', callback);
  }

  public onCallRinging(callback: (data: { callId: string }) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('call:ringing', callback);
    return () => this.socket?.off('call:ringing', callback);
  }

  public onCallAccept(callback: (data: { callId: string; receiverSocketId?: string }) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('call:accept', callback);
    return () => this.socket?.off('call:accept', callback);
  }

  public onCallReject(callback: (data: { callId: string; reason?: string }) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('call:reject', callback);
    return () => this.socket?.off('call:reject', callback);
  }

  public onCallOffer(callback: (data: { callId: string; sdp: RTCSessionDescriptionInit }) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('call:offer', callback);
    return () => this.socket?.off('call:offer', callback);
  }

  public onCallAnswer(callback: (data: { callId: string; sdp: RTCSessionDescriptionInit }) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('call:answer', callback);
    return () => this.socket?.off('call:answer', callback);
  }

  public onCallIceCandidate(callback: (data: { callId: string; candidate: RTCIceCandidateInit }) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('call:ice-candidate', callback);
    return () => this.socket?.off('call:ice-candidate', callback);
  }

  public onCallEnd(callback: (data: { callId: string; reason?: string; durationSec?: number }) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('call:end', callback);
    return () => this.socket?.off('call:end', callback);
  }

  public onCallBusy(callback: (data: { callId?: string; message?: string }) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('call:busy', callback);
    return () => this.socket?.off('call:busy', callback);
  }

  public onCallUnavailable(callback: (data: { callId?: string; message?: string }) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('call:unavailable', callback);
    return () => this.socket?.off('call:unavailable', callback);
  }

  public onCallFailed(callback: (data: { callId?: string; error: string }) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('call:failed', callback);
    return () => this.socket?.off('call:failed', callback);
  }

  // ==========================================
  // Phase 6: Advanced Messaging Real-time
  // ==========================================

  public onMessageEdited(callback: (data: any) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('message:edited', callback);
    return () => this.socket?.off('message:edited', callback);
  }

  public onMessageDeleted(callback: (data: any) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('message:deleted', callback);
    return () => this.socket?.off('message:deleted', callback);
  }

  public onMessageReaction(callback: (data: any) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('message:reaction', callback);
    return () => this.socket?.off('message:reaction', callback);
  }

  public onMessagePinned(callback: (data: any) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('message:pinned', callback);
    return () => this.socket?.off('message:pinned', callback);
  }

  public onMessageUnpinned(callback: (data: any) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('message:unpinned', callback);
    return () => this.socket?.off('message:unpinned', callback);
  }

  // ==========================================
  // Phase 7: Notifications & Privacy
  // ==========================================

  public onNotificationReceive(
    callback: (data: { notification: any; isMuted: boolean; soundEnabled: boolean }) => void
  ): () => void {
    if (!this.socket) return () => {};
    this.socket.on('notification:receive', callback);
    return () => this.socket?.off('notification:receive', callback);
  }

  public onNotificationRead(
    callback: (data: { notificationId?: string; all?: boolean; unreadCount: number }) => void
  ): () => void {
    if (!this.socket) return () => {};
    this.socket.on('notification:read', callback);
    return () => this.socket?.off('notification:read', callback);
  }

  public onNotificationCount(callback: (data: { unreadCount: number }) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('notification:count', callback);
    return () => this.socket?.off('notification:count', callback);
  }

  public onNotificationCleared(
    callback: (data: { notificationId?: string; all?: boolean; unreadCount: number }) => void
  ): () => void {
    if (!this.socket) return () => {};
    this.socket.on('notification:cleared', callback);
    return () => this.socket?.off('notification:cleared', callback);
  }

  public onConversationMuted(
    callback: (data: { conversationId: string; userId: string; mutedUntil?: string | null }) => void
  ): () => void {
    if (!this.socket) return () => {};
    this.socket.on('conversation:muted', callback);
    return () => this.socket?.off('conversation:muted', callback);
  }

  public onConversationUnmuted(
    callback: (data: { conversationId: string; userId: string }) => void
  ): () => void {
    if (!this.socket) return () => {};
    this.socket.on('conversation:unmuted', callback);
    return () => this.socket?.off('conversation:unmuted', callback);
  }

  public onPrivacyUpdated(callback: (data: any) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('privacy:updated', callback);
    return () => this.socket?.off('privacy:updated', callback);
  }

  public onUserBlocked(callback: (data: { blockerId: string; blockedId: string }) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('user:blocked', callback);
    return () => this.socket?.off('user:blocked', callback);
  }

  public onUserUnblocked(callback: (data: { blockerId: string; blockedId: string }) => void): () => void {
    if (!this.socket) return () => {};
    this.socket.on('user:unblocked', callback);
    return () => this.socket?.off('user:unblocked', callback);
  }

  public muteConversationSocket(conversationId: string, durationHours?: number): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket is not connected'));
        return;
      }
      this.socket.emit('conversation:mute', { conversationId, durationHours }, (res: any) => {
        if (res && res.success) resolve(res);
        else reject(new Error(res?.error || 'Failed to mute conversation'));
      });
    });
  }

  public unmuteConversationSocket(conversationId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket is not connected'));
        return;
      }
      this.socket.emit('conversation:unmute', { conversationId }, (res: any) => {
        if (res && res.success) resolve(res);
        else reject(new Error(res?.error || 'Failed to unmute conversation'));
      });
    });
  }
}

export const socketService = new SocketService();

