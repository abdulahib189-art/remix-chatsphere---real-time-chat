import React, { useState } from 'react';
import { Share2, X, Check, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';

export const ForwardModal: React.FC = () => {
  const { currentUser, usersList } = useAuth();
  const {
    forwardModalMessage,
    setForwardModalMessage,
    conversations,
    forwardMessages,
  } = useChat();

  const [selectedConvIds, setSelectedConvIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  if (!forwardModalMessage || !currentUser) return null;

  const toggleSelectConv = (id: string) => {
    setSelectedConvIds((prev) =>
      prev.includes(id) ? prev.filter((cId) => cId !== id) : [...prev, id]
    );
  };

  const handleForward = async () => {
    if (selectedConvIds.length === 0) return alert('Select at least one chat to forward to.');
    await forwardMessages(selectedConvIds);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[85vh] animate-fade-in">
        {/* Header */}
        <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-sky-500" /> Forward Message
          </h3>
          <button
            onClick={() => setForwardModalMessage(null)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message preview snippet */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-xs">
          <p className="text-slate-400 font-semibold mb-1">Message Preview:</p>
          <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 italic text-slate-700 dark:text-slate-200 truncate">
            "{forwardModalMessage.text || forwardModalMessage.type}"
          </div>
        </div>

        {/* Search */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-200/70 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        {/* Conversations list */}
        <div className="p-2 space-y-1 flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
          {conversations.map((conv) => {
            let convName = conv.name || 'Chat';
            let convAvatar = conv.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';

            if (conv.type === 'private') {
              const otherId = conv.memberIds.find((id) => id !== currentUser.id);
              const otherUser = usersList.find((u) => u.id === otherId);
              if (otherUser) {
                convName = otherUser.name || otherUser.username || 'Chat';
                convAvatar = otherUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
              }
            }

            const isSelected = selectedConvIds.includes(conv.id);

            return (
              <div
                key={conv.id}
                onClick={() => toggleSelectConv(conv.id)}
                className="p-2.5 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl cursor-pointer text-xs transition"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={convAvatar}
                    alt={convName}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {convName}
                  </span>
                </div>

                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center border transition ${
                    isSelected
                      ? 'bg-sky-500 border-sky-500 text-white'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action button */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            onClick={handleForward}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold shadow transition"
          >
            Forward to {selectedConvIds.length} Chat(s)
          </button>
        </div>
      </div>
    </div>
  );
};
