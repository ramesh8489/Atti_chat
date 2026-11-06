import React from 'react';
import { Conversation } from '../../types';
import { Users, Check, CheckCheck, BellOff } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  isTyping?: boolean;
  onClick: () => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  isTyping = false,
  onClick,
}) => {
  const { mutedConversationIds } = useChatStore();
  const isMuted = conversation.isMuted || mutedConversationIds.includes(conversation.id);

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isGroup = conversation.type === 'GROUP';

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`w-full p-3 flex items-center gap-3 rounded-2xl cursor-pointer transition-all ${
        isActive
          ? 'bg-brand-500/10 dark:bg-brand-500/20 border-l-4 border-brand-500 pl-2.5'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800/60'
      }`}
    >
      {/* Avatar Container */}
      <div className="relative flex-shrink-0">
        {conversation.avatarUrl ? (
          <img
            src={conversation.avatarUrl}
            alt={conversation.title}
            className="w-12 h-12 rounded-2xl object-cover ring-2 ring-gray-200 dark:ring-gray-700"
          />
        ) : (
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white flex items-center justify-center font-bold text-base shadow-sm">
            {isGroup ? <Users className="w-5 h-5" /> : conversation.title.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Online Presence Indicator */}
        {conversation.isOnline && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-gray-900 rounded-full" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 truncate">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {conversation.title}
            </h3>
            {isMuted && (
              <span data-testid="conversation-muted-icon" title="Muted" className="inline-flex items-center">
                <BellOff className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              </span>
            )}
          </div>
          <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0 ml-1">
            {formatTime(conversation.lastMessage?.createdAt || conversation.updatedAt)}
          </span>
        </div>

        <div className="flex items-center justify-between mt-1">
          {isTyping ? (
            <p className="text-xs text-brand-500 font-medium italic animate-pulse">
              typing...
            </p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
              {conversation.lastMessage?.status === 'READ' && (
                <CheckCheck className="w-3.5 h-3.5 text-brand-500 inline flex-shrink-0" />
              )}
              {conversation.lastMessage?.status === 'DELIVERED' && (
                <CheckCheck className="w-3.5 h-3.5 text-gray-400 inline flex-shrink-0" />
              )}
              {conversation.lastMessage?.status === 'SENT' && (
                <Check className="w-3.5 h-3.5 text-gray-400 inline flex-shrink-0" />
              )}
              <span>{conversation.lastMessage?.content || 'No messages yet'}</span>
            </p>
          )}

          {conversation.unreadCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold text-white bg-brand-500 rounded-full min-w-[18px] text-center">
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
