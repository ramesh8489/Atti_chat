import React, { useState } from 'react';
import { Conversation } from '../../types';
import {
  Phone,
  Video,
  ArrowLeft,
  MoreVertical,
  Shield,
  Search,
  Star,
  BellOff,
  Bell,
  UserX,
  Settings,
} from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useCallStore } from '../../store/callStore';
import { useAuthStore } from '../../store/authStore';

interface ChatHeaderProps {
  conversation: Conversation;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ conversation }) => {
  const {
    setIsMobileChatOpen,
    openCallModal,
    setIsSearchDrawerOpen,
    setIsStarredViewOpen,
    mutedConversationIds,
    muteConversation,
    unmuteConversation,
    blockUser,
    setIsSettingsModalOpen,
  } = useChatStore();
  const { startCall } = useCallStore();
  const { user, token } = useAuthStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isMuted = conversation.isMuted || mutedConversationIds.includes(conversation.id);
  const isGroup = conversation.type === 'GROUP';
  const otherParticipant = conversation.participants.find((p) => p.id !== user?.id);
  const subtitle = isGroup
    ? `${conversation.participants.length} participants`
    : conversation.isOnline
    ? 'Online'
    : 'Offline';

  const handleCall = (type: 'AUDIO' | 'VIDEO') => {
    const otherParticipant = conversation.participants.find((p) => p.id !== user?.id);
    if (otherParticipant && token) {
      startCall(
        conversation.id,
        otherParticipant.id,
        conversation.title,
        type,
        token,
        conversation.avatarUrl
      );
    } else {
      openCallModal(type);
    }
  };

  return (
    <div className="h-16 px-4 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md flex items-center justify-between transition-colors z-10">
      {/* Left: Mobile back button & User Details */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsMobileChatOpen(false)}
          className="md:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="relative">
          {conversation.avatarUrl ? (
            <img
              src={conversation.avatarUrl}
              alt={conversation.title}
              className="w-10 h-10 rounded-xl object-cover ring-2 ring-gray-100 dark:ring-gray-700"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              {conversation.title.charAt(0).toUpperCase()}
            </div>
          )}
          {conversation.isOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-gray-900 rounded-full" />
          )}
        </div>

        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[180px] sm:max-w-xs">
              {conversation.title}
            </h2>
            {isMuted && (
              <span title="Muted">
                <BellOff className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              </span>
            )}
            {conversation.isPreview && (
              <span className="text-[9px] uppercase px-1.5 py-0.2 bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 font-semibold rounded">
                Preview
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
      </div>

      {/* Right: Search, Starred, Call Actions & Options */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Search in chat */}
        <button
          onClick={() => setIsSearchDrawerOpen(true)}
          className="p-2.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-brand-600 dark:hover:text-brand-400 transition"
          title="Search messages"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Starred messages */}
        <button
          onClick={() => setIsStarredViewOpen(true)}
          className="p-2.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-amber-500 dark:hover:text-amber-400 transition"
          title="View starred messages"
        >
          <Star className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-gray-200 dark:border-gray-800 mx-0.5 hidden sm:block" />

        {/* Audio Call */}
        <button
          onClick={() => handleCall('AUDIO')}
          className="p-2.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-brand-600 dark:hover:text-brand-400 transition"
          title="Start Audio Call (WebRTC)"
        >
          <Phone className="w-4 h-4" />
        </button>

        {/* Video Call */}
        <button
          onClick={() => handleCall('VIDEO')}
          className="p-2.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-brand-600 dark:hover:text-brand-400 transition"
          title="Start Video Call (WebRTC)"
        >
          <Video className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-gray-200 dark:border-gray-800 mx-1 hidden sm:block" />

        <div className="hidden lg:flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 px-2 py-1 rounded-md">
          <Shield className="w-3 h-3 text-emerald-500" />
          <span>E2E & STUN Prepared</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <div
              className="absolute right-0 top-12 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl py-1.5 z-50 text-xs animate-in fade-in zoom-in-95"
              onClick={() => setIsMenuOpen(false)}
            >
              {isMuted ? (
                <button
                  onClick={() => token && unmuteConversation(conversation.id, token)}
                  className="w-full text-left px-3.5 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 text-gray-700 dark:text-gray-200"
                >
                  <Bell className="w-4 h-4 text-brand-500" />
                  <span>Unmute notifications</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => token && muteConversation(conversation.id, 8, token)}
                    className="w-full text-left px-3.5 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 text-gray-700 dark:text-gray-200"
                  >
                    <BellOff className="w-4 h-4 text-gray-500" />
                    <span>Mute for 8 hours</span>
                  </button>
                  <button
                    onClick={() => token && muteConversation(conversation.id, 168, token)}
                    className="w-full text-left px-3.5 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 text-gray-700 dark:text-gray-200"
                  >
                    <BellOff className="w-4 h-4 text-gray-500" />
                    <span>Mute for 1 week</span>
                  </button>
                  <button
                    onClick={() => token && muteConversation(conversation.id, undefined, token)}
                    className="w-full text-left px-3.5 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 text-gray-700 dark:text-gray-200"
                  >
                    <BellOff className="w-4 h-4 text-gray-500" />
                    <span>Mute always</span>
                  </button>
                </>
              )}

              {!isGroup && otherParticipant && (
                <button
                  onClick={() => {
                    if (token && window.confirm(`Are you sure you want to block ${otherParticipant.displayName || 'this user'}?`)) {
                      blockUser(otherParticipant.id, token);
                    }
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 text-rose-600 dark:text-rose-400 border-t border-gray-100 dark:border-gray-800 mt-1"
                >
                  <UserX className="w-4 h-4" />
                  <span>Block user</span>
                </button>
              )}

              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="w-full text-left px-3.5 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 text-gray-700 dark:text-gray-200 border-t border-gray-100 dark:border-gray-800 mt-1"
              >
                <Settings className="w-4 h-4 text-gray-500" />
                <span>Settings</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

