import React, { useState } from 'react';
import { Pin, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';

export const PinnedMessagesBar: React.FC = () => {
  const { activeConversationId, pinnedMessages, unpinMessage } = useChatStore();
  const { token } = useAuthStore();
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!activeConversationId) return null;

  const pins = pinnedMessages[activeConversationId] || [];
  if (pins.length === 0) return null;

  const validIndex = Math.min(currentIndex, pins.length - 1);
  const currentPin = pins[validIndex];
  if (!currentPin) return null;

  const handleScrollToMessage = () => {
    const el = document.getElementById(`msg-${currentPin.messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-purple-400', 'transition-all');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-purple-400');
      }, 2000);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % pins.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + pins.length) % pins.length);
  };

  const handleUnpin = (e: React.MouseEvent) => {
    e.stopPropagation();
    unpinMessage(activeConversationId, currentPin.messageId, token || undefined);
  };

  return (
    <div
      onClick={handleScrollToMessage}
      className="bg-purple-50/90 dark:bg-purple-950/40 border-b border-purple-200/60 dark:border-purple-900/50 px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-purple-100/90 dark:hover:bg-purple-900/30 transition backdrop-blur-sm"
      title="Click to jump to pinned message"
    >
      <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
        <div className="w-6 h-6 rounded-md bg-purple-100 dark:bg-purple-900/60 flex items-center justify-center shrink-0 text-purple-600 dark:text-purple-300">
          <Pin className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
            <span>Pinned Message {pins.length > 1 ? `(${validIndex + 1}/${pins.length})` : ''}</span>
            {currentPin.message?.sender?.displayName && (
              <span className="text-gray-400 font-normal">
                • {currentPin.message.sender.displayName}
              </span>
            )}
          </span>
          <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
            {currentPin.message?.content || 'Attachment'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 ml-2">
        {pins.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="p-1 hover:bg-purple-200/70 dark:hover:bg-purple-800/60 rounded-md text-purple-700 dark:text-purple-300 transition"
              title="Previous pinned message"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1 hover:bg-purple-200/70 dark:hover:bg-purple-800/60 rounded-md text-purple-700 dark:text-purple-300 transition"
              title="Next pinned message"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={handleUnpin}
          className="p-1 hover:bg-purple-200/70 dark:hover:bg-purple-800/60 rounded-md text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-200 transition ml-1"
          title="Unpin message"
          aria-label="Unpin message"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
