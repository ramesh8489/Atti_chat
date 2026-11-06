export interface WebRTCCallbacks {
  onRemoteTrack: (stream: MediaStream) => void;
  onIceCandidate: (candidate: RTCIceCandidate) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
}

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private currentFacingMode: 'user' | 'environment' = 'user';

  /**
   * Acquire camera/microphone media stream from browser.
   */
  public async getLocalMedia(type: 'AUDIO' | 'VIDEO'): Promise<MediaStream> {
    this.stopMediaTracks(this.localStream);

    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video:
        type === 'VIDEO'
          ? {
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              facingMode: this.currentFacingMode,
            }
          : false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      return stream;
    } catch (err: any) {
      console.error('[WebRTCService] getUserMedia failed:', err);
      throw err;
    }
  }

  /**
   * Initialize RTCPeerConnection with configured STUN/TURN servers.
   */
  public createPeerConnection(
    iceServers: RTCIceServer[],
    callbacks: WebRTCCallbacks
  ): RTCPeerConnection {
    if (this.peerConnection) {
      this.cleanupPeerConnection();
    }

    const config: RTCConfiguration = {
      iceServers: iceServers.length > 0 ? iceServers : [{ urls: 'stun:stun.l.google.com:19302' }],
      iceCandidatePoolSize: 10,
    };

    const pc = new RTCPeerConnection(config);
    this.peerConnection = pc;
    this.remoteStream = new MediaStream();
    this.pendingCandidates = [];

    // Local ICE candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        callbacks.onIceCandidate(event.candidate);
      }
    };

    // Remote media track arrival
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        callbacks.onRemoteTrack(event.streams[0]);
      } else {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        this.remoteStream.addTrack(event.track);
        callbacks.onRemoteTrack(this.remoteStream);
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      callbacks.onConnectionStateChange(pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce();
      }
    };

    // Add local media tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    return pc;
  }

  /**
   * Caller generates SDP Offer.
   */
  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  /**
   * Callee sets remote offer and generates SDP Answer.
   */
  public async handleOffer(offerSdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offerSdp));
    await this.drainPendingCandidates();

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  /**
   * Caller receives and applies SDP Answer.
   */
  public async handleAnswer(answerSdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerSdp));
    await this.drainPendingCandidates();
  }

  /**
   * Add ICE candidate received from peer (queues if remote description not yet set).
   */
  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[WebRTCService] Failed to add ICE candidate:', err);
    }
  }

  private async drainPendingCandidates(): Promise<void> {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;

    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('[WebRTCService] Error draining queued candidate:', err);
        }
      }
    }
  }

  /**
   * Toggle local microphone mute/unmute.
   */
  public toggleAudio(enabled?: boolean): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = enabled !== undefined ? enabled : !audioTrack.enabled;
      return audioTrack.enabled;
    }
    return false;
  }

  /**
   * Toggle local video camera on/off.
   */
  public toggleVideo(enabled?: boolean): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = enabled !== undefined ? enabled : !videoTrack.enabled;
      return videoTrack.enabled;
    }
    return false;
  }

  /**
   * Switch between front (user) and back (environment) camera.
   */
  public async switchCamera(): Promise<MediaStream | null> {
    if (!this.localStream || this.localStream.getVideoTracks().length === 0) return null;

    this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    const oldTrack = this.localStream.getVideoTracks()[0];
    oldTrack.stop();

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.currentFacingMode },
      });
      const newTrack = newStream.getVideoTracks()[0];

      this.localStream.removeTrack(oldTrack);
      this.localStream.addTrack(newTrack);

      if (this.peerConnection) {
        const sender = this.peerConnection
          .getSenders()
          .find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(newTrack);
        }
      }
      return this.localStream;
    } catch (err) {
      console.warn('[WebRTCService] Failed to switch camera:', err);
      return null;
    }
  }

  /**
   * Stop all media tracks on a given stream.
   */
  private stopMediaTracks(stream: MediaStream | null): void {
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (err) {
          console.warn('[WebRTCService] Error stopping track:', err);
        }
      });
    }
  }

  private cleanupPeerConnection(): void {
    if (this.peerConnection) {
      this.peerConnection.onicecandidate = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.oniceconnectionstatechange = null;
      try {
        this.peerConnection.close();
      } catch (err) {
        // Ignore close error
      }
      this.peerConnection = null;
    }
    this.pendingCandidates = [];
  }

  /**
   * Complete teardown of peer connection and media streams.
   */
  public cleanup(): void {
    this.stopMediaTracks(this.localStream);
    this.stopMediaTracks(this.remoteStream);
    this.localStream = null;
    this.remoteStream = null;
    this.cleanupPeerConnection();
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }
}

export const webrtcService = new WebRTCService();

