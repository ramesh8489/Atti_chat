import React, { useState } from 'react';
import {
  X,
  Check,
  CheckCheck,
  Trash2,
  Bell,
  MessageCircle,
  Users,
  UserPlus,
  PhoneCall,
  PhoneMissed,
  BellOff,
} from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { NotificationItem, NotificationType } from '../../types';

export const NotificationCenterDrawer: React.FC = () => {
  const {
    notifications,
    unreadNotificationCount,
    isNotificationDrawerOpen,
    setIsNotificationDrawerOpen,
    markNotificationRead,
    markAllNotificationsRead,
    removeNotification,
    clearAllNotifications,
    setActiveConversationId,
    notificationPreferences,
  } = useChatStore();

  const { token } = useAuthStore();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  if (!isNotificationDrawerOpen) {
    return null;
  }

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    return true;
  });

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'DIRECT_MESSAGE':
        return <MessageCircle className="w-4 h-4 text-brand-500" />;
      case 'GROUP_MESSAGE':
        return <Users className="w-4 h-4 text-purple-500" />;
      case 'GROUP_MEMBERSHIP':
        return <UserPlus className="w-4 h-4 text-emerald-500" />;
      case 'CALL_INCOMING':
        return <PhoneCall className="w-4 h-4 text-emerald-500 animate-pulse" />;
      case 'CALL_MISSED':
        return <PhoneMissed className="w-4 h-4 text-rose-500" />;
      default:
        return <Bell className="w-4 h-4 text-brand-500" />;
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.isRead && token) {
      await markNotificationRead(notif.id, token);
    }
    if (notif.conversationId) {
      await setActiveConversationId(notif.conversationId, token || undefined);
      setIsNotificationDrawerOpen(false);
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Notification Center"
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity"
    >
      <div className="w-full max-w-md h-full bg-white dark:bg-gray-900 shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-800 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bell className="w-5 h-5 text-brand-500" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Notification Center</h2>
            {unreadNotificationCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 rounded-full">
                {unreadNotificationCount} new
              </span>
            )}
          </div>
          <button
            onClick={() => setIsNotificationDrawerOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close notifications"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls & Filters */}
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
          {/* Filter Pills */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                filter === 'all'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                filter === 'unread'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              Unread ({unreadNotificationCount})
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-2">
            {unreadNotificationCount > 0 && token && (
              <button
                onClick={() => markAllNotificationsRead(token)}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-1"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mark all read</span>
              </button>
            )}
            {notifications.length > 0 && token && (
              <button
                onClick={() => clearAllNotifications(token)}
                className="text-xs text-rose-500 hover:underline flex items-center space-x-1"
                title="Clear all notifications"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60">
          {filteredNotifications.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                <BellOff className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs">
                You will be notified about direct messages, mentions, and incoming calls here.
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const showPreview = notificationPreferences ? notificationPreferences.showPreview : true;
              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 flex items-start space-x-3 cursor-pointer transition-colors ${
                    !notif.isRead
                      ? 'bg-brand-50/40 dark:bg-brand-950/20 hover:bg-brand-50 dark:hover:bg-brand-950/30'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
                  }`}
                >
                  {/* Actor / Type Icon */}
                  <div className="relative flex-shrink-0 mt-0.5">
                    {notif.actorAvatar ? (
                      <img
                        src={notif.actorAvatar}
                        alt=""
                        className="w-10 h-10 rounded-xl object-cover ring-1 ring-gray-200 dark:ring-gray-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        {getNotificationIcon(notif.type)}
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-white dark:bg-gray-900 shadow-sm">
                      {getNotificationIcon(notif.type)}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                        {notif.title}
                      </h4>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                        {formatTimestamp(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 line-clamp-2">
                      {showPreview ? notif.body : 'New encrypted notification'}
                    </p>

                    {notif.conversationTitle && notif.type === 'GROUP_MESSAGE' && (
                      <span className="inline-block mt-1 text-[10px] text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-1.5 py-0.5 rounded">
                        {notif.conversationTitle}
                      </span>
                    )}
                  </div>

                  {/* Actions (Mark read / dismiss) */}
                  <div className="flex items-center space-x-1 flex-shrink-0 pl-1" onClick={(e) => e.stopPropagation()}>
                    {!notif.isRead && token && (
                      <button
                        onClick={() => markNotificationRead(notif.id, token)}
                        className="p-1 rounded text-gray-400 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {token && (
                      <button
                        onClick={() => removeNotification(notif.id, token)}
                        className="p-1 rounded text-gray-400 hover:text-rose-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        title="Dismiss"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
