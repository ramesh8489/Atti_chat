import React, { useState } from 'react';
import {
  X,
  Bell,
  Shield,
  UserX,
  Volume2,
  Eye,
  Smartphone,
  Phone,
  MessageCircle,
  Users,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { PrivacyVisibility } from '../../types';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    activeSettingsTab,
    setActiveSettingsTab,
    notificationPreferences,
    updateNotificationPreferences,
    privacySettings,
    updatePrivacySettings,
    blockedUsers,
    unblockUser,
    registerPushNotifications,
  } = useChatStore();

  const { token } = useAuthStore();
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [pushStatusMessage, setPushStatusMessage] = useState<string | null>(null);

  if (!isSettingsModalOpen) {
    return null;
  }

  const handlePushRegister = async () => {
    if (!token) return;
    setIsPushLoading(true);
    setPushStatusMessage(null);
    try {
      const success = await registerPushNotifications(token);
      if (success) {
        setPushStatusMessage('Web push notifications enabled successfully!');
        if (notificationPreferences) {
          await updateNotificationPreferences({ pushEnabled: true }, token);
        }
      } else {
        setPushStatusMessage('Push registration failed. Check browser permissions or HTTPS.');
      }
    } catch (err: any) {
      setPushStatusMessage(err?.message || 'Push registration failed');
    } finally {
      setIsPushLoading(false);
    }
  };

  const handleTogglePref = async (key: string, value: boolean) => {
    if (!token) return;
    await updateNotificationPreferences({ [key]: value }, token);
  };

  const handleUpdatePrivacy = async (key: string, value: any) => {
    if (!token) return;
    await updatePrivacySettings({ [key]: value }, token);
  };

  const handleUnblock = async (blockedId: string) => {
    if (!token) return;
    await unblockUser(blockedId, token);
  };

  return (
    <div
      role="dialog"
      aria-label="Settings Modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in"
    >
      <div className="w-full max-w-xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Settings</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Manage your notifications, privacy visibility, and blocked contacts
            </p>
          </div>
          <button
            onClick={() => setIsSettingsModalOpen(false)}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 px-5">
          <button
            onClick={() => setActiveSettingsTab('notifications')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
              activeSettingsTab === 'notifications'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Notifications</span>
          </button>
          <button
            onClick={() => setActiveSettingsTab('privacy')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
              activeSettingsTab === 'privacy'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Privacy</span>
          </button>
          <button
            onClick={() => setActiveSettingsTab('blocked')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
              activeSettingsTab === 'blocked'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <UserX className="w-4 h-4" />
            <span>Blocked Users ({blockedUsers.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: NOTIFICATIONS */}
          {activeSettingsTab === 'notifications' && (
            <div className="space-y-6">
              {/* Notification Types */}
              <div className="space-y-4">
                <h3 className="text-xs uppercase font-bold text-gray-400 tracking-wider">
                  Notification Alerts
                </h3>

                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 cursor-pointer">
                    <div className="flex items-center space-x-3">
                      <MessageCircle className="w-4 h-4 text-brand-500" />
                      <div>
                        <span className="text-xs font-semibold text-gray-900 dark:text-white block">
                          Direct Messages
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Receive notifications when someone sends you a 1:1 message
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationPreferences?.directMessages ?? true}
                      onChange={(e) => handleTogglePref('directMessages', e.target.checked)}
                      className="w-4 h-4 accent-brand-500 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 cursor-pointer">
                    <div className="flex items-center space-x-3">
                      <Users className="w-4 h-4 text-purple-500" />
                      <div>
                        <span className="text-xs font-semibold text-gray-900 dark:text-white block">
                          Group Messages
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Receive alerts for messages in group conversations
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationPreferences?.groupMessages ?? true}
                      onChange={(e) => handleTogglePref('groupMessages', e.target.checked)}
                      className="w-4 h-4 accent-brand-500 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 cursor-pointer">
                    <div className="flex items-center space-x-3">
                      <Phone className="w-4 h-4 text-emerald-500" />
                      <div>
                        <span className="text-xs font-semibold text-gray-900 dark:text-white block">
                          Incoming Calls
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Alert when voice or video calls are incoming
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationPreferences?.callIncoming ?? true}
                      onChange={(e) => handleTogglePref('callIncoming', e.target.checked)}
                      className="w-4 h-4 accent-brand-500 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 cursor-pointer">
                    <div className="flex items-center space-x-3">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <div>
                        <span className="text-xs font-semibold text-gray-900 dark:text-white block">
                          Missed Calls
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Notify when a call was unanswered or missed
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationPreferences?.callMissed ?? true}
                      onChange={(e) => handleTogglePref('callMissed', e.target.checked)}
                      className="w-4 h-4 accent-brand-500 rounded"
                    />
                  </label>
                </div>
              </div>

              {/* Delivery & Behavior */}
              <div className="space-y-4">
                <h3 className="text-xs uppercase font-bold text-gray-400 tracking-wider">
                  Delivery & Audio
                </h3>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Smartphone className="w-4 h-4 text-brand-500" />
                        <div>
                          <span className="text-xs font-semibold text-gray-900 dark:text-white block">
                            Browser Push Notifications
                          </span>
                          <span className="text-[11px] text-gray-500">
                            Receive notifications even when PingUp is running in the background
                          </span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationPreferences?.pushEnabled ?? true}
                        onChange={(e) => handleTogglePref('pushEnabled', e.target.checked)}
                        className="w-4 h-4 accent-brand-500 rounded"
                      />
                    </div>

                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700/60 flex items-center justify-between">
                      <button
                        onClick={handlePushRegister}
                        disabled={isPushLoading}
                        className="px-3 py-1.5 text-xs font-medium bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 transition"
                      >
                        {isPushLoading ? 'Enabling...' : 'Enable Web Push for this browser'}
                      </button>
                      {pushStatusMessage && (
                        <span className="text-[11px] text-brand-600 dark:text-brand-400 ml-2">
                          {pushStatusMessage}
                        </span>
                      )}
                    </div>
                  </div>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 cursor-pointer">
                    <div className="flex items-center space-x-3">
                      <Volume2 className="w-4 h-4 text-brand-500" />
                      <div>
                        <span className="text-xs font-semibold text-gray-900 dark:text-white block">
                          Notification Sounds
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Play a chime sound for incoming messages and alerts
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationPreferences?.soundEnabled ?? true}
                      onChange={(e) => handleTogglePref('soundEnabled', e.target.checked)}
                      className="w-4 h-4 accent-brand-500 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 cursor-pointer">
                    <div className="flex items-center space-x-3">
                      <Eye className="w-4 h-4 text-brand-500" />
                      <div>
                        <span className="text-xs font-semibold text-gray-900 dark:text-white block">
                          Show Message Previews
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Show message snippet on lockscreen & push banners
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationPreferences?.showPreview ?? true}
                      onChange={(e) => handleTogglePref('showPreview', e.target.checked)}
                      className="w-4 h-4 accent-brand-500 rounded"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRIVACY */}
          {activeSettingsTab === 'privacy' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs uppercase font-bold text-gray-400 tracking-wider">
                  Visibility Controls
                </h3>

                <div className="space-y-3">
                  {/* Last Seen Visibility */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                    <div>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white block">
                        Last Seen Visibility
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Choose who can see your last seen timestamp
                      </span>
                    </div>
                    <select
                      aria-label="Last Seen Visibility"
                      value={privacySettings?.lastSeenVisibility || 'EVERYONE'}
                      onChange={(e) => handleUpdatePrivacy('lastSeenVisibility', e.target.value as PrivacyVisibility)}
                      className="text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-2.5 py-1.5 text-gray-800 dark:text-gray-200"
                    >
                      <option value="EVERYONE">Everyone</option>
                      <option value="CONTACTS">My Contacts</option>
                      <option value="NOBODY">Nobody</option>
                    </select>
                  </div>

                  {/* Online Status Visibility */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                    <div>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white block">
                        Online Status Visibility
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Choose who can see when you are active online
                      </span>
                    </div>
                    <select
                      aria-label="Online Status Visibility"
                      value={privacySettings?.onlineStatusVisibility || 'EVERYONE'}
                      onChange={(e) => handleUpdatePrivacy('onlineStatusVisibility', e.target.value as PrivacyVisibility)}
                      className="text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-2.5 py-1.5 text-gray-800 dark:text-gray-200"
                    >
                      <option value="EVERYONE">Everyone</option>
                      <option value="CONTACTS">My Contacts</option>
                      <option value="NOBODY">Nobody</option>
                    </select>
                  </div>

                  {/* Profile Photo Visibility */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                    <div>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white block">
                        Profile Photo Visibility
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Control who can view your profile picture
                      </span>
                    </div>
                    <select
                      aria-label="Profile Photo Visibility"
                      value={privacySettings?.profilePhotoVisibility || 'EVERYONE'}
                      onChange={(e) => handleUpdatePrivacy('profilePhotoVisibility', e.target.value as PrivacyVisibility)}
                      className="text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-2.5 py-1.5 text-gray-800 dark:text-gray-200"
                    >
                      <option value="EVERYONE">Everyone</option>
                      <option value="CONTACTS">My Contacts</option>
                      <option value="NOBODY">Nobody</option>
                    </select>
                  </div>

                  {/* About Visibility */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                    <div>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white block">
                        About & Bio Visibility
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Control who can read your bio and info
                      </span>
                    </div>
                    <select
                      aria-label="About & Bio Visibility"
                      value={privacySettings?.aboutVisibility || 'EVERYONE'}
                      onChange={(e) => handleUpdatePrivacy('aboutVisibility', e.target.value as PrivacyVisibility)}
                      className="text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-2.5 py-1.5 text-gray-800 dark:text-gray-200"
                    >
                      <option value="EVERYONE">Everyone</option>
                      <option value="CONTACTS">My Contacts</option>
                      <option value="NOBODY">Nobody</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Messaging Indicators */}
              <div className="space-y-4">
                <h3 className="text-xs uppercase font-bold text-gray-400 tracking-wider">
                  Read & Typing Indicators
                </h3>

                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 cursor-pointer">
                    <div>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white block">
                        Read Receipts
                      </span>
                      <span className="text-[11px] text-gray-500">
                        If turned off, you will not send or see read receipts (blue ticks)
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={privacySettings?.readReceipts ?? true}
                      onChange={(e) => handleUpdatePrivacy('readReceipts', e.target.checked)}
                      className="w-4 h-4 accent-brand-500 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 cursor-pointer">
                    <div>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white block">
                        Typing Indicators
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Show others when you are typing a response
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={privacySettings?.typingIndicator ?? true}
                      onChange={(e) => handleUpdatePrivacy('typingIndicator', e.target.checked)}
                      className="w-4 h-4 accent-brand-500 rounded"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BLOCKED USERS */}
          {activeSettingsTab === 'blocked' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs uppercase font-bold text-gray-400 tracking-wider">
                    Blocked Contacts
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Blocked users cannot message you, call you, or see your online presence.
                  </p>
                </div>
              </div>

              {blockedUsers.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    No blocked contacts
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    You have not blocked any users.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                  {blockedUsers.map((b) => (
                    <div
                      key={b.id}
                      className="p-3.5 flex items-center justify-between bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"
                    >
                      <div className="flex items-center space-x-3">
                        {b.user.avatarUrl ? (
                          <img
                            src={b.user.avatarUrl}
                            alt=""
                            className="w-9 h-9 rounded-xl object-cover ring-1 ring-gray-200 dark:ring-gray-700"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-xs text-gray-600 dark:text-gray-300">
                            {b.user.displayName?.charAt(0).toUpperCase() || 'U'}
                          </div>
                        )}
                        <div>
                          <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                            {b.user.displayName}
                          </h4>
                          <p className="text-[11px] text-gray-400">
                            @{b.user.username || 'user'} • Blocked on{' '}
                            {new Date(b.blockedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleUnblock(b.blockedId)}
                        className="px-3 py-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/60 rounded-xl transition"
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

