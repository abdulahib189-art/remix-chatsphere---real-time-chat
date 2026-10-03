import React, { useState } from 'react';
import { Users, UserPlus, X, Mail, Search, MessageSquare, Clock, CheckCircle2, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { api } from '../services/api';
import { User } from '../types';
import { UserProfileModal } from './UserProfileModal';

export const AddContactModal: React.FC = () => {
  const { currentUser, usersList } = useAuth();
  const {
    addContactOpen,
    setAddContactOpen,
    setActiveConversationId,
    loadConversations,
    sendFriendRequest,
    outgoingRequests,
    incomingRequests,
  } = useChat();

  const [activeTab, setActiveTab] = useState<'search' | 'friends'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [friendsSearchQuery, setFriendsSearchQuery] = useState('');
  const [selectedProfileUser, setSelectedProfileUser] = useState<User | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  if (!addContactOpen || !currentUser) return null;

  const contactsSet = new Set(currentUser.contacts || []);

  // 1. Registered Users who are NOT current user and NOT already friends (Requirement 2A)
  const nonFriendUsers = usersList.filter((u) => u.id !== currentUser.id && !contactsSet.has(u.id));
  const filteredSearchUsers = nonFriendUsers.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  });

  // 2. Friends section: ONLY users who are already friends (Requirement 2B)
  const friendUsers = usersList.filter((u) => u.id !== currentUser.id && contactsSet.has(u.id));
  const filteredFriends = friendUsers.filter((u) => {
    if (!friendsSearchQuery.trim()) return true;
    const q = friendsSearchQuery.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  });

  const handleClose = () => {
    setAddContactOpen(false);
    setSearchQuery('');
    setFriendsSearchQuery('');
    setSelectedProfileUser(null);
  };

  const handleSendFriendRequest = async (targetUser: User, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setActionLoadingId(targetUser.id);
      await sendFriendRequest(targetUser.id);
    } catch (err) {
      console.error('Failed to send friend request:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStartChat = async (targetUser: User, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setActionLoadingId(targetUser.id);
      const conv = await api.createPrivateConversation(targetUser.id);
      await loadConversations();
      if (conv && conv.id) {
        setActiveConversationId(conv.id);
      }
      handleClose();
    } catch (err) {
      console.error('Failed to start chat with friend:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none">
        <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[85vh] animate-fade-in">
          {/* Modal Header */}
          <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-500" /> Friends & Contacts
            </h3>
            <button
              onClick={handleClose}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-1">
            <button
              onClick={() => setActiveTab('search')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
                activeTab === 'search'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search Registered Users</span>
            </button>
            <button
              onClick={() => setActiveTab('friends')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
                activeTab === 'friends'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Friends</span>
              {friendUsers.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                  {friendUsers.length}
                </span>
              )}
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'search' ? (
              /* TAB 1: Search Registered Users (Only Non-Friends) */
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search registered users by name, username, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-700/60 max-h-80 overflow-y-auto pr-1">
                  {filteredSearchUsers.length === 0 ? (
                    <div className="text-center py-10 space-y-2">
                      <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {searchQuery.trim()
                          ? 'No non-friend registered users found matching your search.'
                          : 'No new users available to add right now.'}
                      </p>
                    </div>
                  ) : (
                    filteredSearchUsers.map((u) => {
                      const isPendingOutgoing = outgoingRequests.some(
                        (r) => r.receiverId === u.id && r.status === 'pending'
                      );
                      const isPendingIncoming = incomingRequests.some(
                        (r) => r.senderId === u.id && r.status === 'pending'
                      );
                      const isLoading = actionLoadingId === u.id;

                      return (
                        <div
                          key={u.id}
                          onClick={() => setSelectedProfileUser(u)}
                          className="p-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition gap-2 cursor-pointer group"
                        >
                          {/* User Avatar & Info */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="relative shrink-0">
                              <img
                                src={
                                  u.avatar ||
                                  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
                                }
                                alt={u.name || 'User'}
                                className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                              />
                              <span
                                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white dark:border-slate-800 ${
                                  u.onlineStatus === 'online' ? 'bg-emerald-500' : 'bg-slate-400'
                                }`}
                              />
                            </div>
                            <div className="truncate min-w-0">
                              <p className="font-semibold text-xs text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition truncate">
                                {u.name}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                @{u.username} {u.email ? `• ${u.email}` : ''}
                              </p>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="shrink-0">
                            {isPendingOutgoing ? (
                              <span className="px-2.5 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-semibold flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" /> Pending
                              </span>
                            ) : isPendingIncoming ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedProfileUser(u);
                                }}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-2xs"
                              >
                                Respond
                              </button>
                            ) : (
                              <button
                                onClick={(e) => handleSendFriendRequest(u, e)}
                                disabled={isLoading}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-2xs disabled:opacity-50"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>{isLoading ? 'Sending...' : 'Add Friend'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* TAB 2: Friends (ONLY already-connected friends) (Requirement 2B) */
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search your friends by name or username..."
                    value={friendsSearchQuery}
                    onChange={(e) => setFriendsSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-700/60 max-h-80 overflow-y-auto pr-1">
                  {filteredFriends.length === 0 ? (
                    <div className="text-center py-10 space-y-2">
                      <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {friendsSearchQuery.trim()
                          ? 'No friends found matching your search.'
                          : 'No friends added yet. Use "Search Registered Users" tab to add friends.'}
                      </p>
                      {!friendsSearchQuery.trim() && (
                        <button
                          onClick={() => setActiveTab('search')}
                          className="mt-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-lg transition"
                        >
                          Find Registered Users
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredFriends.map((friend) => {
                      const isLoading = actionLoadingId === friend.id;

                      return (
                        <div
                          key={friend.id}
                          onClick={() => setSelectedProfileUser(friend)}
                          className="p-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition gap-2 cursor-pointer group"
                        >
                          {/* Friend Avatar & Info */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="relative shrink-0">
                              <img
                                src={
                                  friend.avatar ||
                                  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
                                }
                                alt={friend.name || 'Friend'}
                                className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                              />
                              <span
                                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white dark:border-slate-800 ${
                                  friend.onlineStatus === 'online' ? 'bg-emerald-500' : 'bg-slate-400'
                                }`}
                              />
                            </div>
                            <div className="truncate min-w-0">
                              <p className="font-semibold text-xs text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition truncate">
                                {friend.name}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                @{friend.username} {friend.email ? `• ${friend.email}` : ''}
                              </p>
                            </div>
                          </div>

                          {/* Message Button */}
                          <div className="shrink-0">
                            <button
                              onClick={(e) => handleStartChat(friend, e)}
                              disabled={isLoading}
                              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>{isLoading ? 'Opening...' : 'Message'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Profile Inspection Modal (Requirement 6) */}
      {selectedProfileUser && (
        <UserProfileModal
          user={selectedProfileUser}
          onClose={() => setSelectedProfileUser(null)}
        />
      )}
    </>
  );
};
