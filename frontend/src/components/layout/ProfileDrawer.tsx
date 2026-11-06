import React from 'react';
import { X, User, Phone, LogOut, CheckCircle, Database, Radio, Server } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({ isOpen, onClose }) => {
  const { currentUser, logout } = useAuthStore();

  if (!isOpen || !currentUser) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer content */}
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto border-l border-gray-200 dark:border-gray-800 transition-transform">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">User Profile</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Profile Card */}
          <div className="mt-6 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-2xl shadow-lg ring-4 ring-brand-100 dark:ring-brand-950 mb-3">
              {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}
            </div>
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
              {currentUser.displayName}
            </h3>
            <p className="text-xs text-brand-600 dark:text-brand-400 font-medium">
              @{currentUser.username}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 px-4 italic">
              "{currentUser.bio || 'Available'}"
            </p>
          </div>

          {/* Details list */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/60">
              <Phone className="w-4 h-4 text-gray-400 mr-3" />
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400">Verified Phone</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {currentUser.phoneNumber}
                </p>
              </div>
            </div>

            <div className="flex items-center p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/60">
              <User className="w-4 h-4 text-gray-400 mr-3" />
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400">Account Status</p>
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" /> Active Session
                </p>
              </div>
            </div>
          </div>

          {/* Infrastructure Health Status */}
          <div className="mt-6 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2.5">
              Infrastructure Status
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                <span className="flex items-center gap-2">
                  <Server className="w-3.5 h-3.5 text-brand-500" /> Express API
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Ready (:5000)</span>
              </div>
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                <span className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-blue-500" /> PostgreSQL & Prisma
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-medium">Schema V1</span>
              </div>
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                <span className="flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-red-500" /> Redis Cluster / Memory
                </span>
                <span className="text-amber-600 dark:text-amber-400 font-medium">Local Fallback</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => {
              logout();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition text-sm font-semibold"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

