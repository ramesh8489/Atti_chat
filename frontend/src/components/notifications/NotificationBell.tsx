import React from 'react';
import { Bell } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';

export const NotificationBell: React.FC = () => {
  const { unreadNotificationCount, isNotificationDrawerOpen, setIsNotificationDrawerOpen } =
    useChatStore();

  return (
    <button
      onClick={() => setIsNotificationDrawerOpen(!isNotificationDrawerOpen)}
      className="relative p-2 rounded-xl text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      aria-label="Notifications"
      title="Notifications"
    >
      <Bell className="w-5 h-5" />
      {unreadNotificationCount > 0 && (
        <span
          data-testid="notification-badge"
          className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full ring-2 ring-white dark:ring-gray-900 animate-in fade-in"
        >
          {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
        </span>
      )}
    </button>
  );
};

