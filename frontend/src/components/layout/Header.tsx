import React from 'react';
import { MessageSquare, Moon, Sun, ShieldCheck, Settings } from 'lucide-react';
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
    <header className="h-16 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm px-4 flex items-center justify-between transition-colors z-20">
      {/* Brand */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
          <MessageSquare className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-white">
              Atti
            </span>
            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-brand-100 text-brand-800 dark:bg-brand-950/80 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
              Phase 1
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
            Next-Gen Real-Time Messaging
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Safe Architecture indicator */}
        <div className="hidden md:flex items-center space-x-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>PostgreSQL + Redis + Prisma</span>
        </div>

        {/* Phase 7 Notification Bell */}
        <NotificationBell />

        {/* Settings Button */}
        <button
          onClick={() => setIsSettingsModalOpen(true)}
          aria-label="Settings"
          title="Settings (Notifications & Privacy)"
          className="p-2 rounded-xl text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* User Profile Avatar */}
        {currentUser && (
          <button
            onClick={onOpenProfile}
            className="flex items-center space-x-2 p-1 pl-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition"
          >
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 max-w-[100px] truncate hidden sm:inline">
              {currentUser.displayName || currentUser.phoneNumber}
            </span>
            <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-xs ring-2 ring-brand-300 dark:ring-brand-700">
              {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}
            </div>
          </button>
        )}
      </div>
    </header>
  );
};

