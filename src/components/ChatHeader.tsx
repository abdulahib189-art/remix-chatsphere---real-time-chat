import React, { useState } from 'react';
import {
  Phone,
  Video,
  Search,
  MoreVertical,
  Sidebar as SidebarIcon,
  VolumeX,
  Volume2,
  Ban,
  X,
  ArrowLeft,
  Users,
  BadgeCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { api } from '../services/api';
import { StreakBadge } from './StreakBadge';

export const ChatHeader: React.FC = () => {
  const { currentUser, usersList } = useAuth();
  const {
    activeConversation,
    activeConversationId,
    setActiveConversationId,
    typingUsers,
    searchInChatQuery,
    setSearchInChatQuery,
    infoPanelOpen,
    setInfoPanelOpen,
    startCall,
    setSettingsModalOpen,
    loadConversations,
  } = useChat();

  const [menuOpen, setMenuOpen] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(false);

  if (!activeConversation || !currentUser) return null;

  let headerName = activeConversation.name || 'Chat';
  let headerAvatar = activeConversation.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
  let headerSubtitle = '';

  let isOtherVerified = false;

  if (activeConversation.type === 'private') {
    const otherId = activeConversation.memberIds.find((id) => id !== currentUser.id);
    const otherUser = usersList.find((u) => u.id === otherId);
    if (otherUser) {
      isOtherVerified = !!otherUser.isVerified;
      headerName = otherUser.name || otherUser.username || 'Chat';
      headerAvatar = otherUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';

      if (otherUser.onlineStatus === 'online') {
        headerSubtitle = 'Online';
      } else if (otherUser.onlineStatus === 'away') {
        headerSubtitle = 'Away';
      } else {
        const lastSeenDate = new Date(otherUser.lastSeen);
        headerSubtitle = `Last seen ${lastSeenDate.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}`;
      }
    }
  } else {
    // Group chat
    const memberNames = activeConversation.memberIds
      .map((mId) => {
        if (mId === currentUser.id) return 'You';
        const u = usersList.find((usr) => usr.id === mId);
        return u?.name ? u.name.split(' ')[0] : (u?.username || '');
      })
      .filter(Boolean)
      .join(', ');
    headerSubtitle = `${activeConversation.memberIds.length} members: ${memberNames}`;
  }

  // Typing indicator check
  const typingList = activeConversationId ? typingUsers[activeConversationId] || [] : [];
  const isTyping = typingList.length > 0;
  let typingLabel = '';
  if (isTyping) {
    if (activeConversation.type === 'group') {
      const names = typingList.map((t) => t.userName).join(', ');
      typingLabel = `${names} ${typingList.length > 1 ? 'are' : 'is'} typing`;
    } else {
      typingLabel = 'typing';
    }
  }

  const isMuted = activeConversation.mutedUserIds?.includes(currentUser.id);

  const handleToggleMute = async () => {
    await api.updateConversation(activeConversation.id, { action: isMuted ? 'unmute' : 'mute' });
    loadConversations();
    setMenuOpen(false);
  };

  const handleBlockUser = async () => {
    if (activeConversation.type === 'private') {
      const otherId = activeConversation.memberIds.find((id) => id !== currentUser.id);
      if (otherId) {
        await api.toggleBlockUser(otherId);
        setMenuOpen(false);
      }
    }
  };

  return (
    <div className="p-3 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 select-none z-10 shadow-xs">
      {/* Left Avatar + Info */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => setActiveConversationId(null)}
          className="md:hidden p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full"
          title="Back to chats"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div
          onClick={() => setInfoPanelOpen(!infoPanelOpen)}
          className="flex items-center gap-3 cursor-pointer group min-w-0"
        >
          <div className="relative shrink-0">
            <img
              src={headerAvatar}
              alt={headerName}
              className={`w-10 h-10 rounded-full object-cover ring-2 transition-all ${
                isTyping
                  ? 'ring-emerald-500 ring-offset-1 dark:ring-offset-slate-950 shadow-xs'
                  : 'ring-transparent group-hover:ring-emerald-500'
              }`}
            />
            {isTyping && (
              <span
                id="header-typing-badge"
                className="absolute -top-0.5 -right-0.5 flex h-3 w-3"
                title="Typing..."
              >
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-white dark:border-slate-950" />
              </span>
            )}
            {activeConversation.type === 'private' && headerSubtitle === 'Online' && !isTyping && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full" />
            )}
          </div>

          <div className="truncate min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {headerName}
              </h2>
              {isOtherVerified && (
                <BadgeCheck className="w-4 h-4 text-blue-500 fill-blue-500/20 shrink-0" aria-label="Verified Account" />
              )}
              <StreakBadge />
            </div>
            {isTyping ? (
              <div
                id="chat-header-typing-indicator"
                className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium"
              >
                <span className="truncate">{typingLabel}</span>
                <span className="inline-flex items-center gap-0.5 ml-0.5 shrink-0" aria-label="typing animation">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" />
                </span>
              </div>
            ) : (
              <p
                id="chat-header-status"
                className="text-xs truncate text-slate-500 dark:text-slate-400"
              >
                {headerSubtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Search Input Bar inside Chat */}
      {showSearchInput ? (
        <div className="flex-1 max-w-xs mx-4 relative animate-fade-in">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search messages..."
            value={searchInChatQuery}
            onChange={(e) => setSearchInChatQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            autoFocus
          />
          <button
            onClick={() => {
              setShowSearchInput(false);
              setSearchInChatQuery('');
            }}
            className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : null}

      {/* Action Icons */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setShowSearchInput(!showSearchInput)}
          className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
          title="Search in Chat"
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          onClick={() => setInfoPanelOpen(!infoPanelOpen)}
          className={`p-2 rounded-full transition-colors ${
            infoPanelOpen
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
          title="Contact / Group Info"
        >
          <SidebarIcon className="w-4 h-4" />
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
            title="More Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 text-xs"
              onClick={() => setMenuOpen(false)}
            >
              <button
                onClick={handleToggleMute}
                className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200"
              >
                {isMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
              </button>

              <button
                onClick={() => setSettingsModalOpen(true)}
                className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200"
              >
                Wallpaper & Theme
              </button>

              {activeConversation.type === 'private' && (
                <button
                  onClick={handleBlockUser}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-rose-600 dark:text-rose-400"
                >
                  <Ban className="w-4 h-4" /> Block User
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
