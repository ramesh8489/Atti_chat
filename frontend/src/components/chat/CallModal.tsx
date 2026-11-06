import React, { useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  PhoneOff,
  RefreshCw,
  Maximize2,
  Minimize2,
  Radio,
  AlertCircle,
} from 'lucide-react';
import { useCallStore } from '../../store/callStore';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export const CallModal: React.FC = () => {
  const {
    callStatus,
    callType,
    peerName,
    peerAvatar,
    durationSec,
    isMuted,
    isVideoEnabled,
    localStream,
    remoteStream,
    errorMessage,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    switchCamera,
  } = useCallStore();
  const { token } = useAuthStore();

  const {
    isCallModalOpen,
    callType: previewCallType,
    closeCallModal,
    conversations,
    activeConversationId,
  } = useChatStore();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Bind local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callStatus]);

  // Bind remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callStatus]);

  if (callStatus === 'idle' && !isCallModalOpen) return null;

  // Preview Mode Fallback
  if (callStatus === 'idle' && isCallModalOpen) {
    const activeConv = conversations.find((c) => c.id === activeConversationId);
    const calleeName = activeConv?.title || 'Contact';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={closeCallModal} />
        <div className="relative w-full max-w-lg bg-gray-900 border border-gray-800 rounded-3xl p-8 text-white shadow-2xl flex flex-col items-center text-center">
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-800 text-brand-400 text-xs font-semibold rounded-full border border-gray-700 mb-6">
            <Radio className="w-3.5 h-3.5 animate-pulse text-brand-400" />
            <span>WebRTC {previewCallType === 'VIDEO' ? 'Video' : 'Voice'} Call Preview</span>
          </div>

          <div className="relative my-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-3xl font-bold shadow-2xl ring-4 ring-brand-500/30">
              {calleeName.charAt(0).toUpperCase()}
            </div>
          </div>

          <h3 className="text-xl font-bold mt-2">{calleeName}</h3>
          <p className="text-xs text-gray-400 mt-1">Calling... (Preview Mode)</p>

          <div className="flex items-center gap-4 mt-6">
            <button
              onClick={closeCallModal}
              className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 transition"
              title="End Call"
              aria-label="End Call"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isVideo = callType === 'VIDEO';
  const isIncoming = callStatus === 'incoming';
  const isRinging = callStatus === 'ringing' || callStatus === 'initiating';
  const isConnected = callStatus === 'connected';
  const isReconnecting = callStatus === 'reconnecting';
  const isEnding = ['ended', 'rejected', 'busy', 'unavailable', 'failed'].includes(callStatus);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in text-white select-none"
    >
      <div
        className={`relative w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center justify-between transition-all ${
          isVideo && isConnected ? 'h-[85vh] sm:h-[90vh]' : 'p-6 sm:p-10 max-w-md'
        }`}
      >
        {/* Top Header / Status bar */}
        <div className="w-full flex items-center justify-between px-4 py-3 z-20">
          <div className="flex items-center gap-2 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-xs">
            <Radio className="w-3.5 h-3.5 animate-pulse text-brand-400" />
            <span className="font-medium text-gray-200">
              WebRTC {isVideo ? 'Video' : 'Voice'} Call
            </span>
          </div>

          {isConnected && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-xs font-mono font-semibold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>{formatDuration(durationSec)}</span>
            </div>
          )}

          {isVideo && isConnected && (
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-gray-300 hover:text-white transition"
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Video Call Active View */}
        {isVideo && (isConnected || isReconnecting) ? (
          <div className="relative w-full flex-1 overflow-hidden bg-black flex items-center justify-center">
            {/* Remote Video Stream */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Reconnecting Overlay */}
            {isReconnecting && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-10 gap-2">
                <RefreshCw className="w-8 h-8 animate-spin text-brand-400" />
                <span className="text-sm font-semibold">Reconnecting WebRTC stream...</span>
              </div>
            )}

            {/* Local Camera Picture-in-Picture */}
            <div className="absolute bottom-20 right-4 sm:bottom-24 sm:right-6 w-28 h-40 sm:w-36 sm:h-48 rounded-2xl overflow-hidden border-2 border-brand-500 shadow-2xl bg-gray-900 z-10">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${!isVideoEnabled ? 'hidden' : ''}`}
              />
              {!isVideoEnabled && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 text-gray-400 text-xs p-2 text-center">
                  <VideoOff className="w-6 h-6 mb-1 text-gray-500" />
                  <span>Camera off</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Voice Call or Ringing State View */
          <div className="my-6 flex flex-col items-center text-center">
            {/* Avatar with pulse ring */}
            <div className="relative my-4">
              {peerAvatar ? (
                <img
                  src={peerAvatar}
                  alt={peerName || 'Peer'}
                  className="w-28 h-28 rounded-full object-cover ring-4 ring-brand-500/30 shadow-2xl"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-4xl font-bold shadow-2xl ring-4 ring-brand-500/30">
                  {peerName ? peerName.charAt(0).toUpperCase() : 'U'}
                </div>
              )}

              {(isRinging || isIncoming) && (
                <span className="absolute -inset-2 rounded-full border-2 border-brand-400 animate-ping opacity-40 pointer-events-none" />
              )}
            </div>

            <h3 className="text-2xl font-bold text-white mt-2">{peerName || 'Contact'}</h3>

            {/* Status description */}
            <p className="text-sm text-gray-400 mt-1.5">
              {isIncoming && 'Incoming Call...'}
              {callStatus === 'initiating' && 'Calling...'}
              {callStatus === 'ringing' && 'Ringing...'}
              {callStatus === 'connecting' && 'Connecting WebRTC media...'}
              {callStatus === 'connected' && 'Call in progress'}
              {callStatus === 'reconnecting' && 'Reconnecting network...'}
              {callStatus === 'busy' && 'User is on another call'}
              {callStatus === 'rejected' && 'Call declined'}
              {callStatus === 'unavailable' && 'User unavailable'}
              {callStatus === 'ended' && 'Call ended'}
              {callStatus === 'failed' && (errorMessage || 'Call failed')}
            </p>

            {/* Error banner if present */}
            {errorMessage && !isEnding && (
              <div className="mt-3 px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Bottom Call Controls */}
        <div className="w-full p-4 sm:p-6 flex items-center justify-center gap-4 sm:gap-6 z-20">
          {/* Incoming Call: Accept / Decline */}
          {isIncoming && (
            <div className="flex items-center gap-8">
              {/* Reject */}
              <button
                type="button"
                onClick={() => rejectCall('DECLINED')}
                className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/40 transition active:scale-95"
                title="Decline"
                aria-label="Decline Call"
              >
                <PhoneOff className="w-7 h-7" />
              </button>

              {/* Accept */}
              <button
                type="button"
                onClick={() => acceptCall(token || '')}
                className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 animate-bounce active:scale-95"
                title="Accept"
                aria-label="Accept Call"
              >
                <Phone className="w-7 h-7" />
              </button>
            </div>
          )}

          {/* Active Call / Ringing: Controls */}
          {!isIncoming && !isEnding && (
            <div className="flex items-center gap-3 sm:gap-5">
              {/* Mute Microphone */}
              <button
                type="button"
                onClick={toggleMute}
                className={`p-3.5 sm:p-4 rounded-full transition active:scale-95 ${
                  isMuted
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                }`}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Toggle Video (for video calls) */}
              {isVideo && (
                <>
                  <button
                    type="button"
                    onClick={toggleVideo}
                    className={`p-3.5 sm:p-4 rounded-full transition active:scale-95 ${
                      !isVideoEnabled
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                        : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                    }`}
                    title={isVideoEnabled ? 'Turn camera off' : 'Turn camera on'}
                    aria-label={isVideoEnabled ? 'Turn camera off' : 'Turn camera on'}
                  >
                    {!isVideoEnabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                  </button>

                  {/* Switch Camera */}
                  <button
                    type="button"
                    onClick={switchCamera}
                    className="p-3.5 sm:p-4 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-200 transition active:scale-95"
                    title="Switch camera"
                    aria-label="Switch camera"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* End Call Button */}
              <button
                type="button"
                onClick={() => endCall('USER_HANGUP')}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/40 transition active:scale-95"
                title="End Call"
                aria-label="End Call"
              >
                <PhoneOff className="w-6 h-6 sm:w-7 sm:h-7" />
              </button>
            </div>
          )}

          {/* Ended / Busy state */}
          {isEnding && (
            <div className="text-center py-2">
              <span className="text-sm font-semibold text-gray-300">
                {errorMessage || 'Call finished'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
