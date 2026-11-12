import React, { useRef, useEffect, useState } from 'react';
import { Message, MediaAttachment } from '../../types';
import {
  Check,
  CheckCheck,
  Clock,
  Download,
  FileText,
  Film,
  Loader2,
  Reply,
  Star,
  Pin,
  Forward,
  Copy,
  Edit2,
  Trash2,
  Ban,
  Smile,
  Check as CopySuccessIcon,
} from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { getAttachmentDownloadUrlApi } from '../../services/apiClient';
import { DeleteMessageModal } from './DeleteMessageModal';

interface MessageListProps {
  messages: Message[];
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocumentColor(mimeType?: string, fileName?: string) {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (mimeType?.includes('pdf') || ext === 'pdf') {
    return { bg: 'bg-red-500/10 text-red-600 dark:text-red-400', label: 'PDF' };
  }
  if (mimeType?.includes('word') || ext === 'docx') {
    return { bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', label: 'DOCX' };
  }
  if (mimeType?.includes('sheet') || ext === 'xlsx') {
    return { bg: 'bg-green-500/10 text-green-600 dark:text-green-400', label: 'XLSX' };
  }
  return { bg: 'bg-gray-500/10 text-gray-600 dark:text-gray-400', label: ext?.toUpperCase() || 'FILE' };
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const {
    activeConversationId,
    conversations,
    typingMap,
    setReplyingToMessage,
    setEditingMessage,
    deleteMessage,
    toggleReaction,
    pinMessage,
    unpinMessage,
    toggleStarMessage,
    openForwardDialog,
  } = useChatStore();
  const { token, user } = useAuthStore();

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [activeReactionMenuMsgId, setActiveReactionMenuMsgId] = useState<string | null>(null);

  const currentTyping = activeConversationId ? typingMap[activeConversationId] : null;

  // Active conversation metadata for admin check
  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const currentUserRole = activeConv?.participants.find((p) => p.id === user?.id)?.role;
  const isGroupAdmin = activeConv?.type === 'GROUP' && (currentUserRole === 'OWNER' || currentUserRole === 'ADMIN');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTyping]);

  const formatMessageTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMessageDateLabel = (isoString: string) => {
    const d = new Date(isoString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleDownloadAttachment = async (att: MediaAttachment) => {
    try {
      setDownloadingId(att.id);
      let targetUrl = att.fileUrl;

      if (token && att.id && !att.id.startsWith('att-preview-')) {
        try {
          const res = await getAttachmentDownloadUrlApi(token, att.id);
          if (res?.downloadUrl) {
            targetUrl = res.downloadUrl;
          }
        } catch (apiErr) {
          console.warn('Could not retrieve presigned download URL, falling back to direct URL:', apiErr);
        }
      }

      if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://') && !targetUrl.startsWith('blob:'))) {
        console.error('Download rejected: Unsafe or invalid URL protocol:', targetUrl);
        return;
      }

      const link = document.createElement('a');
      link.href = targetUrl;
      link.download = att.fileName || 'download';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download attachment failed:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCopyMessage = (msg: Message) => {
    if (!msg.content) return;
    navigator.clipboard.writeText(msg.content);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleScrollToMessage = (targetId: string) => {
    const el = document.getElementById(`msg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-brand-500', 'transition-all');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-brand-500');
      }, 2000);
    }
  };

  const isEligibleForEdit = (message: Message) => {
    if (!message.isOutgoing || message.isDeleted) return false;
    const ageMs = Date.now() - new Date(message.createdAt).getTime();
    return ageMs < 15 * 60 * 1000; // 15 minutes limit
  };

  const renderAttachment = (att: MediaAttachment, isOutgoing: boolean) => {
    const isImage = att.fileType === 'IMAGE' || att.mimeType?.startsWith('image/');
    const isVideo = att.fileType === 'VIDEO' || att.mimeType?.startsWith('video/');

    if (isImage) {
      return (
        <div key={att.id} className="my-1.5 overflow-hidden rounded-xl">
          <img
            src={att.fileUrl}
            alt={att.fileName || 'Attachment image'}
            loading="lazy"
            className="rounded-xl max-h-72 w-auto max-w-full object-cover cursor-pointer hover:opacity-95 transition"
            onClick={() => handleDownloadAttachment(att)}
          />
          {att.fileName && (
            <div className={`text-[11px] mt-1 flex items-center justify-between ${isOutgoing ? 'text-brand-100' : 'text-gray-400'}`}>
              <span className="truncate max-w-[200px]">{att.fileName}</span>
              <span>{formatBytes(att.fileSize)}</span>
            </div>
          )}
        </div>
      );
    }

    if (isVideo) {
      return (
        <div key={att.id} className="my-1.5">
          <video
            controls
            src={att.fileUrl}
            className="rounded-xl max-w-full max-h-72 bg-black"
            preload="metadata"
          />
          {att.fileName && (
            <div className={`text-[11px] mt-1 flex items-center justify-between ${isOutgoing ? 'text-brand-100' : 'text-gray-400'}`}>
              <span className="truncate max-w-[200px] flex items-center gap-1">
                <Film className="w-3 h-3 shrink-0" /> {att.fileName}
              </span>
              <span>{formatBytes(att.fileSize)}</span>
            </div>
          )}
        </div>
      );
    }

    // Document or File Card
    const docMeta = getDocumentColor(att.mimeType, att.fileName);
    const isDownloading = downloadingId === att.id;

    return (
      <div
        key={att.id}
        className={`my-1.5 p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
          isOutgoing
            ? 'bg-white/15 border-white/20 hover:bg-white/20 text-white'
            : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600/70 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 ${docMeta.bg}`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-wider">{docMeta.label}</span>
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium truncate max-w-[180px] sm:max-w-[240px]">
              {att.fileName || att.fileKey || 'Document'}
            </span>
            <span className={`text-[10px] ${isOutgoing ? 'text-brand-100' : 'text-gray-400'}`}>
              {formatBytes(att.fileSize)}
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={isDownloading}
          onClick={() => handleDownloadAttachment(att)}
          className={`p-2 rounded-lg transition shrink-0 ${
            isOutgoing
              ? 'hover:bg-white/20 text-white'
              : 'hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'
          }`}
          title="Download file"
          aria-label={`Download ${att.fileName || 'file'}`}
        >
          {isDownloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto px-3 py-4 sm:p-6 space-y-3.5 bg-[#FAFBFD] dark:bg-gray-900">
      {messages.length === 0 && (
        <div className="text-center py-12 text-xs text-gray-400">
          No messages in this conversation yet. Send the first message below!
        </div>
      )}

      {messages.map((message, index) => {
        const isOutgoing = message.isOutgoing;
        const hasAttachments = message.attachments && message.attachments.length > 0;
        const showReactions = message.reactions && message.reactions.length > 0;

        // Date separator logic
        const currentDateLabel = getMessageDateLabel(message.createdAt);
        const prevMessage = index > 0 ? messages[index - 1] : null;
        const prevDateLabel = prevMessage ? getMessageDateLabel(prevMessage.createdAt) : null;
        const showDateSeparator = currentDateLabel !== prevDateLabel;

        return (
          <React.Fragment key={message.id}>
            {/* Date separator pill */}
            {showDateSeparator && (
              <div className="flex justify-center my-3">
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/80 px-3.5 py-1 rounded-full border border-gray-200/60 dark:border-gray-700/60 shadow-xs">
                  {currentDateLabel}
                </span>
              </div>
            )}

            <div
              id={`msg-${message.id}`}
              className={`flex flex-col group relative ${isOutgoing ? 'items-end' : 'items-start'} transition-all duration-300`}
            >
              {/* Sender Name in group chats */}
              {!isOutgoing && (
                <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1 ml-1 flex items-center gap-1.5">
                  {message.senderName}
                  {message.isStarred && <Star className="w-3 h-3 fill-amber-400 text-amber-500" />}
                  {message.isPinned && <Pin className="w-3 h-3 fill-purple-400 text-purple-500" />}
                </span>
              )}

              {/* Message Bubble + Context Menu Container */}
              <div className="relative max-w-[82%] sm:max-w-[70%]">
                {/* Floating Action Bar / Context Menu */}
                {!message.isDeleted && (
                  <div
                    className={`absolute bottom-full mb-1 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-0.5 bg-white dark:bg-gray-800 p-1 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 ${
                      isOutgoing ? 'right-0' : 'left-0'
                    }`}
                  >
                    {/* Reaction trigger */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveReactionMenuMsgId((prev) =>
                            prev === message.id ? null : message.id
                          )
                        }
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition"
                        title="Add reaction"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>

                      {/* Quick Emoji Menu */}
                      {activeReactionMenuMsgId === message.id && (
                        <div className="absolute bottom-full mb-1 left-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-1 flex items-center gap-1 z-50">
                          {QUICK_REACTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                toggleReaction(message.id, emoji, token || undefined, user?.id);
                                setActiveReactionMenuMsgId(null);
                              }}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-base transition hover:scale-125"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Reply */}
                    <button
                      type="button"
                      onClick={() => setReplyingToMessage(message)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition"
                      title="Reply"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>

                    {/* Star */}
                    <button
                      type="button"
                      onClick={() => toggleStarMessage(message.id, token || undefined)}
                      className={`p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition ${
                        message.isStarred
                          ? 'text-amber-500'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                      title={message.isStarred ? 'Unstar message' : 'Star message'}
                    >
                      <Star className={`w-3.5 h-3.5 ${message.isStarred ? 'fill-amber-400' : ''}`} />
                    </button>

                    {/* Pin */}
                    <button
                      type="button"
                      onClick={() => {
                        if (message.isPinned && activeConversationId) {
                          unpinMessage(activeConversationId, message.id, token || undefined);
                        } else if (activeConversationId) {
                          pinMessage(activeConversationId, message.id, token || undefined);
                        }
                      }}
                      className={`p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition ${
                        message.isPinned
                          ? 'text-purple-500'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                      title={message.isPinned ? 'Unpin message' : 'Pin message'}
                    >
                      <Pin className={`w-3.5 h-3.5 ${message.isPinned ? 'fill-purple-400' : ''}`} />
                    </button>

                    {/* Forward */}
                    <button
                      type="button"
                      onClick={() => openForwardDialog(message)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition"
                      title="Forward"
                    >
                      <Forward className="w-3.5 h-3.5" />
                    </button>

                    {/* Copy */}
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(message)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition"
                      title="Copy text"
                    >
                      {copiedId === message.id ? (
                        <CopySuccessIcon className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Edit (if eligible) */}
                    {isEligibleForEdit(message) && (
                      <button
                        type="button"
                        onClick={() => setEditingMessage(message)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition"
                        title="Edit message"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => setMessageToDelete(message)}
                      className="p-1 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg text-red-500 transition"
                      title="Delete message"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`px-4 py-2.5 rounded-2xl shadow-xs text-sm ${
                    message.isDeleted
                      ? 'bg-gray-100 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500 italic border border-dashed border-gray-300 dark:border-gray-700'
                      : isOutgoing
                      ? 'bg-brand-500 text-white rounded-br-sm shadow-sm shadow-brand-500/20'
                      : 'bg-[#EEF0F8] dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm'
                  }`}
                >
                  {/* Forwarded Header */}
                  {message.isForwarded && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-brand-200 dark:text-brand-300 mb-1.5 opacity-90">
                      <Forward className="w-3 h-3" />
                      <span>Forwarded {message.forwardedFrom ? `from ${message.forwardedFrom}` : ''}</span>
                    </div>
                  )}

                  {/* Quoted Reply Preview */}
                  {message.replyTo && (
                    <button
                      type="button"
                      onClick={() => handleScrollToMessage(message.replyTo!.id)}
                      className={`w-full text-left mb-2 p-2 rounded-lg border-l-3 transition block text-xs ${
                        isOutgoing
                          ? 'bg-white/10 border-white/80 hover:bg-white/20 text-brand-50'
                          : 'bg-gray-100 dark:bg-gray-700/60 border-brand-500 hover:bg-gray-200/70 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span className="font-semibold block text-[11px]">
                        {message.replyTo.senderName}
                      </span>
                      <span className="truncate block opacity-85">
                        {message.replyTo.isDeleted
                          ? 'This message was deleted'
                          : message.replyTo.content}
                      </span>
                    </button>
                  )}

                  {/* Deleted State */}
                  {message.isDeleted ? (
                    <div className="flex items-center gap-1.5 py-0.5">
                      <Ban className="w-3.5 h-3.5 opacity-70" />
                      <span>This message was deleted</span>
                    </div>
                  ) : (
                    <>
                      {/* Media Attachments */}
                      {hasAttachments && (
                        <div className="space-y-2">
                          {message.attachments!.map((att) => renderAttachment(att, isOutgoing))}
                        </div>
                      )}

                      {/* Message text / caption */}
                      {message.content && (
                        <p className={`break-words leading-relaxed whitespace-pre-wrap ${hasAttachments ? 'mt-1.5' : ''}`}>
                          {message.content}
                        </p>
                      )}
                    </>
                  )}

                  {/* Timestamp & Status & Indicators */}
                  <div
                    className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                      isOutgoing ? 'text-brand-100' : 'text-gray-400'
                    }`}
                  >
                    {message.isStarred && !isOutgoing && (
                      <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" />
                    )}
                    {message.isEdited && <span>(edited)</span>}
                    <span>{formatMessageTime(message.createdAt)}</span>

                    {isOutgoing && !message.isDeleted && (
                      <span>
                        {message.status === 'READ' && <CheckCheck className="w-3.5 h-3.5 text-white" />}
                        {message.status === 'DELIVERED' && (
                          <CheckCheck className="w-3.5 h-3.5 text-brand-200" />
                        )}
                        {message.status === 'SENT' && (
                          <Check className="w-3.5 h-3.5 text-brand-200" />
                        )}
                        {message.status === 'SENDING' && (
                          <Clock className="w-3.5 h-3.5 text-brand-200 animate-pulse" />
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Reactions Pill Display underneath Bubble */}
                {showReactions && !message.isDeleted && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                    {message.reactions!.map((reaction) => (
                      <button
                        key={reaction.emoji}
                        type="button"
                        onClick={() =>
                          toggleReaction(message.id, reaction.emoji, token || undefined, user?.id)
                        }
                        title={`Reacted by: ${reaction.users.join(', ')}`}
                        className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border transition shadow-xs ${
                          reaction.hasReacted
                            ? 'bg-brand-50 dark:bg-brand-950/60 border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-300 font-semibold'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750'
                        }`}
                      >
                        <span>{reaction.emoji}</span>
                        <span>{reaction.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </React.Fragment>
        );
      })}

      {/* Typing indicator bubble */}
      {currentTyping && (
        <div className="flex flex-col items-start animate-fade-in">
          <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1 ml-1">
            {currentTyping.userName || 'Someone'} is typing...
          </span>
          <div className="px-4 py-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/80 rounded-tl-none shadow-sm flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteMessageModal
        isOpen={messageToDelete !== null}
        message={messageToDelete}
        canDeleteForEveryone={
          messageToDelete?.isOutgoing || isGroupAdmin || false
        }
        onClose={() => setMessageToDelete(null)}
        onDeleteForMe={() => {
          if (messageToDelete) {
            deleteMessage(messageToDelete.id, 'FOR_ME', token || undefined);
            setMessageToDelete(null);
          }
        }}
        onDeleteForEveryone={() => {
          if (messageToDelete) {
            deleteMessage(messageToDelete.id, 'FOR_EVERYONE', token || undefined);
            setMessageToDelete(null);
          }
        }}
      />

      <div ref={bottomRef} />
    </div>
  );
};
