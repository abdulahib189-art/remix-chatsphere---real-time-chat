import React, { useState } from 'react';
import {
  MessageSquarePlus,
  Users,
  UserPlus,
  Settings as SettingsIcon,
  Search,
  Pin,
  VolumeX,
  Archive,
  Star,
  Check,
  CheckCheck,
  MoreVertical,
  ShieldAlert,
  UserCheck,
  Image as ImageIcon,
  Mic,
  FileText,
  Video,
  X,
  Sparkles,
  Bell,
  UserX,
  Clock,
  BadgeCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat, FilterTab } from '../context/ChatContext';
import { Conversation, User } from '../types';
import { api } from '../services/api';
import { UserProfileModal } from './UserProfileModal';
import { StatusTray } from './StatusTray';

export const Sidebar: React.FC = () => {
  const { currentUser, usersList, switchUser } = useAuth();
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    typingUsers,
    filterTab,
    setFilterTab,
    searchQuery,
    setSearchQuery,
    incomingRequests,
    outgoingRequests,
    respondFriendRequest,
    setNewChatOpen,
    setAddContactOpen,
    setCreateGroupOpen,
    setProfileModalOpen,
    setSettingsModalOpen,
    setAdminModalOpen,
    setScheduledListOpen,
    setRecurringListOpen,
    loadConversations,
  } = useChat();

  const [menuOpen, setMenuOpen] = useState(false);
  const [userSwitchOpen, setUserSwitchOpen] = useState(false);
  const [contextMenuConvId, setContextMenuConvId] = useState<string | null>(null);
  const [selectedPreviewUser, setSelectedPreviewUser] = useState<User | null>(null);
  const [previewReqId, setPreviewReqId] = useState<string | undefined>(undefined);

  if (!currentUser) return null;

  // Filter conversations based on tab and search
  const filteredConversations = conversations.filter((conv) => {
    // Tab filter
    if (filterTab === 'unread') {
      const count = conv.unreadCounts[currentUser.id] || 0;
      if (count === 0) return false;
    } else if (filterTab === 'groups') {
      if (conv.type !== 'group') return false;
    } else if (filterTab === 'archived') {
      if (!conv.archivedUserIds?.includes(currentUser.id)) return false;
    } else {
      // Hide archived from 'all', 'groups', 'unread' unless in archived tab
      if (conv.archivedUserIds?.includes(currentUser.id)) {
        return false;
      }
    }

    // Search query filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();

    let name = conv.name || '';
    if (conv.type === 'private') {
      const otherId = conv.memberIds.find((id) => id !== currentUser.id);
      const otherUser = usersList.find((u) => u.id === otherId);
      name = otherUser ? otherUser.name : 'Chat';
    }

    const lastText = conv.lastMessage?.text || '';
    return name.toLowerCase().includes(q) || lastText.toLowerCase().includes(q);
  });

  // Sort: Pinned first, then by updatedAt desc
  filteredConversations.sort((a, b) => {
    const aPinned = a.pinnedUserIds?.includes(currentUser.id) ? 1 : 0;
    const bPinned = b.pinnedUserIds?.includes(currentUser.id) ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const handleTogglePin = async (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    const isPinned = conv.pinnedUserIds?.includes(currentUser.id);
    await api.updateConversation(conv.id, { action: isPinned ? 'unpin' : 'pin' });
    loadConversations();
    setContextMenuConvId(null);
  };

  const handleToggleMute = async (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    const isMuted = conv.mutedUserIds?.includes(currentUser.id);
    await api.updateConversation(conv.id, { action: isMuted ? 'unmute' : 'mute' });
    loadConversations();
    setContextMenuConvId(null);
  };

  const handleToggleArchive = async (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    const isArchived = conv.archivedUserIds?.includes(currentUser.id);
    await api.updateConversation(conv.id, { action: isArchived ? 'unarchive' : 'archive' });
    loadConversations();
    setContextMenuConvId(null);
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 3600);

    if (diffHours < 24 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const renderLastMessagePreview = (conv: Conversation) => {
    const convTypingList = typingUsers[conv.id] || [];
    if (convTypingList.length > 0) {
      const names = convTypingList.map((t) => t.userName).join(', ');
      return (
        <div className="flex items-center gap-1.5 truncate text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          <span className="truncate">
            {conv.type === 'group' ? `${names} typing...` : 'typing...'}
          </span>
          <span className="inline-flex items-center gap-0.5 ml-0.5 shrink-0" aria-label="typing animation">
            <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" />
          </span>
        </div>
      );
    }

    const msg = conv.lastMessage;
    if (!msg) return <span className="text-gray-400 italic">No messages yet</span>;

    const isMe = msg.senderId === currentUser.id;

    let content: React.ReactNode = msg.text;
    if (msg.type === 'image') {
      content = (
        <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <ImageIcon className="w-3.5 h-3.5 text-emerald-500" /> Photo
        </span>
      );
    } else if (msg.type === 'video') {
      content = (
        <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <Video className="w-3.5 h-3.5 text-emerald-500" /> Video
        </span>
      );
    } else if (msg.type === 'audio') {
      content = (
        <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <Mic className="w-3.5 h-3.5 text-emerald-500" /> Voice message ({msg.duration || 0}s)
        </span>
      );
    } else if (msg.type === 'file') {
      content = (
        <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <FileText className="w-3.5 h-3.5 text-emerald-500" /> {msg.mediaName || 'Document'}
        </span>
      );
    }

    return (
      <div className="flex items-center gap-1 truncate text-xs text-gray-600 dark:text-gray-300">
        {isMe && (
          <span className="shrink-0">
            {msg.status === 'read' ? (
              <CheckCheck className="w-3.5 h-3.5 text-sky-500" />
            ) : msg.status === 'delivered' ? (
              <CheckCheck className="w-3.5 h-3.5 text-gray-400" />
            ) : (
              <Check className="w-3.5 h-3.5 text-gray-400" />
            )}
          </span>
        )}
        <span className="truncate">{content}</span>
      </div>
    );
  };

  return (
    <aside className="w-full md:w-80 lg:w-96 flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 select-none shrink-0">
      {/* Sidebar Header */}
      <div className="p-3 bg-slate-100 dark:bg-slate-950 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setProfileModalOpen(true)}
            className="relative group focus:outline-none"
            title="Edit Profile"
          >
            <img
              src={currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
              alt={currentUser?.name || 'User'}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/30 group-hover:ring-emerald-500 transition-all"
            />
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-100 dark:border-slate-950 ${
                currentUser?.onlineStatus === 'online' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </button>
          <div>
            <h1 className="font-semibold text-sm text-slate-800 dark:text-slate-100 leading-tight">
              ChatSphere
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {currentUser?.name ? currentUser.name.split(' ')[0] : currentUser?.username || 'User'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAddContactOpen(true)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
            title="Add Friends"
          >
            <Users className="w-5 h-5 text-emerald-500" />
          </button>

          <button
            onClick={() => setFilterTab(filterTab === 'notifications' ? 'all' : 'notifications')}
            className={`p-2 rounded-full transition-colors relative ${
              filterTab === 'notifications'
                ? 'bg-emerald-500 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
            title="Notification Center"
          >
            <Bell className="w-5 h-5" />
            {incomingRequests.length > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center animate-pulse shadow">
                {incomingRequests.length}
              </span>
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
              title="Menu"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 text-sm"
                onClick={() => setMenuOpen(false)}
              >
                <button
                  onClick={() => setAddContactOpen(true)}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5 text-slate-700 dark:text-slate-200"
                >
                  <Users className="w-4 h-4 text-emerald-500" /> Add Friends
                </button>
                <button
                  onClick={() => setCreateGroupOpen(true)}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5 text-slate-700 dark:text-slate-200"
                >
                  <Users className="w-4 h-4 text-emerald-500" /> New Group
                </button>
                <button
                  onClick={() => setProfileModalOpen(true)}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5 text-slate-700 dark:text-slate-200"
                >
                  <UserCheck className="w-4 h-4 text-sky-500" /> My Profile
                </button>
                <button
                  onClick={() => setSettingsModalOpen(true)}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5 text-slate-700 dark:text-slate-200"
                >
                  <SettingsIcon className="w-4 h-4 text-violet-500" /> Settings
                </button>
                <button
                  onClick={() => setScheduledListOpen(true)}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5 text-slate-700 dark:text-slate-200"
                >
                  <Clock className="w-4 h-4 text-blue-500" /> Scheduled Messages
                </button>
                <button
                  onClick={() => setRecurringListOpen(true)}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5 text-slate-700 dark:text-slate-200"
                >
                  <Clock className="w-4 h-4 text-indigo-500" /> Recurring Messages
                </button>
                {currentUser.role === 'admin' && (
                  <button
                    onClick={() => setAdminModalOpen(true)}
                    className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2.5 text-amber-600 dark:text-amber-400 font-medium"
                  >
                    <ShieldAlert className="w-4 h-4" /> Admin Portal
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Tray */}
      <StatusTray />

      {/* Search Input Bar */}
      <div className="p-2.5 bg-slate-50 dark:bg-slate-900">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search existing chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 bg-slate-200/70 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Filter Tabs */}
      <div className="px-2 pb-2 border-b border-slate-200 dark:border-slate-800 flex gap-1 overflow-x-auto no-scrollbar">
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'unread', label: 'Unread' },
            { id: 'groups', label: 'Groups' },
            {
              id: 'notifications',
              label: `Requests${incomingRequests.length > 0 ? ` (${incomingRequests.length})` : ''}`,
            },
            { id: 'archived', label: 'Archived' },
          ] as { id: FilterTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterTab(tab.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              filterTab === tab.id
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content Area: Notification Center vs Conversations List */}
      {filterTab === 'notifications' ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-emerald-500" /> Notification Center
              </h3>
              <p className="text-[11px] text-slate-400">Manage incoming friend requests & invites</p>
            </div>
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-full">
              {incomingRequests.length} Pending
            </span>
          </div>

          {/* Incoming Requests */}
          <div>
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Incoming Friend Requests ({incomingRequests.length})
            </h4>

            {incomingRequests.length === 0 ? (
              <div className="p-6 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="font-semibold text-xs text-slate-700 dark:text-slate-200">
                  No pending friend requests
                </p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  When other users send you friend requests, they will appear right here for instant response.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {incomingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-2.5 transition hover:border-emerald-500/50"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={req.senderAvatar}
                        alt={req.senderName}
                        className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-emerald-500/20"
                      />
                      <div className="truncate flex-1 min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          <p className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {req.senderName}
                          </p>
                          {usersList.find((u) => u.id === req.senderId)?.isVerified && (
                            <BadgeCheck className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20 shrink-0" aria-label="Verified Account" />
                          )}
                        </div>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 truncate font-medium">
                          @{req.senderUsername}
                        </p>
                        {req.senderBio && (
                          <p className="text-[10px] text-slate-400 truncate italic">
                            "{req.senderBio}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                      <button
                        onClick={async () => {
                          await respondFriendRequest(req.id, 'accept');
                        }}
                        className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-1 transition"
                      >
                        <Check className="w-3.5 h-3.5" /> Accept
                      </button>
                      <button
                        onClick={async () => {
                          await respondFriendRequest(req.id, 'deny');
                        }}
                        className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-rose-500 hover:text-white text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition"
                      >
                        <X className="w-3.5 h-3.5" /> Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing Requests */}
          {outgoingRequests && outgoingRequests.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Sent Friend Requests ({outgoingRequests.length})
              </h4>
              <div className="space-y-2">
                {outgoingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-2.5 bg-white/60 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={req.receiverAvatar}
                        alt={req.receiverName}
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                      />
                      <div className="truncate">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {req.receiverName}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          @{req.receiverName.toLowerCase().replace(/\s+/g, '_')}
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-md text-[10px] font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Pending
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Conversations List */
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <p>No conversations found</p>
            <button
              onClick={() => setAddContactOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium shadow hover:bg-emerald-600 transition"
            >
              <Users className="w-3.5 h-3.5" /> Open Friends
            </button>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isSelected = conv.id === activeConversationId;
            const unreadCount = conv.unreadCounts[currentUser.id] || 0;
            const isPinned = conv.pinnedUserIds?.includes(currentUser.id);
            const isMuted = conv.mutedUserIds?.includes(currentUser.id);

            let convName = conv.name || 'Chat';
            let convAvatar = conv.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
            let isOnline = false;
            let isVerified = false;

            if (conv.type === 'private') {
              const otherId = conv.memberIds.find((id) => id !== currentUser.id);
              const otherUser = usersList.find((u) => u.id === otherId);
              if (otherUser) {
                convName = otherUser.name || otherUser.username || 'Chat';
                convAvatar = otherUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
                isOnline = otherUser.onlineStatus === 'online';
                isVerified = !!otherUser.isVerified;
              }
            }

            return (
              <div
                key={conv.id}
                onClick={() => setActiveConversationId(conv.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenuConvId(contextMenuConvId === conv.id ? null : conv.id);
                }}
                className={`relative group flex items-center gap-3 p-3 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-l-4 border-emerald-500'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <img
                    src={convAvatar}
                    alt={convName}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  {conv.type === 'private' && isOnline && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                  )}
                  {conv.type === 'group' && (
                    <span className="absolute -bottom-1 -right-1 p-0.5 bg-violet-600 text-white rounded-full">
                      <Users className="w-3 h-3" />
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1 min-w-0 pr-1">
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {convName}
                      </h3>
                      {isVerified && (
                        <BadgeCheck className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20 shrink-0" aria-label="Verified Account" />
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {formatTime(conv.lastMessage?.createdAt || conv.updatedAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="truncate pr-2">{renderLastMessagePreview(conv)}</div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isMuted && <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
                      {isPinned && <Pin className="w-3.5 h-3.5 text-emerald-500 rotate-45" />}
                      {unreadCount > 0 && (
                        <span className="min-w-5 h-5 px-1.5 flex items-center justify-center bg-emerald-500 text-white text-[11px] font-bold rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Context Menu Dropdown */}
                {contextMenuConvId === conv.id && (
                  <div
                    className="absolute right-3 top-10 bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 rounded-lg py-1 z-50 text-xs w-36"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => handleTogglePin(conv, e)}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                    >
                      <Pin className="w-3.5 h-3.5 text-emerald-500" />
                      {isPinned ? 'Unpin' : 'Pin Chat'}
                    </button>
                    <button
                      onClick={(e) => handleToggleMute(conv, e)}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                    >
                      <VolumeX className="w-3.5 h-3.5 text-amber-500" />
                      {isMuted ? 'Unmute' : 'Mute'}
                    </button>
                    <button
                      onClick={(e) => handleToggleArchive(conv, e)}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                    >
                      <Archive className="w-3.5 h-3.5 text-sky-500" />
                      {conv.archivedUserIds?.includes(currentUser.id) ? 'Unarchive' : 'Archive'}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    )}

      {/* User Profile Modal */}
      {selectedPreviewUser && (
        <UserProfileModal
          user={selectedPreviewUser}
          friendRequestId={previewReqId}
          onClose={() => {
            setSelectedPreviewUser(null);
            setPreviewReqId(undefined);
          }}
        />
      )}
    </aside>
  );
};
