import React, { useState } from 'react';
import { Header } from '../components/layout/Header';
import { ProfileDrawer } from '../components/layout/ProfileDrawer';
import { Sidebar } from '../components/chat/Sidebar';
import { ChatWindow } from '../components/chat/ChatWindow';
import { CallModal } from '../components/chat/CallModal';
import { NewChatModal } from '../components/chat/NewChatModal';
import { NotificationCenterDrawer } from '../components/notifications/NotificationCenterDrawer';
import { SettingsModal } from '../components/settings/SettingsModal';
import { useChatStore } from '../store/chatStore';

export const ChatPage: React.FC = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { isMobileChatOpen } = useChatStore();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      {/* Top Header */}
      <Header onOpenProfile={() => setIsProfileOpen(true)} />

      {/* Main Responsive Chat Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar: Visible on desktop; or on mobile when chat is closed */}
        <div
          className={`h-full ${
            isMobileChatOpen ? 'hidden md:flex' : 'flex w-full md:w-auto'
          }`}
        >
          <Sidebar />
        </div>

        {/* Chat Window: Visible on desktop; or on mobile when chat is open */}
        <div
          className={`h-full flex-1 ${
            isMobileChatOpen ? 'flex w-full' : 'hidden md:flex'
          }`}
        >
          <ChatWindow />
        </div>
      </div>

      {/* Profile Menu Drawer */}
      <ProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      {/* New Conversation / Group Modal */}
      <NewChatModal />

      {/* WebRTC Call Modal Preview */}
      <CallModal />

      {/* Phase 7 Notification Center Drawer */}
      <NotificationCenterDrawer />

      {/* Phase 7 Settings Modal */}
      <SettingsModal />
    </div>
  );
};
