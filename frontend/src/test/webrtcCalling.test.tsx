import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CallModal } from '../components/chat/CallModal';
import { useCallStore } from '../store/callStore';
import { useAuthStore } from '../store/authStore';
import { socketService } from '../services/socketService';
import { webrtcService } from '../services/webrtcService';
import * as apiClient from '../services/apiClient';

vi.mock('../services/apiClient', () => ({
  fetchIceServersApi: vi.fn().mockResolvedValue([
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:turn.example.com:3478', username: 'testuser', credential: 'testpassword' },
  ]),
  fetchCallHistoryApi: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/socketService', () => ({
  socketService: {
    initiateCall: vi.fn().mockResolvedValue({ success: true, callId: 'mock-call-101' }),
    sendCallRinging: vi.fn(),
    acceptCall: vi.fn().mockResolvedValue({ success: true, callId: 'mock-call-101' }),
    rejectCall: vi.fn(),
    sendCallOffer: vi.fn(),
    sendCallAnswer: vi.fn(),
    sendIceCandidate: vi.fn(),
    endCall: vi.fn().mockResolvedValue({ success: true, durationSec: 15 }),
    onCallIncoming: vi.fn(() => () => {}),
    onCallRinging: vi.fn(() => () => {}),
    onCallAccept: vi.fn(() => () => {}),
    onCallReject: vi.fn(() => () => {}),
    onCallOffer: vi.fn(() => () => {}),
    onCallAnswer: vi.fn(() => () => {}),
    onCallIceCandidate: vi.fn(() => () => {}),
    onCallEnd: vi.fn(() => () => {}),
    onCallBusy: vi.fn(() => () => {}),
    onCallUnavailable: vi.fn(() => () => {}),
    onCallFailed: vi.fn(() => () => {}),
  },
}));

// Mock browser MediaDevices and WebRTC
const mockTrack = {
  kind: 'audio',
  enabled: true,
  stop: vi.fn(),
};

const mockStream = {
  getTracks: vi.fn(() => [mockTrack]),
  getAudioTracks: vi.fn(() => [mockTrack]),
  getVideoTracks: vi.fn(() => [mockTrack]),
  removeTrack: vi.fn(),
  addTrack: vi.fn(),
} as any;

class MockMediaStream {
  tracks: any[];
  constructor(tracks: any[] = []) {
    this.tracks = tracks;
  }
  getTracks() {
    return this.tracks.length > 0 ? this.tracks : [mockTrack];
  }
  getAudioTracks() {
    return [mockTrack];
  }
  getVideoTracks() {
    return [mockTrack];
  }
  addTrack(track: any) {
    this.tracks.push(track);
  }
  removeTrack(track: any) {
    this.tracks = this.tracks.filter((t) => t !== track);
  }
}

global.MediaStream = MockMediaStream as any;

class MockRTCPeerConnection {
  public connectionState: RTCPeerConnectionState = 'new';
  public iceConnectionState: RTCIceConnectionState = 'new';
  public remoteDescription: any = null;
  public localDescription: any = null;
  public onicecandidate: any = null;
  public ontrack: any = null;
  public onconnectionstatechange: any = null;
  public oniceconnectionstatechange: any = null;

  createOffer = vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-offer-sdp' });
  createAnswer = vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-answer-sdp' });
  setLocalDescription = vi.fn().mockImplementation((desc) => {
    this.localDescription = desc;
    return Promise.resolve();
  });
  setRemoteDescription = vi.fn().mockImplementation((desc) => {
    this.remoteDescription = desc;
    return Promise.resolve();
  });
  addIceCandidate = vi.fn().mockResolvedValue(undefined);
  addTrack = vi.fn();
  getSenders = vi.fn(() => []);
  restartIce = vi.fn();
  close = vi.fn();
}

global.RTCPeerConnection = MockRTCPeerConnection as any;
global.RTCSessionDescription = vi.fn((init) => init) as any;
global.RTCIceCandidate = vi.fn((init) => init) as any;

if (!navigator.mediaDevices) {
  (navigator as any).mediaDevices = {};
}
navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(mockStream);

describe('WebRTC Calling & Call UI (Phase 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCallStore.getState().resetCall();
    useAuthStore.setState({
      token: 'mock-valid-token',
      user: {
        id: 'usr-alice',
        phoneNumber: '+919876543210',
        displayName: 'Alice',
        username: 'alice',
        isOnline: true,
      },
    });
  });

  describe('Call State Machine & WebRTC Engine', () => {
    it('initiates voice call, transitions to initiating/ringing, and calls socketService', async () => {
      await useCallStore.getState().startCall(
        'conv-101',
        'usr-bob',
        'Bob',
        'AUDIO',
        'mock-token'
      );

      const state = useCallStore.getState();
      expect(state.callStatus).toBe('initiating');
      expect(state.peerName).toBe('Bob');
      expect(state.callType).toBe('AUDIO');
      expect(state.isCaller).toBe(true);

      expect(apiClient.fetchIceServersApi).toHaveBeenCalledWith('mock-token');
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({ audio: expect.anything() })
      );
      expect(socketService.initiateCall).toHaveBeenCalledWith('conv-101', 'usr-bob', 'AUDIO');
    });

    it('handles incoming call notification and accepts call', async () => {
      // Simulate incoming call payload
      useCallStore.setState({
        callStatus: 'incoming',
        callId: 'call-incoming-99',
        peerId: 'usr-charlie',
        peerName: 'Charlie',
        callType: 'VIDEO',
        isCaller: false,
      });

      expect(useCallStore.getState().callStatus).toBe('incoming');

      await useCallStore.getState().acceptCall('mock-token');

      expect(socketService.acceptCall).toHaveBeenCalledWith('call-incoming-99');
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });

    it('rejects incoming call and resets state', () => {
      useCallStore.setState({
        callStatus: 'incoming',
        callId: 'call-decline-1',
        peerId: 'usr-charlie',
        peerName: 'Charlie',
      });

      useCallStore.getState().rejectCall('BUSY');
      expect(socketService.rejectCall).toHaveBeenCalledWith('call-decline-1', 'BUSY');
      expect(useCallStore.getState().callStatus).toBe('ended');
    });

    it('toggles microphone mute state on tracks and store', () => {
      useCallStore.setState({ localStream: mockStream, isMuted: false });

      useCallStore.getState().toggleMute();
      expect(useCallStore.getState().isMuted).toBe(true);

      useCallStore.getState().toggleMute();
      expect(useCallStore.getState().isMuted).toBe(false);
    });

    it('toggles camera video state on tracks and store', () => {
      useCallStore.setState({ localStream: mockStream, isVideoEnabled: true });

      useCallStore.getState().toggleVideo();
      expect(useCallStore.getState().isVideoEnabled).toBe(false);

      useCallStore.getState().toggleVideo();
      expect(useCallStore.getState().isVideoEnabled).toBe(true);
    });

    it('ends call, stops tracks, and closes peer connection', async () => {
      (webrtcService as any).localStream = mockStream;
      useCallStore.setState({
        callStatus: 'connected',
        callId: 'call-running-1',
        localStream: mockStream,
      });

      await useCallStore.getState().endCall('USER_HANGUP');

      expect(socketService.endCall).toHaveBeenCalledWith('call-running-1', 'USER_HANGUP');
      expect(mockTrack.stop).toHaveBeenCalled();
      expect(useCallStore.getState().callStatus).toBe('ended');
    });
  });

  describe('CallModal UI Rendering & Interactions', () => {
    it('renders incoming call screen with caller name, Accept, and Decline buttons', () => {
      useCallStore.setState({
        callStatus: 'incoming',
        callId: 'call-incoming-1',
        peerName: 'Deepa',
        callType: 'AUDIO',
      });

      render(<CallModal />);

      expect(screen.getByText('Deepa')).toBeInTheDocument();
      expect(screen.getByText('Incoming Call...')).toBeInTheDocument();
      expect(screen.getByLabelText('Accept Call')).toBeInTheDocument();
      expect(screen.getByLabelText('Decline Call')).toBeInTheDocument();
    });

    it('triggers acceptCall when Accept button is clicked', () => {
      useCallStore.setState({
        callStatus: 'incoming',
        callId: 'call-incoming-2',
        peerName: 'Deepa',
        callType: 'VIDEO',
      });

      const acceptSpy = vi.spyOn(useCallStore.getState(), 'acceptCall');
      render(<CallModal />);

      const acceptBtn = screen.getByLabelText('Accept Call');
      fireEvent.click(acceptBtn);

      expect(acceptSpy).toHaveBeenCalled();
    });

    it('renders connected video call screen with controls and duration', () => {
      useCallStore.setState({
        callStatus: 'connected',
        callId: 'call-connected-1',
        peerName: 'Vikram',
        callType: 'VIDEO',
        durationSec: 85,
        localStream: mockStream,
        remoteStream: mockStream,
      });

      render(<CallModal />);

      expect(screen.getByText('01:25')).toBeInTheDocument();
      expect(screen.getByLabelText('Mute microphone')).toBeInTheDocument();
      expect(screen.getByLabelText('Turn camera off')).toBeInTheDocument();
      expect(screen.getByLabelText('End Call')).toBeInTheDocument();
    });

    it('renders call ended message on termination', () => {
      useCallStore.setState({
        callStatus: 'ended',
        errorMessage: 'Call ended: 03:12',
      });

      render(<CallModal />);
      expect(screen.getByText('Call ended: 03:12')).toBeInTheDocument();
    });
  });
});
