import React, { useState } from 'react';
import { Search, X, MessageSquare, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { api } from '../services/api';

export const NewChatModal: React.FC = () => {
  const { currentUser, usersList } = useAuth();
  const {
    newChatOpen,
    setNewChatOpen,
    setAddContactOpen,
    setActiveConversationId,
    loadConversations,
  } = useChat();

  const [search, setSearch] = useState('');
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!newChatOpen || !currentUser) return null;

  const filteredUsers = usersList.filter((u) => {
    if (u.id === currentUser.id) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (u.name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q);
  });

  const handleStartChat = async (targetUserId: string) => {
    setErrorMsg('');
    setLoadingChatId(targetUserId);
    try {
      const conv = await api.createPrivateConversation(targetUserId);
      await loadConversations();
      if (conv && conv.id) {
        setActiveConversationId(conv.id);
      }
      setNewChatOpen(false);
    } catch (err: any) {
      console.error('Failed to start chat:', err);
      setErrorMsg(err.message || 'Could not start conversation. Please try again.');
    } finally {
      setLoadingChatId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[80vh] animate-fade-in">
        {/* Header */}
        <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-500" /> Start New Chat
          </h3>
          <button
            onClick={() => setNewChatOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="p-0.5 hover:bg-red-500/20 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Search */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-200/70 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-700/50">
          <div
            onClick={() => {
              setNewChatOpen(false);
              setAddContactOpen(true);
            }}
            className="p-3 mb-1 flex items-center gap-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-xl cursor-pointer transition"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm">Add Friends</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Search registered users or save a friend</p>
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">No users found</p>
          ) : (
            filteredUsers.map((u) => (
              <button
                key={u.id}
                disabled={loadingChatId === u.id}
                onClick={() => handleStartChat(u.id)}
                className="w-full p-3 flex items-center justify-between hover:bg-emerald-500/10 dark:hover:bg-slate-700/60 rounded-xl cursor-pointer transition disabled:opacity-50 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                      alt={u.name || 'User'}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${
                        u.onlineStatus === 'online' ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      {u.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      @{u.username} • {u.bio}
                    </p>
                  </div>
                </div>

                {loadingChatId === u.id ? (
                  <span className="text-xs text-emerald-500 animate-pulse font-medium">Starting...</span>
                ) : (
                  <UserPlus className="w-5 h-5 text-emerald-500" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
