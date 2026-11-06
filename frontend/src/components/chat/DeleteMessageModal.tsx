import React from 'react';
import { X, Trash2, ShieldAlert } from 'lucide-react';
import { Message } from '../../types';

interface DeleteMessageModalProps {
  isOpen: boolean;
  message: Message | null;
  canDeleteForEveryone: boolean;
  onClose: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
}

export const DeleteMessageModal: React.FC<DeleteMessageModalProps> = ({
  isOpen,
  message,
  canDeleteForEveryone,
  onClose,
  onDeleteForMe,
  onDeleteForEveryone,
}) => {
  if (!isOpen || !message) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-red-600 dark:text-red-400 font-semibold text-base">
            <Trash2 className="w-5 h-5" />
            <span>Delete Message?</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-300">
          Choose how you want to delete this message.
        </p>

        {/* Message preview snippet */}
        <div className="p-2.5 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 truncate italic">
          "{message.content || 'Attachment'}"
        </div>

        <div className="flex flex-col gap-2 pt-2">
          {canDeleteForEveryone && (
            <button
              type="button"
              onClick={onDeleteForEveryone}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition shadow-sm flex items-center justify-center gap-2"
            >
              <ShieldAlert className="w-4 h-4" />
              Delete for everyone
            </button>
          )}

          <button
            type="button"
            onClick={onDeleteForMe}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            Delete for me
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 px-4 rounded-xl text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
