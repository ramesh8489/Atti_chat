import React, { useState, useEffect } from 'react';
import { X, Search, Users, User, Check, Loader2, MessageSquarePlus } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';

export const NewChatModal: React.FC = () => {
  const {
    isNewChatModalOpen,
    setIsNewChatModalOpen,
    searchedUsers,
    isSearchingUsers,
    searchUsers,
    createDirectChat,
    createGroupChat,
  } = useChatStore();

  const { token } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'direct' | 'group'>('direct');
  const [searchTerm, setSearchTerm] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNewChatModalOpen) {
      setSearchTerm('');
      setGroupTitle('');
      setSelectedUserIds([]);
      setError(null);
      return;
    }
    // Initial fetch when opened
    if (token) {
      searchUsers('', token);
    }
  }, [isNewChatModalOpen, token]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (token) {
      searchUsers(val, token);
    }
  };

  const handleStartDirectChat = async (targetUserId: string) => {
    if (!token) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await createDirectChat(targetUserId, token);
      setIsNewChatModalOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to start conversation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  const handleCreateGroup = async () => {
    if (!token) return;
    if (!groupTitle.trim()) {
      setError('Please provide a group title.');
      return;
    }
    if (selectedUserIds.length === 0) {
      setError('Please select at least 1 member for the group.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await createGroupChat(groupTitle.trim(), selectedUserIds, token);
      setIsNewChatModalOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isNewChatModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-500/10 text-brand-500 rounded-xl">
              <MessageSquarePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                New Conversation
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Connect with contacts or create a group
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsNewChatModalOpen(false)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 px-5 pt-3 gap-6 text-sm font-semibold">
          <button
            onClick={() => {
              setActiveTab('direct');
              setError(null);
            }}
            className={`pb-3 flex items-center gap-2 border-b-2 transition ${
              activeTab === 'direct'
                ? 'border-brand-500 text-brand-500'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <User className="w-4 h-4" /> Direct Chat
          </button>
          <button
            onClick={() => {
              setActiveTab('group');
              setError(null);
            }}
            className={`pb-3 flex items-center gap-2 border-b-2 transition ${
              activeTab === 'group'
                ? 'border-brand-500 text-brand-500'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" /> Create Group
          </button>
        </div>

        {/* Error notice */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {activeTab === 'group' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Group Title
              </label>
              <input
                type="text"
                placeholder="e.g. Design Sync, Family Group"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-brand-500 transition"
              />
            </div>
          )}

          {/* User Search Bar */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              {activeTab === 'direct' ? 'Search Contacts' : 'Select Members'}
            </label>
            <div className="flex items-center px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-brand-500 transition">
              <Search className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search by name, username, or phone..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full bg-transparent text-xs text-gray-900 dark:text-white placeholder-gray-400 outline-none"
              />
              {isSearchingUsers && <Loader2 className="w-4 h-4 text-brand-500 animate-spin" />}
            </div>
          </div>

          {/* User List */}
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {searchedUsers.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400">
                {searchTerm ? 'No matching users found.' : 'Search for users to start chatting.'}
              </div>
            ) : (
              searchedUsers.map((u) => {
                const isSelected = selectedUserIds.includes(u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => {
                      if (activeTab === 'group') {
                        toggleSelectUser(u.id);
                      }
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-2xl transition cursor-pointer ${
                      isSelected
                        ? 'bg-brand-500/10 border border-brand-500/30'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative flex-shrink-0">
                        {u.avatarUrl ? (
                          <img
                            src={u.avatarUrl}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-500 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                            {(u.displayName || u.phoneNumber).slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        {u.isOnline && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-gray-900 rounded-full" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {u.displayName || u.phoneNumber}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {u.username ? `@${u.username}` : u.phoneNumber}
                        </p>
                      </div>
                    </div>

                    {activeTab === 'direct' ? (
                      <button
                        disabled={isSubmitting}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartDirectChat(u.id);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                      >
                        Chat
                      </button>
                    ) : (
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center border transition ${
                          isSelected
                            ? 'bg-brand-500 border-brand-500 text-white'
                            : 'border-gray-300 dark:border-gray-700'
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        {activeTab === 'group' && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {selectedUserIds.length} members selected
            </span>
            <button
              disabled={isSubmitting || selectedUserIds.length === 0 || !groupTitle.trim()}
              onClick={handleCreateGroup}
              className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Group
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
