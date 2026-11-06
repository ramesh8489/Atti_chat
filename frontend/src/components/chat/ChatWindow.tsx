import React from 'react';
import { useChatStore } from '../../store/chatStore';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { PinnedMessagesBar } from './PinnedMessagesBar';
import { ForwardMessageModal } from './ForwardMessageModal';
import { MessageSearchDrawer } from './MessageSearchDrawer';
import { MessageSquare, ShieldCheck, Zap } from 'lucide-react';

export const ChatWindow: React.FC = () => {
  const { conversations, activeConversationId, messages } = useChatStore();

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const activeMessages = activeConversationId ? messages[activeConversationId] || [] : [];

  if (!activeConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 dark:bg-gray-950/50">
        <div className="w-16 h-16 rounded-3xl bg-brand-500/10 text-brand-500 flex items-center justify-center mb-4">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Select a Conversation
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mt-2">
          Choose a conversation from the sidebar to start real-time messaging, or search for contacts.
        </p>

        <div className="mt-8 flex items-center gap-6 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Verified Security
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-brand-500" /> Socket.IO Real-Time
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/50 dark:bg-gray-900 overflow-hidden relative">
      <ChatHeader conversation={activeConversation} />
      <PinnedMessagesBar />
      <MessageList messages={activeMessages} />
      <MessageInput />

      {/* Phase 6 Advanced Modals & Drawers */}
      <ForwardMessageModal />
      <MessageSearchDrawer />
    </div>
  );
};
