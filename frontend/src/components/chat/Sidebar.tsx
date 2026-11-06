import React from 'react';
import { Search, Plus, Sparkles, Filter, Loader2, Radio } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { ConversationItem } from './ConversationItem';

export const Sidebar: React.FC = () => {
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    setIsNewChatModalOpen,
    isLoadingConversations,
    typingMap,
  } = useChatStore();

  const { token, isAuthenticated } = useAuthStore();

  const filtered = conversations.filter((c) => {
    // Search query filter
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessage?.content.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Tab filter
    if (activeTab === 'unread') return c.unreadCount > 0;
    if (activeTab === 'groups') return c.type === 'GROUP';
    return true;
  });

  return (
    <aside className="w-full md:w-80 lg:w-96 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col h-full transition-colors">
      {/* Search & Actions Bar */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            Chats
          </h2>
          <button
            onClick={() => setIsNewChatModalOpen(true)}
            className="p-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white shadow-sm transition"
            title="Start New Conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search input */}
        <div className="flex items-center px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 focus-within:ring-2 focus-within:ring-brand-500 transition">
          <Search className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-gray-900 dark:text-white placeholder-gray-400 outline-none"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 pt-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
              activeTab === 'all'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('unread')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition flex items-center gap-1 ${
              activeTab === 'unread'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Unread
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
              activeTab === 'groups'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Groups
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoadingConversations ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500 mb-2" />
            <p className="text-xs">Loading conversations...</p>
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={activeConversationId === conv.id}
              isTyping={!!typingMap[conv.id]}
              onClick={() => setActiveConversationId(conv.id, token || undefined)}
            />
          ))
        ) : (
          <div className="p-8 text-center text-gray-400 dark:text-gray-500">
            <Filter className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs font-medium">No conversations match your filter</p>
          </div>
        )}
      </div>

      {/* Bottom Status Notice */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          {isAuthenticated ? (
            <>
              <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" /> Socket.IO Real-Time Gateway
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-brand-500" /> Preview Mode
            </>
          )}
        </span>
        <span className="font-mono text-[10px] text-gray-400">v0.3.0</span>
      </div>
    </aside>
  );
};
