import React, { useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { PinnedMessagesBar } from './PinnedMessagesBar';
import { ForwardMessageModal } from './ForwardMessageModal';
import { MessageSearchDrawer } from './MessageSearchDrawer';
import { ChatInfoPanel } from './ChatInfoPanel';
import { MessageSquare, Plus } from 'lucide-react';

export const ChatWindow: React.FC = () => {
  const { conversations, activeConversationId, messages, setIsNewChatModalOpen } = useChatStore();
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const activeMessages = activeConversationId ? messages[activeConversationId] || [] : [];

  if (!activeConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-gray-900 md:rounded-2xl md:border md:border-indigo-100/80 dark:md:border-gray-800 md:shadow-sm">
        <div className="w-16 h-16 rounded-3xl bg-brand-50 dark:bg-brand-950/60 text-brand-500 flex items-center justify-center mb-4">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Select a Conversation
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mt-2">
          Choose a chat from the sidebar or start a new conversation with your friends.
        </p>

        <button
          type="button"
          onClick={() => setIsNewChatModalOpen(true)}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold shadow-md shadow-brand-500/25 transition"
        >
          <Plus className="w-4 h-4" /> Start New Chat
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex h-full overflow-hidden md:gap-3">
      <div className="flex-1 flex flex-col h-full bg-white dark:bg-gray-900 md:rounded-2xl md:border md:border-indigo-100/80 dark:md:border-gray-800 md:shadow-sm overflow-hidden relative min-w-0">
        <ChatHeader
          conversation={activeConversation}
          onToggleInfo={() => setIsInfoOpen((prev) => !prev)}
          isInfoOpen={isInfoOpen}
        />
        <PinnedMessagesBar />
        <MessageList messages={activeMessages} />
        <MessageInput />

        <ForwardMessageModal />
        <MessageSearchDrawer />
      </div>

      <ChatInfoPanel
        conversation={activeConversation}
        messages={activeMessages}
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
      />
    </div>
  );
};
