import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { getRedisClient } from '../redis/redisClient.js';
import { SOCKET_EVENTS } from '../constants/index.js';
import { verifyAuthToken } from '../middleware/firebaseAuth.js';
import { findUserByFirebaseUid, syncUserFromFirebase } from '../services/userService.js';
import {
  setUserOnline,
  setUserOffline,
} from '../services/presenceService.js';
import {
  createMessage,
  markMessagesAsRead,
  getConversationParticipantUserIds,
} from '../services/conversationService.js';
import {
  editMessage,
  deleteMessage,
  toggleMessageReaction,
} from '../services/advancedMessagingService.js';
import {
  checkCallRateLimit,
  validateCallParticipants,
  isUserInActiveCall,
  initiateCallSession,
  markCallRinging,
  acceptCallSession,
  endCallSession,
  getActiveCall,
  getActiveCallForUser,
} from '../services/callService.js';
import {
  getPrivacySettings,
  canViewOnlineStatus,
  canViewLastSeen,
  shouldSendReadReceipt,
  shouldSendTypingIndicator,
} from '../services/privacyService.js';
import {
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  deleteNotification,
} from '../services/notificationService.js';
import {
  muteConversation,
  unmuteConversation,
} from '../services/conversationMuteService.js';
import { prisma } from '../database/prisma.js';

export interface ServerToClientEvents {
  [SOCKET_EVENTS.RECEIVE_MESSAGE]: (data: any) => void;
  [SOCKET_EVENTS.USER_ONLINE]: (data: { userId: string }) => void;
  [SOCKET_EVENTS.USER_OFFLINE]: (data: { userId: string; lastSeenAt: string }) => void;
  [SOCKET_EVENTS.TYPING_START]: (data: { conversationId: string; userId: string; userName?: string }) => void;
  [SOCKET_EVENTS.TYPING_STOP]: (data: { conversationId: string; userId: string }) => void;
  [SOCKET_EVENTS.MESSAGE_DELIVERED]: (data: { conversationId: string; messageId: string; userId: string }) => void;
  [SOCKET_EVENTS.MESSAGE_READ]: (data: { conversationId: string; userId: string }) => void;
  [SOCKET_EVENTS.MESSAGE_EDITED]: (data: {
    conversationId: string;
    messageId: string;
    content: string;
    isEdited: boolean;
    editedAt?: string;
    updatedAt: string;
  }) => void;
  [SOCKET_EVENTS.MESSAGE_DELETED]: (data: {
    conversationId: string;
    messageId: string;
    deleteType: 'FOR_ME' | 'FOR_EVERYONE';
    deletedBy: string;
  }) => void;
  [SOCKET_EVENTS.MESSAGE_REACTION]: (data: {
    conversationId: string;
    messageId: string;
    emoji: string;
    userId: string;
    action: 'ADD' | 'REMOVE';
    reactions: any[];
  }) => void;
  [SOCKET_EVENTS.MESSAGE_PINNED]: (data: {
    conversationId: string;
    messageId: string;
    pinnedById: string;
    pinnedAt: string;
    pinnedMessage: any;
  }) => void;
  [SOCKET_EVENTS.MESSAGE_UNPINNED]: (data: {
    conversationId: string;
    messageId: string;
    unpinnedBy: string;
  }) => void;

  // WebRTC Call Signaling Events
  [SOCKET_EVENTS.CALL_INCOMING]: (data: {
    callId: string;
    conversationId: string;
    callerId: string;
    callerName: string;
    callerAvatar?: string;
    type: 'AUDIO' | 'VIDEO';
  }) => void;
  [SOCKET_EVENTS.CALL_RINGING]: (data: { callId: string }) => void;
  [SOCKET_EVENTS.CALL_ACCEPT]: (data: { callId: string; receiverSocketId?: string }) => void;
  [SOCKET_EVENTS.CALL_REJECT]: (data: { callId: string; reason?: string }) => void;
  [SOCKET_EVENTS.CALL_OFFER]: (data: { callId: string; sdp: any }) => void;
  [SOCKET_EVENTS.CALL_ANSWER]: (data: { callId: string; sdp: any }) => void;
  [SOCKET_EVENTS.CALL_ICE_CANDIDATE]: (data: { callId: string; candidate: any }) => void;
  [SOCKET_EVENTS.CALL_END]: (data: { callId: string; reason?: string; durationSec?: number }) => void;
  [SOCKET_EVENTS.CALL_BUSY]: (data: { callId?: string; message?: string }) => void;
  [SOCKET_EVENTS.CALL_UNAVAILABLE]: (data: { callId?: string; message?: string }) => void;
  [SOCKET_EVENTS.CALL_FAILED]: (data: { callId?: string; error: string }) => void;

  // Phase 7 Notifications & Privacy Events
  [SOCKET_EVENTS.NOTIFICATION_RECEIVE]: (data: { notification: any; isMuted: boolean; soundEnabled: boolean }) => void;
  [SOCKET_EVENTS.NOTIFICATION_READ]: (data: { notificationId?: string; all?: boolean; unreadCount: number }) => void;
  [SOCKET_EVENTS.NOTIFICATION_COUNT]: (data: { unreadCount: number }) => void;
  [SOCKET_EVENTS.NOTIFICATION_CLEARED]: (data: { notificationId?: string; all?: boolean; unreadCount: number }) => void;
  [SOCKET_EVENTS.CONVERSATION_MUTED]: (data: { conversationId: string; userId: string; mutedUntil?: string | null }) => void;
  [SOCKET_EVENTS.CONVERSATION_UNMUTED]: (data: { conversationId: string; userId: string }) => void;
  [SOCKET_EVENTS.PRIVACY_UPDATED]: (data: { userId: string; privacySettings: any }) => void;
  [SOCKET_EVENTS.USER_BLOCKED]: (data: { blockedUserId: string; blockedByUserId: string }) => void;
  [SOCKET_EVENTS.USER_UNBLOCKED]: (data: { unblockedUserId: string; unblockedByUserId: string }) => void;
}

export interface ClientToServerEvents {
  [SOCKET_EVENTS.JOIN_ROOM]: (data: { conversationId: string }, callback?: (res: any) => void) => void;
  [SOCKET_EVENTS.LEAVE_ROOM]: (data: { conversationId: string }) => void;
  [SOCKET_EVENTS.SEND_MESSAGE]: (
    data: { conversationId: string; content: string; type?: any; replyToId?: string },
    callback?: (res: any) => void
  ) => void;
  [SOCKET_EVENTS.TYPING_START]: (data: { conversationId: string }) => void;
  [SOCKET_EVENTS.TYPING_STOP]: (data: { conversationId: string }) => void;
  [SOCKET_EVENTS.MESSAGE_READ]: (data: { conversationId: string }, callback?: (res: any) => void) => void;

  // WebRTC Call Signaling Events
  [SOCKET_EVENTS.CALL_INITIATE]: (
    data: { conversationId: string; receiverId: string; type: 'AUDIO' | 'VIDEO' },
    callback?: (res: any) => void
  ) => void;
  [SOCKET_EVENTS.CALL_RINGING]: (data: { callId: string }) => void;
  [SOCKET_EVENTS.CALL_ACCEPT]: (data: { callId: string }, callback?: (res: any) => void) => void;
  [SOCKET_EVENTS.CALL_REJECT]: (data: { callId: string; reason?: string }, callback?: (res: any) => void) => void;
  [SOCKET_EVENTS.CALL_OFFER]: (data: { callId: string; sdp: any }) => void;
  [SOCKET_EVENTS.CALL_ANSWER]: (data: { callId: string; sdp: any }) => void;
  [SOCKET_EVENTS.CALL_ICE_CANDIDATE]: (data: { callId: string; candidate: any }) => void;
  [SOCKET_EVENTS.CALL_END]: (data: { callId: string; reason?: string }, callback?: (res: any) => void) => void;

  // Phase 7 Client Actions
  [SOCKET_EVENTS.NOTIFICATION_READ]: (data: { notificationId: string }, callback?: (res: any) => void) => void;
  [SOCKET_EVENTS.NOTIFICATION_CLEARED]: (data: { notificationId: string }, callback?: (res: any) => void) => void;
  [SOCKET_EVENTS.CONVERSATION_MUTED]: (
    data: { conversationId: string; durationHours?: number },
    callback?: (res: any) => void
  ) => void;
  [SOCKET_EVENTS.CONVERSATION_UNMUTED]: (data: { conversationId: string }, callback?: (res: any) => void) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  userId: string;
  firebaseUid: string;
  user: any;
}

const socketEventTimestamps = new Map<string, number[]>();

export function checkSocketEventRateLimit(
  socketId: string,
  maxEvents = 100,
  windowMs = 10000,
  enforceInTest = false
): boolean {
  if (process.env.NODE_ENV === 'test' && !enforceInTest) return true;
  const now = Date.now();
  let timestamps = socketEventTimestamps.get(socketId) || [];
  timestamps = timestamps.filter((t) => now - t < windowMs);
  if (timestamps.length >= maxEvents) {
    return false;
  }
  timestamps.push(now);
  socketEventTimestamps.set(socketId, timestamps);
  return true;
}

let ioInstance: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null = null;

export function getIo() {
  return ioInstance;
}

export function initSocketServer(
  httpServer: HttpServer
): Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Setup Redis adapter if enabled and connected
  if (env.REDIS_ENABLED) {
    try {
      const pubClient = getRedisClient();
      if (pubClient) {
        const subClient = pubClient.duplicate();
        io.adapter(createAdapter(pubClient, subClient));
        logger.info('Socket.IO Redis adapter enabled for multi-node scaling.');
      }
    } catch (err: any) {
      logger.warn('Failed to attach Redis adapter to Socket.IO, continuing in-memory:', { message: err?.message });
    }
  } else {
    logger.info('Socket.IO running with local in-memory adapter (development mode).');
  }

  // Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const authHeader = socket.handshake.headers.authorization;
      const token =
        socket.handshake.auth?.token ||
        (authHeader?.toLowerCase().startsWith('bearer') ? authHeader.replace(/^bearer\s*/i, '').trim() : null);

      if (!token) {
        return next(new Error('Authentication required: Missing Bearer token'));
      }

      const authUser = await verifyAuthToken(token);
      let user = await findUserByFirebaseUid(authUser.uid);

      if (!user) {
        const syncResult = await syncUserFromFirebase(authUser.uid, authUser.phoneNumber || '');
        user = syncResult.user;
      }

      if (!user) {
        return next(new Error('User account not found'));
      }

      socket.data.userId = user.id;
      socket.data.firebaseUid = authUser.uid;
      socket.data.user = user;

      next();
    } catch (err: any) {
      logger.warn(`Socket authentication failed for ${socket.id}:`, { message: err?.message });
      next(new Error(err?.message || 'Authentication error'));
    }
  });

  // Socket Connection lifecycle
  io.on('connection', async (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
    const userId = socket.data.userId;
    logger.info(`Socket client connected: ${socket.id} (userId: ${userId})`);

    // Packet-level rate limiting middleware per socket connection
    socket.use((_packet, next) => {
      if (!checkSocketEventRateLimit(socket.id)) {
        logger.warn(`Socket event rate limit exceeded for ${socket.id} (userId: ${userId})`);
        return next(new Error('Rate limit exceeded: Please slow down'));
      }
      next();
    });

    // Join user's personal channel for direct alerts & notifications
    socket.join(`user:${userId}`);

    // Update presence respecting privacy settings
    const { isNewlyOnline } = await setUserOnline(userId, socket.id);
    if (isNewlyOnline) {
      try {
        const privacy = await getPrivacySettings(userId);
        if (privacy.onlineStatusVisibility === 'EVERYONE') {
          io.emit(SOCKET_EVENTS.USER_ONLINE, { userId });
        } else if (privacy.onlineStatusVisibility === 'CONTACTS') {
          const sockets = await io.fetchSockets();
          for (const s of sockets) {
            const viewerId = s.data.userId;
            if (viewerId && viewerId !== userId) {
              const allowed = await canViewOnlineStatus(userId, viewerId);
              if (allowed) {
                s.emit(SOCKET_EVENTS.USER_ONLINE, { userId });
              }
            }
          }
        }
      } catch (err: any) {
        io.emit(SOCKET_EVENTS.USER_ONLINE, { userId });
      }
      logger.debug(`Broadcasted user:online for ${userId}`);
    }

    // Join Conversation Room
    socket.on(SOCKET_EVENTS.JOIN_ROOM, async ({ conversationId }, callback) => {
      try {
        const isParticipant = await prisma.conversationParticipant.findUnique({
          where: {
            conversationId_userId: {
              conversationId,
              userId,
            },
          },
        });

        if (!isParticipant) {
          if (callback) callback({ success: false, error: 'Access denied: not a participant' });
          return;
        }

        socket.join(`conv:${conversationId}`);
        logger.debug(`Socket ${socket.id} (${userId}) joined room: conv:${conversationId}`);

        if (callback) callback({ success: true, conversationId });
      } catch (err: any) {
        logger.error(`Error joining room ${conversationId}:`, { message: err?.message });
        if (callback) callback({ success: false, error: err?.message });
      }
    });

    // Leave Conversation Room
    socket.on(SOCKET_EVENTS.LEAVE_ROOM, ({ conversationId }) => {
      socket.leave(`conv:${conversationId}`);
      logger.debug(`Socket ${socket.id} (${userId}) left room: conv:${conversationId}`);
    });

    // Send Message Event
    socket.on(SOCKET_EVENTS.SEND_MESSAGE, async ({ conversationId, content, type, replyToId }, callback) => {
      try {
        const savedMessage = await createMessage(userId, conversationId, content, type, replyToId);

        // Broadcast to everyone currently in the conversation room
        io.to(`conv:${conversationId}`).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, savedMessage);

        // Notify all conversation participants via their personal rooms so sidebar / unread count updates
        const participantUserIds = await getConversationParticipantUserIds(conversationId);
        participantUserIds.forEach((pid) => {
          if (pid !== userId) {
            io.to(`user:${pid}`).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, {
              ...savedMessage,
              isOutgoing: false,
            });
          }
        });

        if (callback) {
          callback({ success: true, message: savedMessage });
        }
      } catch (err: any) {
        logger.error(`Error sending message in conversation ${conversationId}:`, { message: err?.message });
        if (callback) {
          callback({ success: false, error: err?.message });
        }
      }
    });

    // Typing Indicators (respects typingIndicator privacy and room authorization)
    socket.on(SOCKET_EVENTS.TYPING_START, async ({ conversationId }) => {
      try {
        if (!socket.rooms.has(`conv:${conversationId}`)) {
          // Verify participant status if not explicitly joined room yet
          const isParticipant = await prisma.conversationParticipant.findUnique({
            where: { conversationId_userId: { conversationId, userId } },
            select: { id: true },
          });
          if (!isParticipant) return;
        }

        const allowTyping = await shouldSendTypingIndicator(userId);
        if (!allowTyping) return;

        socket.to(`conv:${conversationId}`).emit(SOCKET_EVENTS.TYPING_START, {
          conversationId,
          userId,
          userName: socket.data.user?.displayName || 'Someone',
        });
      } catch (err: any) {
        logger.warn('Error handling typing start:', { message: err?.message });
      }
    });

    socket.on(SOCKET_EVENTS.TYPING_STOP, async ({ conversationId }) => {
      try {
        if (!socket.rooms.has(`conv:${conversationId}`)) {
          const isParticipant = await prisma.conversationParticipant.findUnique({
            where: { conversationId_userId: { conversationId, userId } },
            select: { id: true },
          });
          if (!isParticipant) return;
        }

        socket.to(`conv:${conversationId}`).emit(SOCKET_EVENTS.TYPING_STOP, {
          conversationId,
          userId,
        });
      } catch (err: any) {
        logger.warn('Error handling typing stop:', { message: err?.message });
      }
    });

    // Message Read Receipt (respects readReceipts privacy)
    socket.on(SOCKET_EVENTS.MESSAGE_READ, async ({ conversationId }, callback) => {
      try {
        const result = await markMessagesAsRead(conversationId, userId);
        const allowReceipt = await shouldSendReadReceipt(userId);
        if (allowReceipt) {
          socket.to(`conv:${conversationId}`).emit(SOCKET_EVENTS.MESSAGE_READ, {
            conversationId,
            userId,
          });
        }

        if (callback) {
          callback({ success: true, markedCount: result.markedCount });
        }
      } catch (err: any) {
        logger.warn(`Error marking messages read for ${conversationId}:`, { message: err?.message });
        if (callback) {
          callback({ success: false, error: err?.message });
        }
      }
    });

    // Message Edit
    socket.on('message:edit' as any, async ({ messageId, content }: any, callback: any) => {
      try {
        const updated = await editMessage({ messageId, userId, newContent: content });
        if (callback) callback({ success: true, message: updated });
      } catch (err: any) {
        logger.warn(`Error editing message ${messageId}:`, { message: err?.message });
        if (callback) callback({ success: false, error: err?.message });
      }
    });

    // Message Delete
    socket.on('message:delete' as any, async ({ messageId, deleteType }: any, callback: any) => {
      try {
        const result = await deleteMessage({
          messageId,
          userId,
          deleteType: deleteType || 'FOR_EVERYONE',
        });
        if (callback) callback({ ...result });
      } catch (err: any) {
        logger.warn(`Error deleting message ${messageId}:`, { message: err?.message });
        if (callback) callback({ success: false, error: err?.message });
      }
    });

    // Message React
    socket.on('message:react' as any, async ({ messageId, emoji }: any, callback: any) => {
      try {
        const result = await toggleMessageReaction({ messageId, userId, emoji });
        if (callback) callback({ ...result });
      } catch (err: any) {
        logger.warn(`Error reacting to message ${messageId}:`, { message: err?.message });
        if (callback) callback({ success: false, error: err?.message });
      }
    });

    // ==========================================
    // WebRTC CALL SIGNALING (PHASE 5)
    // ==========================================

    // 1. Initiate Call
    socket.on(SOCKET_EVENTS.CALL_INITIATE, async ({ conversationId, receiverId, type }, callback) => {
      try {
        // Validation: user cannot call self
        if (receiverId === userId) {
          if (callback) callback({ success: false, error: 'Cannot initiate a call with yourself' });
          return;
        }

        // Rate limiting
        if (!checkCallRateLimit(userId)) {
          const errMsg = 'Rate limit exceeded: Too many call attempts. Please wait.';
          socket.emit(SOCKET_EVENTS.CALL_FAILED, { error: errMsg });
          if (callback) callback({ success: false, error: errMsg });
          return;
        }

        // Check conversation membership
        const memberCheck = await validateCallParticipants(conversationId, userId, receiverId);
        if (!memberCheck.valid) {
          const errMsg = memberCheck.error || 'Access denied: You are not authorized to call this user';
          socket.emit(SOCKET_EVENTS.CALL_FAILED, { error: errMsg });
          if (callback) callback({ success: false, error: errMsg });
          return;
        }

        // Check if caller already in active call
        if (isUserInActiveCall(userId)) {
          const errMsg = 'You are already in an active call';
          socket.emit(SOCKET_EVENTS.CALL_FAILED, { error: errMsg });
          if (callback) callback({ success: false, error: errMsg });
          return;
        }

        // Check if receiver is already in active call
        if (isUserInActiveCall(receiverId)) {
          socket.emit(SOCKET_EVENTS.CALL_BUSY, { message: 'User is currently on another call' });
          if (callback) callback({ success: false, error: 'User is currently on another call', isBusy: true });
          return;
        }

        // Create active call session
        const activeCall = await initiateCallSession({
          conversationId,
          callerId: userId,
          callerSocketId: socket.id,
          receiverId,
          type: type === 'VIDEO' ? 'VIDEO' : 'AUDIO',
        });

        // Broadcast incoming call to receiver's user room (multi-device support)
        io.to(`user:${receiverId}`).emit(SOCKET_EVENTS.CALL_INCOMING, {
          callId: activeCall.callId,
          conversationId,
          callerId: userId,
          callerName: socket.data.user?.displayName || socket.data.user?.username || 'PingUp User',
          callerAvatar: socket.data.user?.avatarUrl || undefined,
          type: activeCall.type,
        });

        logger.info(`Call initiated: ${activeCall.callId} (${type}) by ${userId} to ${receiverId}`);

        if (callback) {
          callback({ success: true, callId: activeCall.callId });
        }
      } catch (err: any) {
        logger.error('Error initiating call:', { message: err?.message });
        socket.emit(SOCKET_EVENTS.CALL_FAILED, { error: err?.message || 'Call initiation failed' });
        if (callback) callback({ success: false, error: err?.message });
      }
    });

    // 2. Receiver Ringing Acknowledgment
    socket.on(SOCKET_EVENTS.CALL_RINGING, async ({ callId }) => {
      try {
        const call = await markCallRinging(callId);
        if (call) {
          io.to(call.callerSocketId).emit(SOCKET_EVENTS.CALL_RINGING, { callId });
        }
      } catch (err: any) {
        logger.warn(`Error marking call ringing for ${callId}:`, { message: err?.message });
      }
    });

    // 3. Accept Call
    socket.on(SOCKET_EVENTS.CALL_ACCEPT, async ({ callId }, callback) => {
      try {
        const call = await acceptCallSession({
          callId,
          receiverId: userId,
          receiverSocketId: socket.id,
        });

        if (!call) {
          if (callback) callback({ success: false, error: 'Call is no longer available or was ended' });
          return;
        }

        // Notify caller that call was accepted
        io.to(call.callerSocketId).emit(SOCKET_EVENTS.CALL_ACCEPT, {
          callId,
          receiverSocketId: socket.id,
        });

        // Dismiss incoming call notification on receiver's other active devices
        socket.to(`user:${userId}`).emit(SOCKET_EVENTS.CALL_END, {
          callId,
          reason: 'ACCEPTED_ON_ANOTHER_DEVICE',
        });

        logger.info(`Call accepted: ${callId} by receiver ${userId}`);

        if (callback) {
          callback({ success: true, callId });
        }
      } catch (err: any) {
        logger.error(`Error accepting call ${callId}:`, { message: err?.message });
        if (callback) callback({ success: false, error: err?.message });
      }
    });

    // 4. Reject Call
    socket.on(SOCKET_EVENTS.CALL_REJECT, async ({ callId, reason }, callback) => {
      try {
        const { call } = await endCallSession({
          callId,
          endedByUserId: userId,
          finalStatus: 'REJECTED',
          reason: reason || 'REJECTED_BY_RECEIVER',
        });

        if (call) {
          io.to(call.callerSocketId).emit(SOCKET_EVENTS.CALL_REJECT, {
            callId,
            reason: reason || 'Call declined',
          });
          // Dismiss on other devices of receiver
          socket.to(`user:${userId}`).emit(SOCKET_EVENTS.CALL_END, {
            callId,
            reason: 'REJECTED',
          });
        }

        logger.info(`Call rejected: ${callId} by ${userId}`);

        if (callback) {
          callback({ success: true });
        }
      } catch (err: any) {
        logger.error(`Error rejecting call ${callId}:`, { message: err?.message });
        if (callback) callback({ success: false, error: err?.message });
      }
    });

    // 5. SDP Offer
    socket.on(SOCKET_EVENTS.CALL_OFFER, ({ callId, sdp }) => {
      const call = getActiveCall(callId);
      if (!call) return;

      // Caller is sending offer to receiver
      if (socket.data.userId === call.callerId) {
        if (call.receiverSocketId) {
          io.to(call.receiverSocketId).emit(SOCKET_EVENTS.CALL_OFFER, { callId, sdp });
        } else {
          io.to(`user:${call.receiverId}`).emit(SOCKET_EVENTS.CALL_OFFER, { callId, sdp });
        }
      }
    });

    // 6. SDP Answer
    socket.on(SOCKET_EVENTS.CALL_ANSWER, ({ callId, sdp }) => {
      const call = getActiveCall(callId);
      if (!call) return;

      // Receiver is sending answer to caller
      if (socket.data.userId === call.receiverId) {
        io.to(call.callerSocketId).emit(SOCKET_EVENTS.CALL_ANSWER, { callId, sdp });
      }
    });

    // 7. ICE Candidate Exchange
    socket.on(SOCKET_EVENTS.CALL_ICE_CANDIDATE, ({ callId, candidate }) => {
      const call = getActiveCall(callId);
      if (!call) return;

      if (socket.data.userId === call.callerId) {
        // Send to receiver
        if (call.receiverSocketId) {
          io.to(call.receiverSocketId).emit(SOCKET_EVENTS.CALL_ICE_CANDIDATE, { callId, candidate });
        } else {
          io.to(`user:${call.receiverId}`).emit(SOCKET_EVENTS.CALL_ICE_CANDIDATE, { callId, candidate });
        }
      } else if (socket.data.userId === call.receiverId) {
        // Send to caller
        io.to(call.callerSocketId).emit(SOCKET_EVENTS.CALL_ICE_CANDIDATE, { callId, candidate });
      }
    });

    // 8. End Call (Hangup)
    socket.on(SOCKET_EVENTS.CALL_END, async ({ callId, reason }, callback) => {
      try {
        const { call, durationSec } = await endCallSession({
          callId,
          endedByUserId: userId,
          finalStatus: 'ENDED',
          reason: reason || 'NORMAL_HANGUP',
        });

        if (call) {
          const peerSocketId = socket.data.userId === call.callerId ? call.receiverSocketId : call.callerSocketId;
          const peerUserId = socket.data.userId === call.callerId ? call.receiverId : call.callerId;

          if (peerSocketId) {
            io.to(peerSocketId).emit(SOCKET_EVENTS.CALL_END, { callId, reason, durationSec });
          } else {
            io.to(`user:${peerUserId}`).emit(SOCKET_EVENTS.CALL_END, { callId, reason, durationSec });
          }
        }

        logger.info(`Call ended: ${callId} by ${userId} (duration: ${durationSec}s)`);

        if (callback) {
          callback({ success: true, durationSec });
        }
      } catch (err: any) {
        logger.error(`Error ending call ${callId}:`, { message: err?.message });
        if (callback) callback({ success: false, error: err?.message });
      }
    });

    // ==========================================
    // NOTIFICATIONS & PRIVACY SOCKET EVENTS (PHASE 7)
    // ==========================================

    socket.on(SOCKET_EVENTS.NOTIFICATION_READ, async ({ notificationId }, callback) => {
      try {
        const result = await markNotificationAsRead(userId, notificationId);
        if (callback) callback(result);
      } catch (err: any) {
        logger.warn('Error marking notification read via socket:', { message: err?.message });
        if (callback) callback({ success: false, error: err?.message });
      }
    });

    socket.on(SOCKET_EVENTS.NOTIFICATION_CLEARED, async ({ notificationId }, callback) => {
      try {
        const result = await deleteNotification(userId, notificationId);
        if (callback) callback(result);
      } catch (err: any) {
        logger.warn('Error clearing notification via socket:', { message: err?.message });
        if (callback) callback({ success: false, error: err?.message });
      }
    });

    socket.on(SOCKET_EVENTS.CONVERSATION_MUTED, async ({ conversationId, durationHours }, callback) => {
      try {
        const result = await muteConversation({ conversationId, userId, durationHours });
        if (callback) callback(result);
      } catch (err: any) {
        logger.warn('Error muting conversation via socket:', { message: err?.message });
        if (callback) callback({ success: false, error: err?.message });
      }
    });

    socket.on(SOCKET_EVENTS.CONVERSATION_UNMUTED, async ({ conversationId }, callback) => {
      try {
        const result = await unmuteConversation(userId, conversationId);
        if (callback) callback(result);
      } catch (err: any) {
        logger.warn('Error unmuting conversation via socket:', { message: err?.message });
        if (callback) callback({ success: false, error: err?.message });
      }
    });

    // Disconnect handling
    socket.on('disconnect', async (reason) => {
      socketEventTimestamps.delete(socket.id);
      logger.info(`Socket client disconnected: ${socket.id} (userId: ${userId}, reason: ${reason})`);

      // Terminate any active call involving this disconnected socket
      const activeCall = getActiveCallForUser(userId);
      if (activeCall && ['INITIATED', 'RINGING', 'ONGOING'].includes(activeCall.status)) {
        logger.info(`Terminating active call ${activeCall.callId} due to socket disconnect of ${userId}`);
        const { call, durationSec } = await endCallSession({
          callId: activeCall.callId,
          endedByUserId: userId,
          finalStatus: 'FAILED',
          reason: 'USER_DISCONNECTED',
        });

        if (call) {
          const peerUserId = userId === call.callerId ? call.receiverId : call.callerId;
          io.to(`user:${peerUserId}`).emit(SOCKET_EVENTS.CALL_END, {
            callId: call.callId,
            reason: 'User disconnected',
            durationSec,
          });
        }
      }

      const { isNowOffline, lastSeenAt } = await setUserOffline(userId, socket.id);
      if (isNowOffline) {
        try {
          const privacy = await getPrivacySettings(userId);
          const lastSeenStr = lastSeenAt.toISOString();
          if (privacy.lastSeenVisibility === 'EVERYONE') {
            io.emit(SOCKET_EVENTS.USER_OFFLINE, { userId, lastSeenAt: lastSeenStr });
          } else if (privacy.lastSeenVisibility === 'CONTACTS') {
            const sockets = await io.fetchSockets();
            for (const s of sockets) {
              const viewerId = s.data.userId;
              if (viewerId && viewerId !== userId) {
                const allowed = await canViewLastSeen(userId, viewerId);
                if (allowed) {
                  s.emit(SOCKET_EVENTS.USER_OFFLINE, { userId, lastSeenAt: lastSeenStr });
                }
              }
            }
          }
        } catch (err: any) {
          io.emit(SOCKET_EVENTS.USER_OFFLINE, {
            userId,
            lastSeenAt: lastSeenAt.toISOString(),
          });
        }
        logger.debug(`Broadcasted user:offline for ${userId}`);
      }
    });
  });

  ioInstance = io;
  return io;
}
