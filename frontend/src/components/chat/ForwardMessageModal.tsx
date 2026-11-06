import React, { useState } from 'react';
import { X, Forward, Check, Users, User as UserIcon } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';

export const ForwardMessageModal: React.FC = () => {
  const {
    isForwardDialogOpen,
    forwardingMessage,
    closeForwardDialog,
    conversations,
    forwardMessage,
  } = useChatStore();
  const { token } = useAuthStore();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isForwardDialogOpen || !forwardingMessage) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleForward = async () => {
    if (selectedIds.length === 0 || isSubmitting) return;
    try {
      setIsSubmitting(true);
      await forwardMessage(selectedIds, token || undefined);
      setSelectedIds([]);
    } catch (err) {
      console.error('Failed to forward message:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 font-semibold text-base">
            <Forward className="w-5 h-5" />
            <span>Forward Message</span>
          </div>
          <button
            type="button"
            onClick={closeForwardDialog}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Snippet preview */}
        <div className="my-3 p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-300">
          <span className="font-semibold text-gray-800 dark:text-gray-200 block mb-1">
            {forwardingMessage.senderName}:
          </span>
          <p className="truncate italic">"{forwardingMessage.content || 'Attachment'}"</p>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
          Select destination conversations ({selectedIds.length} selected):
        </p>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 my-2 pr-1">
          {conversations.map((conv) => {
            const isSelected = selectedIds.includes(conv.id);
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => toggleSelect(conv.id)}
                className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition text-left ${
                  isSelected
                    ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-300 dark:border-brand-700'
                    : 'bg-white dark:bg-gray-800/80 border-gray-100 dark:border-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0 text-gray-600 dark:text-gray-300">
                    {conv.type === 'GROUP' ? <Users className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {conv.title}
                    </span>
                    <span className="text-[10px] text-gray-400 capitalize">
                      {conv.type.toLowerCase()} chat
                    </span>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                    isSelected
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={closeForwardDialog}
            className="px-4 py-2 rounded-xl text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0 || isSubmitting}
            onClick={handleForward}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-brand-500 hover:bg-brand-600 transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
          >
            <Forward className="w-4 h-4" />
            <span>Forward ({selectedIds.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
