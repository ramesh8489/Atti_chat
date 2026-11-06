import { create } from 'zustand';
import { socketService } from '../services/socketService';
import { webrtcService } from '../services/webrtcService';
import { fetchIceServersApi } from '../services/apiClient';

export type CallStatus =
  | 'idle'
  | 'initiating'
  | 'ringing'
  | 'incoming'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'rejected'
  | 'busy'
  | 'unavailable'
  | 'ended'
  | 'failed';

export interface CallState {
  callStatus: CallStatus;
  callId: string | null;
  callType: 'AUDIO' | 'VIDEO' | null;
  conversationId: string | null;
  peerId: string | null;
  peerName: string | null;
  peerAvatar?: string;
  isCaller: boolean;
  durationSec: number;
  isMuted: boolean;
  isVideoEnabled: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  errorMessage: string | null;
  iceServers: RTCIceServer[];

  // Actions
  initCallListeners: () => () => void;
  startCall: (
    conversationId: string,
    peerId: string,
    peerName: string,
    type: 'AUDIO' | 'VIDEO',
    token: string,
    peerAvatar?: string
  ) => Promise<void>;
  acceptCall: (token: string) => Promise<void>;
  rejectCall: (reason?: string) => void;
  endCall: (reason?: string) => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  switchCamera: () => Promise<void>;
  resetCall: () => void;
  setRemoteStream: (stream: MediaStream) => void;
}

// Tone generator for audio feedback (synthesized ringtones)
class ToneGenerator {
  private ctx: AudioContext | null = null;
  private intervalId: any = null;

  startRinging() {
    this.stop();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      const playTone = () => {
        if (!this.ctx || this.ctx.state === 'closed') return;
        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.2);
        osc2.stop(now + 1.2);
      };

      playTone();
      this.intervalId = setInterval(playTone, 3500);
    } catch {
      // AudioContext not permitted before interaction
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.close();
      } catch {
        // Ignore
      }
      this.ctx = null;
    }
  }
}

const toneGenerator = new ToneGenerator();
let durationTimer: any = null;
let ringingTimeoutTimer: any = null;

export const useCallStore = create<CallState>((set, get) => ({
  callStatus: 'idle',
  callId: null,
  callType: null,
  conversationId: null,
  peerId: null,
  peerName: null,
  peerAvatar: undefined,
  isCaller: false,
  durationSec: 0,
  isMuted: false,
  isVideoEnabled: true,
  localStream: null,
  remoteStream: null,
  errorMessage: null,
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],

  setRemoteStream: (stream) => set({ remoteStream: stream }),

  initCallListeners: () => {
    // 1. Incoming Call Event
    const unsubIncoming = socketService.onCallIncoming((data) => {
      // If already in call, decline or ignore
      if (get().callStatus !== 'idle') {
        socketService.rejectCall(data.callId, 'BUSY');
        return;
      }

      toneGenerator.startRinging();

      // Automatically timeout after 30s if not answered
      if (ringingTimeoutTimer) clearTimeout(ringingTimeoutTimer);
      ringingTimeoutTimer = setTimeout(() => {
        if (get().callStatus === 'incoming') {
          get().rejectCall('TIMEOUT');
        }
      }, 30000);

      set({
        callStatus: 'incoming',
        callId: data.callId,
        conversationId: data.conversationId,
        peerId: data.callerId,
        peerName: data.callerName,
        peerAvatar: data.callerAvatar,
        callType: data.type,
        isCaller: false,
        errorMessage: null,
      });

      // Send ringing acknowledgement back to caller
      socketService.sendCallRinging(data.callId);
    });

    // 2. Call Ringing Event (Caller receives notification that receiver is ringing)
    const unsubRinging = socketService.onCallRinging(({ callId }) => {
      if (get().callId === callId && get().callStatus === 'initiating') {
        set({ callStatus: 'ringing' });
      }
    });

    // 3. Call Accept Event (Caller receives notification that callee accepted)
    const unsubAccept = socketService.onCallAccept(async ({ callId }) => {
      if (get().callId !== callId) return;

      toneGenerator.stop();
      if (ringingTimeoutTimer) clearTimeout(ringingTimeoutTimer);

      set({ callStatus: 'connecting' });

      // Caller creates and sends SDP Offer
      try {
        const offer = await webrtcService.createOffer();
        socketService.sendCallOffer(callId, offer);
      } catch (err: any) {
        console.error('[CallStore] Error creating SDP offer:', err);
        set({ callStatus: 'failed', errorMessage: 'Failed to negotiate call offer' });
      }
    });

    // 4. Call Reject Event
    const unsubReject = socketService.onCallReject(({ callId, reason }) => {
      if (get().callId === callId) {
        toneGenerator.stop();
        if (ringingTimeoutTimer) clearTimeout(ringingTimeoutTimer);
        set({
          callStatus: 'rejected',
          errorMessage: reason || 'Call was declined by user',
        });
        setTimeout(() => get().resetCall(), 3000);
      }
    });

    // 5. SDP Offer Event (Receiver receives SDP offer)
    const unsubOffer = socketService.onCallOffer(async ({ callId, sdp }) => {
      if (get().callId !== callId) return;

      try {
        const answer = await webrtcService.handleOffer(sdp);
        socketService.sendCallAnswer(callId, answer);
      } catch (err: any) {
        console.error('[CallStore] Error handling offer and creating answer:', err);
        set({ callStatus: 'failed', errorMessage: 'Failed to negotiate call stream' });
      }
    });

    // 6. SDP Answer Event (Caller receives SDP answer)
    const unsubAnswer = socketService.onCallAnswer(async ({ callId, sdp }) => {
      if (get().callId !== callId) return;

      try {
        await webrtcService.handleAnswer(sdp);
      } catch (err: any) {
        console.error('[CallStore] Error handling answer:', err);
      }
    });

    // 7. ICE Candidate Event
    const unsubIce = socketService.onCallIceCandidate(async ({ callId, candidate }) => {
      if (get().callId === callId) {
        await webrtcService.addIceCandidate(candidate);
      }
    });

    // 8. Call End Event
    const unsubEnd = socketService.onCallEnd(({ callId, reason, durationSec }) => {
      if (get().callId === callId || get().callStatus !== 'idle') {
        toneGenerator.stop();
        if (ringingTimeoutTimer) clearTimeout(ringingTimeoutTimer);
        if (durationTimer) clearInterval(durationTimer);

        set({
          callStatus: 'ended',
          durationSec: durationSec || get().durationSec,
          errorMessage: reason ? `Call ended: ${reason}` : 'Call ended',
        });

        webrtcService.cleanup();
        setTimeout(() => get().resetCall(), 2500);
      }
    });

    // 9. Call Busy Event
    const unsubBusy = socketService.onCallBusy(({ message }) => {
      toneGenerator.stop();
      if (ringingTimeoutTimer) clearTimeout(ringingTimeoutTimer);
      set({
        callStatus: 'busy',
        errorMessage: message || 'User is currently on another call',
      });
      setTimeout(() => get().resetCall(), 3000);
    });

    // 10. Call Failed Event
    const unsubFailed = socketService.onCallFailed(({ error }) => {
      toneGenerator.stop();
      if (ringingTimeoutTimer) clearTimeout(ringingTimeoutTimer);
      set({
        callStatus: 'failed',
        errorMessage: error || 'Call failed to connect',
      });
      setTimeout(() => get().resetCall(), 3000);
    });

    return () => {
      unsubIncoming();
      unsubRinging();
      unsubAccept();
      unsubReject();
      unsubOffer();
      unsubAnswer();
      unsubIce();
      unsubEnd();
      unsubBusy();
      unsubFailed();
    };
  },

  startCall: async (conversationId, peerId, peerName, type, token, peerAvatar) => {
    get().resetCall();

    set({
      callStatus: 'initiating',
      conversationId,
      peerId,
      peerName,
      peerAvatar,
      callType: type,
      isCaller: true,
      errorMessage: null,
      durationSec: 0,
      isMuted: false,
      isVideoEnabled: true,
    });

    toneGenerator.startRinging();

    // 1. Fetch ICE servers
    let iceServers = get().iceServers;
    try {
      if (token) {
        iceServers = await fetchIceServersApi(token);
        set({ iceServers });
      }
    } catch (err) {
      console.warn('[CallStore] Could not fetch server ICE servers, using STUN default:', err);
    }

    // 2. Acquire media
    let localStream: MediaStream;
    try {
      localStream = await webrtcService.getLocalMedia(type);
      set({ localStream });
    } catch (err: any) {
      toneGenerator.stop();
      const errMsg =
        err?.name === 'NotAllowedError'
          ? 'Microphone/Camera permission denied by browser.'
          : 'Could not access audio/video devices.';
      set({ callStatus: 'failed', errorMessage: errMsg });
      setTimeout(() => get().resetCall(), 3500);
      return;
    }

    // 3. Create peer connection
    webrtcService.createPeerConnection(iceServers, {
      onIceCandidate: (candidate) => {
        const callId = get().callId;
        if (callId) {
          socketService.sendIceCandidate(callId, candidate.toJSON());
        }
      },
      onRemoteTrack: (remoteStream) => {
        set({ remoteStream });
      },
      onConnectionStateChange: (state) => {
        if (state === 'connected') {
          toneGenerator.stop();
          set({ callStatus: 'connected' });
          if (!durationTimer) {
            durationTimer = setInterval(() => {
              set((s) => ({ durationSec: s.durationSec + 1 }));
            }, 1000);
          }
        } else if (state === 'disconnected') {
          set({ callStatus: 'reconnecting' });
        } else if (state === 'failed') {
          get().endCall('CONNECTION_FAILED');
        }
      },
    });

    // 4. Send call:initiate to signaling server
    const initRes = await socketService.initiateCall(conversationId, peerId, type);
    if (!initRes.success) {
      toneGenerator.stop();
      webrtcService.cleanup();
      if (initRes.isBusy) {
        set({ callStatus: 'busy', errorMessage: 'User is currently on another call' });
      } else {
        set({ callStatus: 'failed', errorMessage: initRes.error || 'Failed to initiate call' });
      }
      setTimeout(() => get().resetCall(), 3000);
      return;
    }

    set({ callId: initRes.callId });

    // Set 30s timeout for unanswered call
    if (ringingTimeoutTimer) clearTimeout(ringingTimeoutTimer);
    ringingTimeoutTimer = setTimeout(() => {
      if (get().callStatus === 'initiating' || get().callStatus === 'ringing') {
        toneGenerator.stop();
        get().endCall('UNANSWERED');
        set({ callStatus: 'unavailable', errorMessage: 'User did not answer' });
        setTimeout(() => get().resetCall(), 3000);
      }
    }, 30000);
  },

  acceptCall: async (token: string) => {
    const callId = get().callId;
    const callType = get().callType || 'AUDIO';
    if (!callId) return;

    toneGenerator.stop();
    if (ringingTimeoutTimer) clearTimeout(ringingTimeoutTimer);

    set({ callStatus: 'connecting', errorMessage: null });

    // 1. Fetch ICE servers
    let iceServers = get().iceServers;
    try {
      if (token) {
        iceServers = await fetchIceServersApi(token);
        set({ iceServers });
      }
    } catch (err) {
      console.warn('[CallStore] Using fallback ICE servers:', err);
    }

    // 2. Acquire callee media
    let localStream: MediaStream;
    try {
      localStream = await webrtcService.getLocalMedia(callType);
      set({ localStream });
    } catch (err: any) {
      const errMsg =
        err?.name === 'NotAllowedError'
          ? 'Permission denied to access media devices.'
          : 'Could not access media devices.';
      set({ callStatus: 'failed', errorMessage: errMsg });
      socketService.rejectCall(callId, 'PERMISSION_DENIED');
      setTimeout(() => get().resetCall(), 3500);
      return;
    }

    // 3. Create callee peer connection
    webrtcService.createPeerConnection(iceServers, {
      onIceCandidate: (candidate) => {
        socketService.sendIceCandidate(callId, candidate.toJSON());
      },
      onRemoteTrack: (remoteStream) => {
        set({ remoteStream });
      },
      onConnectionStateChange: (state) => {
        if (state === 'connected') {
          set({ callStatus: 'connected' });
          if (!durationTimer) {
            durationTimer = setInterval(() => {
              set((s) => ({ durationSec: s.durationSec + 1 }));
            }, 1000);
          }
        } else if (state === 'disconnected') {
          set({ callStatus: 'reconnecting' });
        } else if (state === 'failed') {
          get().endCall('CONNECTION_FAILED');
        }
      },
    });

    // 4. Send call:accept to server
    const ack = await socketService.acceptCall(callId);
    if (!ack.success) {
      webrtcService.cleanup();
      set({ callStatus: 'failed', errorMessage: ack.error || 'Failed to accept call' });
      setTimeout(() => get().resetCall(), 2500);
    }
  },

  rejectCall: (reason = 'REJECTED') => {
    const callId = get().callId;
    toneGenerator.stop();
    if (ringingTimeoutTimer) clearTimeout(ringingTimeoutTimer);

    if (callId) {
      socketService.rejectCall(callId, reason);
    }

    webrtcService.cleanup();
    set({ callStatus: 'ended', errorMessage: 'Call declined' });
    setTimeout(() => get().resetCall(), 1500);
  },

  endCall: async (reason = 'USER_HANGUP') => {
    const callId = get().callId;
    toneGenerator.stop();
    if (ringingTimeoutTimer) clearTimeout(ringingTimeoutTimer);
    if (durationTimer) clearInterval(durationTimer);

    if (callId) {
      await socketService.endCall(callId, reason);
    }

    webrtcService.cleanup();
    set({
      callStatus: 'ended',
      errorMessage: reason === 'USER_HANGUP' ? 'Call ended' : `Call ended (${reason})`,
    });
    setTimeout(() => get().resetCall(), 2000);
  },

  toggleMute: () => {
    const nextState = !get().isMuted;
    webrtcService.toggleAudio(!nextState);
    set({ isMuted: nextState });
  },

  toggleVideo: () => {
    const nextState = !get().isVideoEnabled;
    webrtcService.toggleVideo(nextState);
    set({ isVideoEnabled: nextState });
  },

  switchCamera: async () => {
    const newStream = await webrtcService.switchCamera();
    if (newStream) {
      set({ localStream: newStream });
    }
  },

  resetCall: () => {
    toneGenerator.stop();
    if (ringingTimeoutTimer) clearTimeout(ringingTimeoutTimer);
    if (durationTimer) {
      clearInterval(durationTimer);
      durationTimer = null;
    }
    webrtcService.cleanup();

    set({
      callStatus: 'idle',
      callId: null,
      callType: null,
      conversationId: null,
      peerId: null,
      peerName: null,
      peerAvatar: undefined,
      isCaller: false,
      durationSec: 0,
      isMuted: false,
      isVideoEnabled: true,
      localStream: null,
      remoteStream: null,
      errorMessage: null,
    });
  },
}));

