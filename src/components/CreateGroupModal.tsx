import React, { useState } from 'react';
import { Users, X, Check, Search, Camera } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { api } from '../services/api';

const PRESET_GROUP_AVATARS = [
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=150&auto=format&fit=crop&q=80',
];

export const CreateGroupModal: React.FC = () => {
  const { currentUser, usersList } = useAuth();
  const {
    createGroupOpen,
    setCreateGroupOpen,
    setActiveConversationId,
    loadConversations,
  } = useChat();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState(PRESET_GROUP_AVATARS[0]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  if (!createGroupOpen || !currentUser) return null;

  const filteredUsers = usersList.filter((u) => {
    if (u.id === currentUser.id) return false;
    if (!search.trim()) return true;
    return (u.name || '').toLowerCase().includes(search.toLowerCase()) || (u.username || '').toLowerCase().includes(search.toLowerCase());
  });

  const toggleSelectMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  const handleCreateGroup = async () => {
    if (!name.trim()) return alert('Please enter a group name.');
    if (selectedMemberIds.length === 0) return alert('Select at least 1 group member.');

    try {
      const groupConv = await api.createGroupConversation(
        name,
        selectedMemberIds,
        description,
        avatar
      );
      await loadConversations();
      setActiveConversationId(groupConv.id);
      setCreateGroupOpen(false);
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[85vh] animate-fade-in">
        {/* Header */}
        <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-500" /> Create New Group
          </h3>
          <button
            onClick={() => setCreateGroupOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {/* Avatar Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Group Icon
            </label>
            <div className="flex items-center gap-2">
              {PRESET_GROUP_AVATARS.map((img) => (
                <img
                  key={img}
                  src={img}
                  alt="Preset avatar"
                  onClick={() => setAvatar(img)}
                  className={`w-12 h-12 rounded-full object-cover cursor-pointer transition ${
                    avatar === img
                      ? 'ring-4 ring-emerald-500 scale-105'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Group Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Group Name *
            </label>
            <input
              type="text"
              placeholder="e.g. 🚀 Sprint Deliverables"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Group Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Group Description
            </label>
            <input
              type="text"
              placeholder="Optional topic or guidelines..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Member Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Add Members ({selectedMemberIds.length} selected)
            </label>

            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
              {filteredUsers.map((u) => {
                const isSelected = selectedMemberIds.includes(u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleSelectMember(u.id)}
                    className="p-2 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src={u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                        alt={u.name || 'User'}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {u.name}
                      </span>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center border transition ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Button */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            onClick={handleCreateGroup}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow transition"
          >
            Create Group
          </button>
        </div>
      </div>
    </div>
  );
};
