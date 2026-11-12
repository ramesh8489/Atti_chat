import React from 'react';
import {
  MessageSquare,
  Inbox,
  Users,
  PlusCircle,
  Bell,
  Settings,
  Sun,
  Moon,
} from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';

interface NavRailProps {
  onOpenProfile?: () => void;
}

export const NavRail: React.FC<NavRailProps> = ({ onOpenProfile }) => {
  const { theme, toggleTheme } = useThemeStore();
  const { currentUser } = useAuthStore();
  const {
    activeTab,
    setActiveTab,
    setIsMobileChatOpen,
    setIsNewChatModalOpen,
    setIsNotificationDrawerOpen,
    setIsSettingsModalOpen,
    unreadNotificationCount,
  } = useChatStore();

  const navButtonClass = (active: boolean) =>
    `w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
      active
        ? 'bg-white text-brand-600 shadow-md'
        : 'text-white/80 hover:text-white hover:bg-white/15'
    }`;

  return (
    <nav
      aria-label="Primary navigation"
      className="hidden md:flex flex-col items-center justify-between w-16 py-4 rounded-2xl bg-gradient-to-b from-brand-500 to-brand-700 dark:from-gray-900 dark:to-gray-900 dark:border dark:border-gray-800 text-white shadow-lg shadow-brand-500/20 flex-shrink-0"
    >
      {/* Top Logo & Nav */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-inner mb-2"
          title="PingUp"
        >
          <MessageSquare className="w-5 h-5" />
        </div>

        <button
          type="button"
          onClick={() => {
            setActiveTab('all');
            setIsMobileChatOpen(false);
          }}
          className={navButtonClass(activeTab === 'all')}
          title="All Chats"
          aria-label="All Chats"
        >
          <MessageSquare className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('unread');
            setIsMobileChatOpen(false);
          }}
          className={navButtonClass(activeTab === 'unread')}
          title="Unread Chats"
          aria-label="Unread Chats"
        >
          <Inbox className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('groups');
            setIsMobileChatOpen(false);
          }}
          className={navButtonClass(activeTab === 'groups')}
          title="Groups"
          aria-label="Groups"
        >
          <Users className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setIsNewChatModalOpen(true)}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/15 transition-all"
          title="New Chat"
          aria-label="New Chat"
        >
          <PlusCircle className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setIsNotificationDrawerOpen(true)}
          className="relative w-10 h-10 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/15 transition-all"
          title="Notifications"
          aria-label="Open notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadNotificationCount > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setIsSettingsModalOpen(true)}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/15 transition-all"
          title="Settings"
          aria-label="Open settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom Theme & Profile */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={toggleTheme}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/15 transition-all"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {currentUser && (
          <button
            type="button"
            onClick={onOpenProfile}
            title={currentUser.displayName || 'Profile'}
            aria-label="Open profile"
            className="w-10 h-10 rounded-full bg-white text-brand-600 font-bold text-sm flex items-center justify-center ring-2 ring-white/40 hover:ring-white transition shadow-md"
          >
            {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}
          </button>
        )}
      </div>
    </nav>
  );
};

