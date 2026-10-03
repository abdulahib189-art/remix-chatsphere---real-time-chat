import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { Sidebar } from './components/Sidebar';
import { ChatHeader } from './components/ChatHeader';
import { MessageArea } from './components/MessageArea';
import { MessageComposer } from './components/MessageComposer';
import { RightInfoPanel } from './components/RightInfoPanel';
import { NewChatModal } from './components/NewChatModal';
import { AddContactModal } from './components/AddContactModal';
import { CreateGroupModal } from './components/CreateGroupModal';
import { ProfileModal } from './components/ProfileModal';
import { SettingsModal } from './components/SettingsModal';
import { AdminModal } from './components/AdminModal';
import { MediaLightbox } from './components/MediaLightbox';
import { ForwardModal } from './components/ForwardModal';
import { StatusCreateModal } from './components/StatusCreateModal';
import { StatusViewerModal } from './components/StatusViewerModal';
import { ScheduleMessageModal } from './components/ScheduleMessageModal';
import { ScheduledListModal } from './components/ScheduledListModal';
import { RecurringMessageModal } from './components/RecurringMessageModal';
import { RecurringListModal } from './components/RecurringListModal';
import { AuthScreen } from './components/AuthScreen';
import { MessageSquare, ShieldCheck, Lock } from 'lucide-react';

const ChatAppInner: React.FC = () => {
  const { currentUser, loading } = useAuth();
  const { activeConversation, setNewChatOpen, adminModalOpen } = useChat();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
          <p className="text-xs text-slate-400 font-mono">Loading ChatSphere...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  // Admins land on the dashboard; closing it shows the regular chat UI (reopen from the sidebar).
  if (currentUser.role === 'admin' && adminModalOpen) {
    return <AdminModal />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 font-sans antialiased text-slate-900 dark:text-slate-100">
      {/* Sidebar: Chat List */}
      <div className={`${activeConversation ? 'hidden md:flex' : 'flex'} w-full md:w-auto h-full`}>
        <Sidebar />
      </div>

      {/* Main Chat View */}
      <div className={`${!activeConversation ? 'hidden md:flex' : 'flex'} flex-1 flex-col h-full relative min-w-0 bg-slate-50 dark:bg-slate-900`}>
        {activeConversation ? (
          <>
            <ChatHeader />
            <MessageArea />
            <MessageComposer />
          </>
        ) : (
          /* Empty Active Conversation Screen */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-100/50 dark:bg-slate-950/50 border-b-8 border-emerald-500 select-none">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4 ring-4 ring-emerald-500/20 shadow-xl">
              <MessageSquare className="w-10 h-10" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              ChatSphere Web
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-2 leading-relaxed">
              Send and receive messages with real-time end-to-end synchronization. Select a chat from the sidebar or start a new conversation.
            </p>

            <button
              onClick={() => setNewChatOpen(true)}
              className="mt-6 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg hover:scale-105 transition-all flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" /> Start New Conversation
            </button>

            <div className="mt-12 flex items-center gap-1.5 text-[11px] text-slate-400">
              <Lock className="w-3.5 h-3.5 text-emerald-500" />
              <span>End-to-end encrypted</span>
            </div>
          </div>
        )}
      </div>

      {/* Right Info Panel */}
      <RightInfoPanel />

      {/* Modals & Overlays */}
      <NewChatModal />
      <AddContactModal />
      <CreateGroupModal />
      <ProfileModal />
      <SettingsModal />
      <AdminModal />
      <MediaLightbox />
      <ForwardModal />
      <StatusCreateModal />
      <StatusViewerModal />
      <ScheduleMessageModal />
      <ScheduledListModal />
      <RecurringMessageModal />
      <RecurringListModal />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <ChatAppInner />
      </ChatProvider>
    </AuthProvider>
  );
}
