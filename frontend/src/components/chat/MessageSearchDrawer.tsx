import React, { useState, useEffect } from 'react';
import { Search, Star, X, Loader2, ArrowRight } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';

export const MessageSearchDrawer: React.FC = () => {
  const {
    activeConversationId,
    isSearchDrawerOpen,
    setIsSearchDrawerOpen,
    isStarredViewOpen,
    setIsStarredViewOpen,
    messageSearchQuery,
    isSearchingMessages,
    messageSearchResults,
    searchMessages,
    clearMessageSearch,
    starredMessages,
    loadStarredMessages,
    setActiveConversationId,
  } = useChatStore();
  const { token } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'search' | 'starred'>(
    isStarredViewOpen ? 'starred' : 'search'
  );
  const [localQuery, setLocalQuery] = useState(messageSearchQuery);
  const [searchScope, setSearchScope] = useState<'this' | 'all'>('this');

  useEffect(() => {
    if (isStarredViewOpen) {
      setActiveTab('starred');
      loadStarredMessages(token || undefined);
    }
  }, [isStarredViewOpen, token]);

  const handleClose = () => {
    setIsSearchDrawerOpen(false);
    setIsStarredViewOpen(false);
    clearMessageSearch();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localQuery.trim()) return;
    const convId = searchScope === 'this' ? activeConversationId || undefined : undefined;
    searchMessages(localQuery.trim(), token || undefined, convId);
  };

  const handleJumpToMessage = async (conversationId: string, messageId: string) => {
    if (activeConversationId !== conversationId) {
      await setActiveConversationId(conversationId, token || undefined);
    }
    handleClose();
    setTimeout(() => {
      const el = document.getElementById(`msg-${messageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-brand-500', 'transition-all');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-brand-500');
        }, 2000);
      }
    }, 300);
  };

  const highlightTerm = (text: string, term: string) => {
    if (!term.trim()) return text;
    const parts = text.split(new RegExp(`(${term})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === term.toLowerCase() ? (
        <mark key={i} className="bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  if (!isSearchDrawerOpen && !isStarredViewOpen) return null;

  return (
    <div className="absolute top-0 right-0 bottom-0 w-full sm:w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'search'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Search
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('starred');
              loadStarredMessages(token || undefined);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'starred'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            Starred
          </button>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
          aria-label="Close search drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {activeTab === 'search' ? (
        <>
          {/* Search Controls */}
          <form onSubmit={handleSearch} className="p-3 border-b border-gray-200 dark:border-gray-800 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                placeholder="Search messages..."
                className="w-full pl-9 pr-8 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-brand-500"
              />
              {localQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalQuery('');
                    clearMessageSearch();
                  }}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400 px-1">
              <span>Scope:</span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={searchScope === 'this'}
                  onChange={() => setSearchScope('this')}
                  className="text-brand-500"
                />
                This chat
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={searchScope === 'all'}
                  onChange={() => setSearchScope('all')}
                  className="text-brand-500"
                />
                All chats
              </label>
            </div>
          </form>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isSearchingMessages && (
              <div className="flex items-center justify-center py-8 text-xs text-brand-600 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Searching messages...
              </div>
            )}

            {!isSearchingMessages && messageSearchResults.length === 0 && localQuery.trim() && (
              <div className="text-center py-8 text-xs text-gray-400">
                No matching messages found for "{localQuery}"
              </div>
            )}

            {!isSearchingMessages && !localQuery.trim() && (
              <div className="text-center py-8 text-xs text-gray-400">
                Type keyword and press Enter to search
              </div>
            )}

            {messageSearchResults.map((msg) => (
              <button
                key={msg.id}
                type="button"
                onClick={() => handleJumpToMessage(msg.conversationId, msg.id)}
                className="w-full text-left p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800 transition flex flex-col gap-1 group"
              >
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {msg.senderName}
                  </span>
                  <span>{new Date(msg.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                </div>
                <p className="text-xs text-gray-800 dark:text-gray-200 line-clamp-2 leading-relaxed">
                  {highlightTerm(msg.content, localQuery)}
                </p>
                <div className="flex items-center justify-between mt-1 text-[10px] text-brand-600 dark:text-brand-400 opacity-0 group-hover:opacity-100 transition">
                  <span>Click to jump</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        /* Starred Messages View */
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {starredMessages.length === 0 ? (
            <div className="text-center py-12 text-xs text-gray-400 flex flex-col items-center gap-2">
              <Star className="w-8 h-8 text-gray-300 dark:text-gray-600" />
              <span>No starred messages yet.</span>
              <span className="text-[11px] text-gray-400">Star messages to easily find them later.</span>
            </div>
          ) : (
            starredMessages.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleJumpToMessage(item.message.conversationId, item.messageId)}
                className="w-full text-left p-3 rounded-xl border border-amber-100 dark:border-amber-950/60 bg-amber-50/30 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition flex flex-col gap-1 group"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                    {item.message.sender?.displayName || 'User'}
                  </span>
                  <span className="text-gray-400 text-[10px]">
                    {new Date(item.message.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="text-xs text-gray-800 dark:text-gray-200 line-clamp-2 italic">
                  "{item.message.content || 'Attachment'}"
                </p>
                <div className="flex items-center justify-between mt-1 text-[10px] text-amber-600 dark:text-amber-400 opacity-0 group-hover:opacity-100 transition">
                  <span>Jump to message</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
