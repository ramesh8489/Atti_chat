import React from 'react';
import { MessageSquare, Moon, Sun, Settings } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { NotificationBell } from '../notifications/NotificationBell';

interface HeaderProps {
  onOpenProfile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenProfile }) => {
  const { theme, toggleTheme } = useThemeStore();
  const { currentUser } = useAuthStore();
  const { setIsSettingsModalOpen } = useChatStore();

  return (
    <header className="h-14 border-b border-indigo-100/80 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm px-4 flex items-center justify-between transition-colors z-20 flex-shrink-0 md:hidden">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        {currentUser ? (
          <button
            onClick={onOpenProfile}
            aria-label="Open profile"
            className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-brand-100 dark:ring-brand-900"
          >
            {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}
          </button>
        ) : (
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white shadow-sm">
            <MessageSquare className="w-5 h-5" />
          </div>
        )}
        <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-white">
          PingUp
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <NotificationBell />

        <button
          onClick={() => setIsSettingsModalOpen(true)}
          aria-label="Settings"
          title="Settings"
          className="p-2 rounded-xl text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>

        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded-xl text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
};

