import React, { useState } from 'react';
import { User, AtSign, Smile, Sparkles, Check, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export const ProfileOnboardingCard: React.FC = () => {
  const { completeOnboarding, phoneNumber, isLoading, errorMessage, setError } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('Hey there! I am using PingUp.');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setLocalError('Display name is required');
      return;
    }
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || cleanUsername.length < 3) {
      setLocalError('Username must be at least 3 characters');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      setLocalError('Username may only contain letters, numbers, and underscores');
      return;
    }

    setLocalError(null);
    await completeOnboarding(displayName, cleanUsername, bio);
  };

  const activeError = localError || errorMessage;
  const initialLetter = displayName.trim() ? displayName.trim().charAt(0).toUpperCase() : 'U';

  return (
    <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-800 transition-colors">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Create Your Profile
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Set up how your friends and contacts recognize you on PingUp
        </p>
      </div>

      {activeError && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{activeError}</span>
        </div>
      )}

      {/* Avatar Preview */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 text-white flex items-center justify-center font-bold text-3xl shadow-lg ring-4 ring-brand-100 dark:ring-brand-950">
            {initialLetter}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-white dark:bg-gray-800 p-1 rounded-full shadow border border-gray-200 dark:border-gray-700">
            <Sparkles className="w-4 h-4 text-brand-500" />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Display Name */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            Full Name
          </label>
          <div className="flex items-center px-3.5 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/80 focus-within:ring-2 focus-within:ring-brand-500 transition">
            <User className="w-4 h-4 text-gray-400 mr-2.5" />
            <input
              type="text"
              placeholder="e.g. Jordan Smith"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (localError) setLocalError(null);
                if (errorMessage) setError(null);
              }}
              className="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Username */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            Username
          </label>
          <div className="flex items-center px-3.5 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/80 focus-within:ring-2 focus-within:ring-brand-500 transition">
            <AtSign className="w-4 h-4 text-gray-400 mr-2.5" />
            <input
              type="text"
              placeholder="jordansmith"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                if (localError) setLocalError(null);
                if (errorMessage) setError(null);
              }}
              className="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
            />
          </div>
        </div>

        {/* Bio / Status */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
            Status Message
          </label>
          <div className="flex items-center px-3.5 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/80 focus-within:ring-2 focus-within:ring-brand-500 transition">
            <Smile className="w-4 h-4 text-gray-400 mr-2.5" />
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
            />
          </div>
        </div>

        {/* Phone Note */}
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          Linked with verified phone: <span className="font-semibold text-gray-600 dark:text-gray-300">{phoneNumber}</span>
        </p>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold text-sm shadow-md shadow-brand-500/25 flex items-center justify-center gap-2 transition"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Complete Setup <Check className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
