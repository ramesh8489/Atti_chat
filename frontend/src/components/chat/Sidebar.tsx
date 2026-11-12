import React from 'react';
import { Search, Plus, MessageSquare, Loader2 } from 'lucide-react';
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

  const { token } = useAuthStore();

  const filtered = conversations.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessage?.content.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'unread') return c.unreadCount > 0;
    if (activeTab === 'groups') return c.type === 'GROUP';
    return true;
  });

  const quickContacts = conversations.slice(0, 8);

  return (
    <aside className="w-full md:w-80 lg:w-[340px] xl:w-[360px] bg-white dark:bg-gray-900 md:rounded-2xl md:border md:border-indigo-100/80 dark:md:border-gray-800 md:shadow-sm flex flex-col h-full overflow-hidden transition-colors">
      {/* Header & Search */}
      <div className="p-4 pb-3 space-y-3 border-b border-gray-100 dark:border-gray-800/80">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            Chats
          </h2>
          <button
            type="button"
            onClick={() => setIsNewChatModalOpen(true)}
            className="p-2 rounded-full bg-brand-500 hover:bg-brand-600 text-white shadow-sm shadow-brand-500/25 transition"
            title="Start New Conversation"
            aria-label="Start New Conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Pill Search input */}
        <div className="flex items-center px-3.5 py-2 rounded-full bg-[#F3F4FC] dark:bg-gray-800 border border-indigo-100/70 dark:border-gray-700/60 focus-within:ring-2 focus-within:ring-brand-500 transition">
          <Search className="w-4 h-4 text-brand-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
          />
        </div>

        {/* Quick Contacts Strip */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pt-1 pb-0.5">
          <button
            type="button"
            onClick={() => setIsNewChatModalOpen(true)}
            className="flex flex-col items-center gap-1 flex-shrink-0 group"
            title="Add new chat"
          >
            <span className="w-11 h-11 rounded-full border-2 border-dashed border-brand-300 dark:border-brand-700 text-brand-500 group-hover:bg-brand-50 dark:group-hover:bg-brand-950/50 flex items-center justify-center transition">
              <Plus className="w-5 h-5" />
            </span>
            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">New</span>
          </button>

          {quickContacts.map((c) => (
            <button
              key={`quick-${c.id}`}
              type="button"
              onClick={() => setActiveConversationId(c.id, token || undefined)}
              className="flex flex-col items-center gap-1 flex-shrink-0 max-w-[52px]"
            >
              <div className="relative">
                {c.avatarUrl ? (
                  <img
                    src={c.avatarUrl}
                    alt={c.title}
                    className={`w-11 h-11 rounded-full object-cover ring-2 transition ${
                      activeConversationId === c.id
                        ? 'ring-brand-500'
                        : 'ring-indigo-100 dark:ring-gray-700'
                    }`}
                  />
                ) : (
                  <div
                    className={`w-11 h-11 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 text-white flex items-center justify-center font-bold text-sm ring-2 transition ${
                      activeConversationId === c.id
                        ? 'ring-brand-500'
                        : 'ring-indigo-100 dark:ring-gray-700'
                    }`}
                  >
                    {c.title.charAt(0).toUpperCase()}
                  </div>
                )}
                {c.isOnline && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-gray-900 rounded-full" />
                )}
              </div>
              <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300 truncate w-full text-center">
                {c.title.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 pt-0.5">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1 rounded-full text-xs font-semibold transition ${
              activeTab === 'all'
                ? 'bg-gray-900 dark:bg-brand-500 text-white shadow-sm'
                : 'bg-[#F3F4FC] dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-indigo-100/70 dark:hover:bg-gray-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('unread')}
            className={`px-3.5 py-1 rounded-full text-xs font-semibold transition flex items-center gap-1 ${
              activeTab === 'unread'
                ? 'bg-gray-900 dark:bg-brand-500 text-white shadow-sm'
                : 'bg-[#F3F4FC] dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-indigo-100/70 dark:hover:bg-gray-700'
            }`}
          >
            Unread
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-3.5 py-1 rounded-full text-xs font-semibold transition ${
              activeTab === 'groups'
                ? 'bg-gray-900 dark:bg-brand-500 text-white shadow-sm'
                : 'bg-[#F3F4FC] dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-indigo-100/70 dark:hover:bg-gray-700'
            }`}
          >
            Groups
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
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
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs font-medium">
              {conversations.length === 0
                ? 'No chats yet. Tap + to message a friend!'
                : 'No conversations match your search'}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};
