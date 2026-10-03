import React, { useState } from 'react';
import { User } from '../types';
import { X, Mail, Phone, UserCheck, UserPlus, Check, XCircle, MessageSquare, Clock, BadgeCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { api } from '../services/api';

interface UserProfileModalProps {
  user: User | null;
  friendRequestId?: string;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  friendRequestId,
  onClose,
}) => {
  const { currentUser } = useAuth();
  const {
    incomingRequests,
    outgoingRequests,
    sendFriendRequest,
    respondFriendRequest,
    setActiveConversationId,
    loadConversations,
  } = useChat();

  const [sendingRequest, setSendingRequest] = useState(false);

  if (!user || !currentUser) return null;

  const isFriend = currentUser.contacts?.includes(user.id);
  const incomingReq = incomingRequests.find((r) => r.senderId === user.id && r.status === 'pending');
  const outgoingReq = outgoingRequests.find((r) => r.receiverId === user.id && r.status === 'pending');
  const reqIdToUse = friendRequestId || incomingReq?.id;

  const handleStartChat = async () => {
    onClose();
    try {
      const conv = await api.createPrivateConversation(user.id);
      await loadConversations();
      if (conv && conv.id) {
        setActiveConversationId(conv.id);
      }
    } catch (err) {
      console.error('Failed to start chat:', err);
    }
  };

  const handleSendRequest = async () => {
    setSendingRequest(true);
    try {
      await sendFriendRequest(user.id);
    } catch (err) {
      console.error('Failed to send friend request:', err);
    } finally {
      setSendingRequest(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none">
      <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col animate-fade-in">
        {/* Banner / Header */}
        <div className="relative bg-gradient-to-r from-emerald-600 to-teal-700 h-28 p-4 flex items-start justify-between text-white">
          <span className="text-xs font-semibold uppercase tracking-wider bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full">
            User Profile
          </span>
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white bg-black/20 hover:bg-black/30 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Info Body */}
        <div className="px-6 pt-0 pb-6 flex-1 flex flex-col items-center text-center -mt-12 space-y-3">
          <div className="relative">
            <img
              src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
              alt={user.name || 'User'}
              className="w-24 h-24 rounded-full object-cover ring-4 ring-white dark:ring-slate-800 shadow-xl"
            />
            <span
              className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${
                user.onlineStatus === 'online' ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center justify-center gap-1.5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{user.name}</h2>
              {user.isVerified && (
                <BadgeCheck className="w-5 h-5 text-blue-500 fill-blue-500/20 shrink-0" aria-label="Verified Account" />
              )}
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">@{user.username}</p>
          </div>

          {user.bio && (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic bg-slate-100 dark:bg-slate-700/50 p-3 rounded-2xl w-full">
              "{user.bio}"
            </p>
          )}

          <div className="w-full space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-xs text-left">
            {user.email && (
              <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
                <Mail className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="w-full pt-4 space-y-2">
            {reqIdToUse ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Pending Friend Request from this user
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await respondFriendRequest(reqIdToUse, 'accept');
                      onClose();
                    }}
                    className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs shadow flex items-center justify-center gap-1.5 transition"
                  >
                    <Check className="w-4 h-4" /> Accept
                  </button>
                  <button
                    onClick={async () => {
                      await respondFriendRequest(reqIdToUse, 'deny');
                      onClose();
                    }}
                    className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-rose-500 hover:text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" /> Deny
                  </button>
                </div>
              </div>
            ) : isFriend ? (
              <div className="flex gap-2">
                <button
                  onClick={handleStartChat}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs shadow flex items-center justify-center gap-1.5 transition"
                >
                  <MessageSquare className="w-4 h-4" /> Send Message
                </button>
              </div>
            ) : outgoingReq ? (
              <button
                disabled
                className="w-full py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
              >
                <Clock className="w-4 h-4" /> Request Sent (Pending)
              </button>
            ) : user.id !== currentUser.id ? (
              <button
                onClick={handleSendRequest}
                disabled={sendingRequest}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs shadow flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" /> {sendingRequest ? 'Sending...' : 'Send Friend Request'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
