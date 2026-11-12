import React, { useState } from 'react';
import { Header } from '../components/layout/Header';
import { NavRail } from '../components/layout/NavRail';
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
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-[#EEF0FB] dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      {/* Compact Mobile Header (shown on chat list screen) */}
      {!isMobileChatOpen && <Header onOpenProfile={() => setIsProfileOpen(true)} />}

      {/* Main Responsive Chat Workspace */}
      <div className="flex-1 flex overflow-hidden relative md:p-3 md:gap-3">
        {/* Desktop/Tablet Navigation Rail */}
        <NavRail onOpenProfile={() => setIsProfileOpen(true)} />

        {/* Sidebar: Visible on desktop; or on mobile when chat is closed */}
        <div
          className={`h-full min-w-0 ${
            isMobileChatOpen ? 'hidden md:flex' : 'flex w-full md:w-auto'
          }`}
        >
          <Sidebar />
        </div>

        {/* Chat Window: Visible on desktop; or on mobile when chat is open */}
        <div
          className={`h-full flex-1 min-w-0 ${
            isMobileChatOpen ? 'flex w-full' : 'hidden md:flex'
          }`}
        >
          <ChatWindow />
        </div>
      </div>

      <ProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      <NewChatModal />
      <CallModal />
      <NotificationCenterDrawer />
      <SettingsModal />
    </div>
  );
};
