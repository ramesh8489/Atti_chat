import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Mic,
  X,
  FileText,
  Film,
  AlertCircle,
  Loader2,
  Reply,
  Edit2,
  Check,
} from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const COMMON_EMOJIS = ['😊', '😂', '❤️', '👍', '🔥', '🎉', '😮', '😢', '🙏', '👏'];

export const MessageInput: React.FC = () => {
  const {
    sendMessage,
    sendTyping,
    uploadAndSendAttachment,
    isUploadingAttachment,
    uploadProgress,
    uploadError,
    setUploadError,
    replyingToMessage,
    setReplyingToMessage,
    editingMessage,
    setEditingMessage,
    submitEditMessage,
  } = useChatStore();
  const { token, user } = useAuthStore();

  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync content with editingMessage
  useEffect(() => {
    if (editingMessage) {
      setContent(editingMessage.content);
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
      }
    }
  }, [editingMessage]);

  useEffect(() => {
    if (replyingToMessage && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyingToMessage]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  const clearSelectedFile = () => {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }
    setSelectedFile(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }

    setSelectedFile(file);
    setUploadError(null);

    if (file.type.startsWith('image/')) {
      setFilePreviewUrl(URL.createObjectURL(file));
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleSend = async () => {
    if (isUploadingAttachment) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    sendTyping(false);

    // Edit message submission
    if (editingMessage) {
      if (!content.trim()) return;
      await submitEditMessage(editingMessage.id, content.trim(), token || undefined);
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      return;
    }

    // Attachment submission
    if (selectedFile) {
      try {
        const fileToUpload = selectedFile;
        const captionToSend = content.trim();

        clearSelectedFile();
        setContent('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }

        await uploadAndSendAttachment(
          fileToUpload,
          captionToSend,
          token || undefined,
          user?.id
        );
      } catch (err: any) {
        console.error('Upload error in MessageInput:', err);
      }
      return;
    }

    if (!content.trim()) return;

    sendMessage(content, token || undefined, user?.id);
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape') {
      if (editingMessage) {
        setEditingMessage(null);
        setContent('');
      } else if (replyingToMessage) {
        setReplyingToMessage(null);
      } else if (showEmojiPicker) {
        setShowEmojiPicker(false);
      }
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;

    sendTyping(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false);
    }, 2000);
  };

  const handleAddEmoji = (emoji: string) => {
    setContent((prev) => prev + emoji);
    setShowEmojiPicker(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const isImage = selectedFile?.type.startsWith('image/');
  const isVideo = selectedFile?.type.startsWith('video/');

  return (
    <div className="px-3 py-2.5 sm:px-5 sm:py-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-indigo-100/80 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md relative flex-shrink-0">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,.jpg,.jpeg,.png,.webp,.mp4,.webm,.pdf,.docx,.xlsx,.txt"
        onChange={handleFileChange}
      />

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-full mb-2 right-4 z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-2.5 flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-2">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleAddEmoji(emoji)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-lg transition hover:scale-125"
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowEmojiPicker(false)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-1 rounded-md"
            aria-label="Close emoji picker"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="mb-2 p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl flex items-center justify-between text-xs text-red-600 dark:text-red-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Replying Banner Preview */}
      {replyingToMessage && (
        <div className="mb-2 px-3 py-2 bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-900/50 rounded-xl flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <Reply className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                Replying to {replyingToMessage.senderName}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-300 truncate">
                {replyingToMessage.isDeleted ? 'This message was deleted' : replyingToMessage.content}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyingToMessage(null)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/40 transition shrink-0"
            aria-label="Cancel reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editing Banner Preview */}
      {editingMessage && (
        <div className="mb-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <Edit2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                Editing message
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-300 truncate">
                Press Enter to save changes, Esc to cancel
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingMessage(null);
              setContent('');
            }}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition shrink-0"
            aria-label="Cancel edit"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attachment Preview Drawer */}
      {selectedFile && (
        <div className="mb-2.5 p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col gap-2 transition-all">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 overflow-hidden">
              {isImage && filePreviewUrl ? (
                <img
                  src={filePreviewUrl}
                  alt={selectedFile.name}
                  className="w-12 h-12 rounded-lg object-cover border border-gray-300 dark:border-gray-600 shrink-0"
                />
              ) : isVideo ? (
                <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center shrink-0 text-purple-600 dark:text-purple-400">
                  <Film className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
                  <FileText className="w-6 h-6" />
                </div>
              )}

              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                  {selectedFile.name}
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {formatBytes(selectedFile.size)} • {selectedFile.type || 'Document'}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={isUploadingAttachment}
              onClick={clearSelectedFile}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              aria-label="Remove attachment"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Upload Progress Bar */}
          {isUploadingAttachment && (
            <div className="w-full">
              <div className="flex justify-between items-center text-[10px] text-brand-600 dark:text-brand-400 mb-1 font-medium">
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Uploading secure attachment...
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-brand-500 h-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Input Control Bar */}
      <div className="flex items-end gap-1.5 sm:gap-2 bg-[#F5F6FC] dark:bg-gray-800/90 rounded-2xl sm:rounded-full px-2.5 py-1.5 border border-indigo-100 dark:border-gray-700/80 focus-within:ring-2 focus-within:ring-brand-500 transition shadow-xs">
        {/* Attachment button (disabled during edit) */}
        {!editingMessage && (
          <button
            type="button"
            disabled={isUploadingAttachment}
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700/60 transition disabled:opacity-50"
            title="Attach photo, video, or document"
            aria-label="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>
        )}

        {/* Text / Caption Input Area */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            editingMessage
              ? 'Edit message...'
              : selectedFile
              ? 'Add a caption...'
              : 'Type a message...'
          }
          rows={1}
          className="flex-1 max-h-32 bg-transparent resize-none text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none py-2 px-1 leading-relaxed"
        />

        {/* Emoji Button */}
        <button
          type="button"
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700/60 transition"
          title="Add emoji"
          aria-label="Add emoji"
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Send / Update or Voice Record */}
        {editingMessage ? (
          <button
            type="button"
            onClick={handleSend}
            disabled={!content.trim()}
            className="p-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-md shadow-amber-500/25 transition disabled:opacity-50"
            title="Save changes"
            aria-label="Save changes"
          >
            <Check className="w-4 h-4" />
          </button>
        ) : content.trim() || selectedFile ? (
          <button
            type="button"
            disabled={isUploadingAttachment}
            onClick={handleSend}
            className="p-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-full shadow-md shadow-brand-500/25 transition disabled:opacity-50"
            title="Send Message"
            aria-label="Send Message"
          >
            {isUploadingAttachment ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        ) : (
          <button
            type="button"
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700/60 transition"
            title="Voice message (Audio recorder)"
            aria-label="Record voice message"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};
