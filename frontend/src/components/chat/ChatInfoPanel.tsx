import React, { useState } from 'react';
import { X, Users, Image as ImageIcon, FileText, BellOff, Bell, Shield, MessageSquare } from 'lucide-react';
import { Conversation, Message } from '../../types';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';

interface ChatInfoPanelProps {
  conversation: Conversation;
  messages: Message[];
  isOpen: boolean;
  onClose: () => void;
}

export const ChatInfoPanel: React.FC<ChatInfoPanelProps> = ({
  conversation,
  messages,
  isOpen,
  onClose,
}) => {
  const [tab, setTab] = useState<'members' | 'media'>('members');
  const {
    mutedConversationIds,
    muteConversation,
    unmuteConversation,
    setIsSettingsModalOpen,
  } = useChatStore();
  const { token } = useAuthStore();

  if (!isOpen) return null;

  const isMuted = conversation.isMuted || mutedConversationIds.includes(conversation.id);
  const sharedMedia = messages.flatMap((m) => m.attachments || []);

  return (
    <aside
      aria-label="Conversation details"
      className="fixed inset-y-0 right-0 z-40 w-full max-w-xs sm:max-w-sm xl:static xl:z-auto xl:w-72 2xl:w-80 bg-white dark:bg-gray-900 xl:rounded-2xl border-l xl:border border-indigo-100/80 dark:border-gray-800 shadow-xl xl:shadow-sm flex flex-col h-full overflow-hidden flex-shrink-0"
    >
      {/* Tabs Header */}
      <div className="flex items-center border-b border-gray-100 dark:border-gray-800 bg-[#FAFBFD] dark:bg-gray-900">
        <button
          type="button"
          onClick={() => setTab('members')}
          className={`flex-1 py-3.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            tab === 'members'
              ? 'bg-brand-500 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Chat Members</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('media')}
          className={`flex-1 py-3.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            tab === 'media'
              ? 'bg-brand-500 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Media Files</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat details"
          className="p-3 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 xl:hidden"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'members' ? (
          <>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">
                Members ({conversation.participants.length})
              </p>
              <div className="space-y-2.5">
                {conversation.participants.map((member) => (
                  <div
                    key={member.id}
                    className="p-3 rounded-2xl bg-[#F7F8FE] dark:bg-gray-800/60 border border-indigo-100/70 dark:border-gray-700/60 flex items-center justify-between gap-2.5 shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative flex-shrink-0">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.displayName || 'Member'}
                            className="w-9 h-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 text-white flex items-center justify-center text-xs font-bold">
                            {(member.displayName || member.phoneNumber || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        {member.isOnline && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-900" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                          {member.displayName || member.username || member.phoneNumber}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                          {member.role ? member.role.toLowerCase() : member.isOnline ? 'Online' : 'Offline'}
                        </p>
                      </div>
                    </div>

                    <span className="w-7 h-7 rounded-lg bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-300 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : sharedMedia.length === 0 ? (
          <div className="py-12 text-center text-gray-400 dark:text-gray-500">
            <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs font-medium">No media shared yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {sharedMedia.map((file) =>
              file.fileType === 'IMAGE' ? (
                <div
                  key={file.id}
                  className="aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                >
                  <img
                    src={file.fileUrl}
                    alt={file.fileName || 'Shared image'}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div
                  key={file.id}
                  className="col-span-2 p-2.5 rounded-xl bg-[#F7F8FE] dark:bg-gray-800/60 border border-indigo-100 dark:border-gray-700 flex items-center gap-2.5"
                >
                  <FileText className="w-4 h-4 text-brand-500 flex-shrink-0" />
                  <span className="text-xs text-gray-700 dark:text-gray-200 truncate">
                    {file.fileName || 'Attachment'}
                  </span>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Bottom Quick Settings Cards */}
      <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
        <button
          type="button"
          onClick={() => {
            if (!token) return;
            if (isMuted) {
              unmuteConversation(conversation.id, token);
            } else {
              muteConversation(conversation.id, 8, token);
            }
          }}
          className="w-full text-left p-3 rounded-2xl bg-[#F7F8FE] dark:bg-gray-800/60 hover:bg-brand-50 dark:hover:bg-gray-800 border border-indigo-100/70 dark:border-gray-700/60 transition flex items-center gap-3"
        >
          {isMuted ? (
            <Bell className="w-4 h-4 text-brand-500 flex-shrink-0" />
          ) : (
            <BellOff className="w-4 h-4 text-brand-500 flex-shrink-0" />
          )}
          <div>
            <p className="text-xs font-semibold text-gray-900 dark:text-white">
              {isMuted ? 'Unmute Chat' : 'Mute Notifications'}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {isMuted ? 'Receive alerts again' : 'Silence for 8 hours'}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setIsSettingsModalOpen(true, 'privacy')}
          className="w-full text-left p-3 rounded-2xl bg-[#F7F8FE] dark:bg-gray-800/60 hover:bg-brand-50 dark:hover:bg-gray-800 border border-indigo-100/70 dark:border-gray-700/60 transition flex items-center gap-3"
        >
          <Shield className="w-4 h-4 text-brand-500 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-gray-900 dark:text-white">
              Privacy & Preferences
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Manage visibility and blocked contacts
            </p>
          </div>
        </button>
      </div>
    </aside>
  );
};

