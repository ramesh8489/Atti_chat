# PingUp — Phase 8: Security Hardening & Performance Optimization

PingUp is a modern real-time messaging application featuring verified phone-number authentication, direct and group messaging, rich media sharing (photos, videos, documents), private object storage with presigned URLs, live presence tracking, typing indicators, production-oriented WebRTC voice & video calling, advanced messaging (replies, edits, reactions, forwards, pins, bookmarks), real-time notifications, Web Push notifications, granular privacy controls, and comprehensive security hardening & performance optimization for safe public-internet usage.

---

## Architecture Overview

```
                                ┌────────────────────────────────────────────────────────┐
                                │                  PingUp Frontend (UI)                  │
                                │ React 18, Vite, Tailwind, Zustand, WebRTC RTCPeerConn  │
                                │ MediaStream (Camera/Mic), CallModal, ToneGenerator     │
                                └──────────────┬───────────────────────────▲─────────────┘
                                               │ Socket.IO Signaling       │ Direct Peer-to-Peer
                                               │ (Bearer Token Auth)       │ Media Stream (SRTP)
                                               ▼                           │
                                ┌──────────────────────────────────────────┴─────────────┐
                                │                   PingUp Backend API                   │
                                │ Node.js, Express, TS, Socket.IO 4.8 Gateway            │
                                │ CallSession & Rate Limiter, Firebase Admin Auth        │
                                └──────┬──────────┬───────────┬───────────────┬──────────┘
                                       │          │           │               │
                    ┌──────────────────▼──┐       │           │   ┌───────────▼─────────┐
                    │ PostgreSQL + Prisma │       │           │   │ Redis (Presence/Pub)│
                    │   Database Schema   │       │           │   │   Scaling Cluster   │
                    └─────────────────────┘       │           │   └─────────────────────┘
                                                  │           │
                         ┌────────────────────────▼┐         ┌▼─────────────────────────┐
                         │ S3 Private Cloud Bucket │         │ Coturn TURN / STUN Relay │
                         │ (AWS S3 / MinIO Presign)│         │ (NAT Traversal RFC 5766) │
                         └─────────────────────────┘         └──────────────────────────┘
```

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide icons, React Router, TanStack Query, Zustand, Socket.IO Client 4.8, WebRTC `RTCPeerConnection`, Web Audio API synthesized ringtone generator.
- **Backend**: Node.js, TypeScript, Express, Socket.IO 4.8, Prisma ORM, Helmet, Zod, Firebase Admin SDK 13, Redis Adapter, AWS S3 SDK (`@aws-sdk/client-s3`), Multer.
- **Data Layer**: PostgreSQL 16 with Prisma Schema (`schema.prisma`) tracking users, conversations, participants, messages, receipts, media attachments, and `CallSession` / `CallParticipant` history.
- **WebRTC Voice & Video Engine**: Native browser `RTCPeerConnection` with configurable STUN and Coturn TURN relay servers, time-limited HMAC-SHA1 credentials, and ICE candidate buffering.
- **Call State Machine**: 11 deterministic states (`idle`, `initiating`, `ringing`, `incoming`, `connecting`, `connected`, `reconnecting`, `rejected`, `busy`, `unavailable`, `ended`, `failed`).
- **Authenticated Signaling**: Socket.IO authenticated gateway with rate limiting (max 6 calls/min), direct conversation membership validation, multi-device ring delivery, and multi-device cancellation.

---

## Directory Structure

```
D:\Atti\
├── .backup_phase4/                  # Non-destructive Phase 4 backup point
├── .env.example                     # Root environment template (placeholders only)
├── .gitignore                       # Protection against secret and artifact check-in
├── docker-compose.yml               # PostgreSQL 16, Redis 7 & Coturn container services
├── package.json                     # Monorepo task runner
├── README.md                        # Documentation and Windows CMD setup guide
│
├── backend/                         # Express & Socket.IO server
│   ├── .env.example                 # Backend environment template
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma            # Prisma models (including CallSession & CallParticipant)
│   │   └── migrations/
│   │       ├── 20261029000000_init/
│   │       ├── 20261105000000_media_attachments/
│   │       └── 20261106000000_webrtc_call_history/ # Phase 5 non-destructive migration
│   ├── uploads/                     # Local storage fallback directory (.gitignored)
│   ├── src/
│   │   ├── app.ts                   # Express application setup & middleware
│   │   ├── server.ts                # Server startup & graceful shutdown
│   │   ├── config/
│   │   │   ├── env.ts               # Zod-validated environment config
│   │   │   └── logger.ts            # Sensitive token & secret-scrubbing logger
│   │   ├── constants/               # HTTP status codes & socket events
│   │   ├── controllers/             # Auth, User, Conversation, Attachment, Call controllers
│   │   ├── database/                # Prisma client singleton
│   │   ├── middleware/              # Error handling, request logger, Firebase auth
│   │   ├── redis/                   # Redis client & presence adapter with fallback
│   │   ├── routes/                  # Express routers (/health, /auth, /users, /conversations, /attachments, /calls, /webrtc)
│   │   ├── services/                # Call, WebRTC, Storage, MediaValidation, Conversation, Presence, User services
│   │   └── socket/                  # Socket.IO authenticated server with WebRTC signaling
│   └── tests/                       # Vitest integration & unit tests
│
└── frontend/                        # React + Vite application
    ├── .env.example                 # Frontend public environment template
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── App.tsx                  # React Router, Auth, Presence & Call Listener Gateway
        ├── main.tsx
        ├── index.css
        ├── config/
        │   └── firebase.ts          # Firebase Web SDK initialization
        ├── services/
        │   ├── apiClient.ts         # Backend API client with Bearer token authentication
        │   ├── firebaseAuthService.ts # Phone OTP authentication
        │   ├── socketService.ts     # Socket.IO connection & signaling event emitters
        │   └── webrtcService.ts     # RTCPeerConnection & MediaStream engine
        ├── types/                   # TypeScript interfaces (CallSession, Message, etc.)
        ├── store/                   # Zustand stores (themeStore, authStore, chatStore, callStore)
        ├── components/
        │   ├── layout/              # Header, ProfileDrawer
        │   ├── auth/                # PhoneLoginCard, OtpVerificationCard, ProfileOnboardingCard
        │   └── chat/                # Sidebar, ChatWindow, MessageInput, MessageList, CallModal (Video/Audio)
        ├── pages/                   # AuthPage, ChatPage
        └── test/                    # Vitest & Testing Library tests
```

---

## WebRTC Call Signaling Protocol (Phase 5)

### Socket.IO Signaling Events

| Event Name | Direction | Payload | Description |
|:---|:---:|:---|:---|
| `call:initiate` | Client → Server | `{ conversationId, receiverId, type }` | Validates membership, rate limit, active call state, initiates session in DB, and emits `call:incoming`. |
| `call:incoming` | Server → Client | `{ callId, conversationId, callerId, callerName, callerAvatar, type }` | Dispatched to receiver's personal room (`user:${receiverId}`) across all active devices. |
| `call:ringing` | Client → Server / Server → Client | `{ callId }` | Callee notifies server that device is ringing; server relays event to caller. |
| `call:accept` | Client → Server / Server → Client | `{ callId, receiverSocketId? }` | Callee accepts call; server marks call `ONGOING`, alerts caller, and dismisses other devices. |
| `call:reject` | Client → Server / Server → Client | `{ callId, reason }` | Callee declines call; server notifies caller and updates DB. |
| `call:offer` | Client → Server / Server → Client | `{ callId, sdp }` | Caller delivers SDP offer to callee via authenticated signaling channel. |
| `call:answer` | Client → Server / Server → Client | `{ callId, sdp }` | Callee delivers SDP answer back to caller. |
| `call:ice-candidate` | Bidirectional | `{ callId, candidate }` | Relays trickle ICE candidate to peer. |
| `call:end` | Bidirectional | `{ callId, reason, durationSec? }` | Hangs up call, stops media tracks, releases peer connection, and persists duration in DB. |
| `call:busy` | Server → Client | `{ callId?, message }` | Emitted when receiver is currently on another call. |
| `call:unavailable` | Server → Client | `{ callId?, message }` | Emitted on call timeout (30 seconds) or unreachable receiver. |
| `call:failed` | Server → Client | `{ callId?, error }` | Emitted on network failure, permission denial, or rate limit exceedance. |

### REST Endpoints for Calling & WebRTC

| Method | Path | Auth | Description |
|:---|:---|:---:|:---|
| `GET` | `/api/webrtc/ice-servers` | Bearer | Returns configured STUN/TURN servers (with time-limited HMAC-SHA1 credentials if TURN secret is configured). |
| `GET` | `/api/calls/history` | Bearer | Fetches recent call history (voice & video) for the authenticated user. |
| `GET` | `/api/conversations/:id/calls` | Bearer | Fetches call history for a specific direct conversation. |

---

## Local Development & Windows CMD Setup

### 1. Copy Environment Files
In Windows Command Prompt (`cmd.exe`):
```cmd
cd D:\Atti
copy .env.example .env
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

### 2. Optional: Start Coturn TURN Server with Docker
If you wish to test calls across different networks (e.g. cellular vs WiFi) using a local or staging Coturn relay:
```cmd
docker-compose up -d coturn
```
By default, public Google STUN servers (`stun:stun.l.google.com:19302`) handle peer-to-peer connectivity on local or open networks.

### 3. Run Prisma Migrations
```cmd
cd D:\Atti\backend
npx prisma generate
npx prisma migrate deploy
```

### 4. Start Development Servers
```cmd
:: Terminal 1: Backend Server (runs on http://localhost:5000)
cd D:\Atti\backend
npm run dev

:: Terminal 2: Frontend Client (runs on http://localhost:5173)
cd D:\Atti\frontend
npm run dev
```

---

## Manual Two-Browser Real Call Testing Procedure

To test real one-to-one voice and video calls between two separate accounts on the same machine:

1. **Browser 1 (Caller)**:
   - Open Chrome at `http://localhost:5173`.
   - Log in with Account A (`+919876543210`).
   - Select a direct chat with Account B.
2. **Browser 2 (Receiver)**:
   - Open Chrome Incognito or Firefox at `http://localhost:5173`.
   - Log in with Account B (`+919876543211`).
   - Keep window open.
3. **Initiating Call**:
   - In Browser 1, click the **Phone** (Audio) or **Video** icon in the chat header.
   - Browser 1 prompts for microphone/camera permissions; click **Allow**.
   - Browser 1 enters the "Calling..." / "Ringing..." screen with ringing audio tone.
4. **Receiving & Answering**:
   - Browser 2 immediately displays the **Incoming Call** overlay with caller name and avatar.
   - Click the green **Accept** button. Browser 2 prompts for media permissions; click **Allow**.
5. **Active In-Call Verification**:
   - Both browsers transition to the **Connected** screen; timer starts counting up (`00:01`, `00:02`...).
   - For Video calls: local camera preview appears in Picture-in-Picture window; remote video stream appears in full-screen window.
   - Test **Mute**: click Mic icon; audio track is disabled and icon turns red.
   - Test **Camera Toggle**: click Video icon; camera track is disabled.
6. **Ending Call**:
   - Click the red **End Call** button in either browser.
   - Both browsers show "Call ended" and smoothly return to the chat view.
   - Camera and microphone hardware indicators turn off immediately (`track.stop()` verified).

---

## Phase 6: Advanced Messaging Features

PingUp Phase 6 delivers enterprise-grade chat interactivity and organization across direct and group conversations:

* **Message Replies (Quoted Context)**:
  - Quote-reply to any text or media message with `replyToId`.
  - Quoted snippet banner displayed above the message input with instant dismiss.
  - Interactive quote preview rendered directly inside message bubbles with sender attribution and click-to-jump smooth scrolling.
  - Graceful handling of deleted referenced messages.
* **Message Editing**:
  - Edit own messages within a 15-minute time window.
  - Strict ownership enforcement (403 Forbidden for non-authors).
  - Preserves edit timestamp (`editedAt`), sets `isEdited: true`, and renders a subtle `(edited)` indicator.
  - Broadcasts `message:edited` via Socket.IO for real-time live sync.
* **Message Deletion**:
  - **Delete for Me**: Persisted in `UserDeletedMessage`, hiding the message exclusively for the deleting user while preserving it for other chat participants.
  - **Delete for Everyone**: Soft-delete marking `isDeleted: true`, replacing content with `"This message was deleted"` and detaching attachments. Authorized only for the message author or group OWNER/ADMIN.
  - Broadcasts `message:deleted` in real time to all room members.
* **Message Reactions**:
  - Interactive emoji reaction picker (👍, ❤️, 😂, 😮, 😢, 🔥).
  - Toggling reaction adds or removes the user's reaction.
  - Multi-user reaction pills with counts and tooltips displaying reacting users.
  - Real-time `message:reaction` broadcast synchronization.
* **Message Forwarding**:
  - Forward messages and media attachments to one or more direct/group conversations.
  - Strict membership validation across all destination conversations.
  - Renders a "Forwarded" badge and original sender attribution.
* **Pinned and Starred Messages**:
  - **Pinned Messages**: Pin up to 5 critical messages per conversation. Group chats restrict pinning to OWNER/ADMIN.
  - **Pinned Messages Bar**: Top-of-chat collapsible carousel showing active pins with jump-to-message navigation.
  - **Starred Messages**: Private bookmarking per user with dedicated Starred Messages Drawer.
* **Parameterized Message Search**:
  - Fast, parameterized search scoped to conversations the user is authorized to view.
  - Real-time term highlighting and click-to-jump navigation.
  - Respects deleted-message status and user-deleted message filters.

---

---

## Phase 7: Notifications & Privacy Controls

PingUp Phase 7 introduces comprehensive real-time notifications, standards-based Web Push, a slide-over Notification Center, chat muting, user blocking, and granular privacy controls:

### 1. Real-Time & Web Push Notifications
* **Multi-Channel Alert Delivery**: Dispatches instant real-time alerts via Socket.IO personal user rooms (`user:${userId}`) and standard Web Push notifications (`web-push` / VAPID).
* **Notification Types**:
  - `DIRECT_MESSAGE`: Direct messages from other users.
  - `GROUP_MESSAGE`: Messages from group participants.
  - `GROUP_INVITATION`: Additions/invitations to group chats.
  - `CALL_INCOMING`: Incoming WebRTC audio and video calls.
  - `CALL_MISSED`: Missed call alerts.
* **Notification Center Drawer**: Slide-over drawer with unread badges, filter tabs (*All* vs *Unread*), mark-as-read, mark-all-read, and dismiss/clear options. Clicking any item jumps to the conversation.
* **Granular Notification Preferences**: Configurable per-user toggles for direct messages, group messages, incoming calls, missed calls, push notifications, audio tones, and locked-screen message previews (`showPreview`).

### 2. Chat Muting Controls
* **Configurable Mute Durations**: Mute any direct or group conversation for **8 hours**, **1 week**, or **always** (until manually unmuted).
* **Mute Enforcement**: Backend suppresses both real-time notification alerts and Web Push notifications for muted chats while fully preserving message history and delivery receipts.
* **Visual Indicators**: Conversations and active chat headers display a `BellOff` icon when muted.

### 3. Granular Privacy Controls
* **Visibility Rules**: Granular dropdowns (`EVERYONE`, `CONTACTS`, `NOBODY`) for:
  - **Last Seen**: Controls whether other users can view your last active timestamp.
  - **Online Status**: Controls whether your live socket presence is broadcast to others.
  - **Profile Photo**: Controls avatar visibility for unknown contacts.
  - **About Text**: Controls status bio visibility.
* **Behavior Toggles**:
  - **Read Receipts**: When disabled, suppresses outgoing read receipts and prevents seeing read receipts from others.
  - **Typing Indicators**: When disabled, suppresses outgoing typing indicators.

### 4. User Blocking & Unblocking
* **Bidirectional Blocking**: Blocked users cannot send direct messages, initiate audio/video calls, or view online presence and typing indicators.
* **Real-Time Revocation**: Immediate socket notification informs both clients upon blocking or unblocking without exposing sensitive error details.
* **Blocked Users Management**: Accessible from Settings > Blocked Users tab with one-click unblock action.

### 5. Web Push & Production HTTPS Requirements
* **VAPID Keys**: Configured via `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` in `backend/.env`.
* **Service Worker**: Registered via `/sw.js` supporting push payload display and notification click navigation.
* **HTTPS Requirement**: Modern browsers mandate a secure context (`https://` or `localhost`) for service workers and PushManager registration. For production environments, configure reverse-proxy TLS termination (e.g. Nginx, Caddy, or Cloudflare).

---

### REST Endpoints for Phase 7

| Method | Path | Auth | Description |
|:---|:---|:---:|:---|
| `GET` | `/api/notifications` | Bearer | Fetches paginated notifications and unread badge count. |
| `GET` | `/api/notifications/unread-count` | Bearer | Fetches unread notification count. |
| `PATCH` | `/api/notifications/:id/read` | Bearer | Marks a specific notification as read. |
| `POST` | `/api/notifications/read-all` | Bearer | Marks all notifications as read. |
| `DELETE` | `/api/notifications/:id` | Bearer | Deletes/dismisses a single notification. |
| `DELETE` | `/api/notifications` | Bearer | Clears all notifications. |
| `GET` | `/api/notifications/preferences` | Bearer | Fetches user notification preferences. |
| `PUT` | `/api/notifications/preferences` | Bearer | Updates user notification preferences. |
| `GET` | `/api/notifications/push/vapid-key` | Public | Returns the VAPID public key for Web Push subscription. |
| `POST` | `/api/notifications/push/subscribe` | Bearer | Registers or updates a browser Web Push subscription. |
| `POST` | `/api/notifications/push/unsubscribe` | Bearer | Unsubscribes a Web Push endpoint. |
| `GET` | `/api/privacy` | Bearer | Fetches user privacy visibility settings. |
| `PUT` | `/api/privacy` | Bearer | Updates user privacy visibility settings. |
| `GET` | `/api/privacy/blocks` | Bearer | Lists blocked users. |
| `POST` | `/api/privacy/blocks/:userId` | Bearer | Blocks a target user. |
| `DELETE` | `/api/privacy/blocks/:userId` | Bearer | Unblocks a target user. |
| `POST` | `/api/conversations/:id/mute` | Bearer | Mutes a conversation (durationHours: 8, 168, or undefined). |
| `DELETE` | `/api/conversations/:id/mute` | Bearer | Unmutes a conversation. |
| `GET` | `/api/conversations/muted` | Bearer | Lists currently muted conversation IDs. |

---

---

## Phase 8: Security Hardening & Performance Optimization

PingUp Phase 8 implements comprehensive security hardening and performance optimization across the full stack for safe public-internet operation:

### 1. HTTP Security Headers & Content Security Policy (CSP)
* **Helmet CSP**: Directives strictly restrict script execution to authorized domains (`self`, `apis.google.com`, `gstatic.com`, `firebaseio.com`), styles, fonts, and WebSocket/media connections (`ws:`, `wss:`, `blob:`, S3/TURN).
* **Strict Transport Security (HSTS)**: Enabled in production (`maxAge: 31536000, includeSubDomains: true`).
* **Frame & Sniff Protection**: `X-Frame-Options: SAMEORIGIN` and `X-Content-Type-Options: nosniff`.
* **Referrer Policy**: `strict-origin-when-cross-origin`.

### 2. Request Correlation IDs & Safe Structured Logging
* **Correlation ID Middleware**: Automatically attaches or propagates unique `X-Request-ID` / `X-Correlation-ID` across every incoming request, returns `X-Request-ID` in HTTP headers, and prepends to all log outputs for end-to-end incident traceability.
* **Sensitive Data Scrubbing**: Automatically redacts Bearer tokens, passwords, private keys, cookies, and secret configuration keys from all log entries.
* **Prisma Error Masking**: `errorHandler.ts` translates database constraint errors (`P2002`, `P2025`, `P2003`) into safe user-facing error messages without leaking database table or column schemas.

### 3. Multi-Tier Rate Limiting
* **Auth Rate Limiter (`authLimiter`)**: Strictly limits `/api/auth` endpoints to 30 requests per 15-minute window per IP to prevent brute-force attacks and credential stuffing.
* **General API Limiter (`apiLimiter`)**: 300 requests per minute per IP for standard REST endpoints.
* **Upload Presign Limiter (`uploadLimiter`)**: 40 requests per minute per IP to protect cloud storage endpoints from excessive presigned URL allocation.
* **Socket Event Rate Limiting**: Per-socket token bucket throttles abusive packet flooding (> 100 events / 10s window).

### 4. Input Validation & DoS Protection
* **Payload Size Limits**: Express body parser limited to `1mb` for JSON payloads (preventing payload inflation DoS), with S3 presigned URLs handling file media directly.
* **Zod Schemas**: Strict validation on profile updates (bounds on `displayName`, `username` regex, `bio`, and `http/https` protocol on `avatarUrl`), message creation (max 10,000 characters), group creation, and forwarding (max 20 chats).
* **Safe Attachment Downloads**: Client-side URL validation blocks `javascript:` schemes before triggering DOM anchor clicks.
* **Filename Sanitization**: Replaces directory traversal sequences (`..`), null bytes (`\0`), and dangerous characters before generating object keys.

### 5. Database Performance Optimization & Additive Indexes
* **Migration `20261106030000_security_and_performance_indexes`**:
  - `ConversationParticipant(userId, mutedUntil)`: Speeds up mute status lookups.
  - `Message(conversationId, isDeleted, createdAt)`: Optimizes paginated message queries.
  - `MessageReceipt(userId, status)`: Speeds up unread badge queries.
  - `CallSession(status, startedAt)`: Accelerates active call session checks.

### 6. Frontend Bundle Optimization & Vendor Splitting
* **Chunk Splitting in Vite**: Rollup `manualChunks` divides third-party libraries into isolated, long-term cached vendor bundles:
  - `vendor-react.js` (159.8 kB)
  - `vendor-firebase.js` (176.8 kB)
  - `vendor-socket.js` (41.7 kB)
  - `vendor-icons.js` (29.1 kB)
  - `index.js` (Application code): **Reduced from 620.1 kB down to 213.5 kB (65.6% reduction)**.

---

## Quality & Test Verification

Run all **192 automated unit and integration tests** across the monorepo:
```cmd
cd D:\Atti
npm test
```
* **Backend Tests**: 123 passed across 13 test suites (`npm --prefix backend test -- --run`).
* **Frontend Tests**: 69 passed across 11 test files (`npm --prefix frontend test -- --run`).
* **Total Passing Tests**: 192 / 192 tests (100% green).

Build production packages:
```cmd
cd D:\Atti
npm run build
```
Both `backend` (`tsc`) and `frontend` (`tsc -b && vite build`) compile with zero errors, zero warnings, and exit code 0.
