import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Video,
  Mail,
  User as UserIcon,
  Users,
  Shield,
  ShieldAlert,
  UserPlus,
  UserMinus,
  Ban,
  Trash2,
  VolumeX,
  Volume2,
  Image as ImageIcon,
  FileText,
  Link as LinkIcon,
  Settings,
  Check,
  LogOut,
  Edit3,
  Flag,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { api } from '../services/api';
import { GroupPermissions } from '../types';
import { ReportUserModal } from './ReportUserModal';

export const RightInfoPanel: React.FC = () => {
  const { currentUser, usersList, refreshUsers } = useAuth();
  const {
    activeConversation,
    infoPanelOpen,
    setInfoPanelOpen,
    messages,
    loadConversations,
    setActiveConversationId,
  } = useChat();

  const [activeTab, setActiveTab] = useState<'members' | 'media' | 'files' | 'links'>('members');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Group Settings Form State
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editPermissions, setEditPermissions] = useState<GroupPermissions>({
    sendMessages: 'all',
    editInfo: 'admins',
    addMembers: 'admins',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (activeConversation && activeConversation.type === 'group') {
      setEditName(activeConversation.name || '');
      setEditDescription(activeConversation.description || '');
      setEditAvatar(activeConversation.avatar || '');
      setEditPermissions(
        activeConversation.permissions || {
          sendMessages: 'all',
          editInfo: 'admins',
          addMembers: 'admins',
        }
      );
    }
  }, [activeConversation]);

  if (!infoPanelOpen || !activeConversation || !currentUser) return null;

  let infoName = activeConversation.name || 'Chat';
  let infoAvatar = activeConversation.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
  let infoBio = activeConversation.description || '';
  let infoPhone = '';
  let infoEmail = '';
  let otherUserObj: any = null;

  if (activeConversation.type === 'private') {
    const otherId = activeConversation.memberIds.find((id) => id !== currentUser.id);
    otherUserObj = usersList.find((u) => u.id === otherId);
    if (otherUserObj) {
      infoName = otherUserObj.name || otherUserObj.username || 'Chat';
      infoAvatar = otherUserObj.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
      infoBio = otherUserObj.bio;
      infoPhone = otherUserObj.phone || '';
      infoEmail = otherUserObj.email;
    }
  }

  const isMuted = activeConversation.mutedUserIds?.includes(currentUser.id);
  const isAdmin =
    activeConversation.type === 'group' &&
    activeConversation.groupAdmins?.includes(currentUser.id);

  const handleToggleMute = async () => {
    await api.updateConversation(activeConversation.id, {
      action: isMuted ? 'unmute' : 'mute',
    });
    loadConversations();
  };

  const handlePromoteAdmin = async (targetUserId: string) => {
    await api.updateConversation(activeConversation.id, {
      action: 'promote',
      targetUserId,
    });
    loadConversations();
  };

  const handleDemoteAdmin = async (targetUserId: string) => {
    await api.updateConversation(activeConversation.id, {
      action: 'demote',
      targetUserId,
    });
    loadConversations();
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (confirm('Are you sure you want to remove this member from the group?')) {
      await api.updateConversation(activeConversation.id, {
        action: 'remove_member',
        targetUserId,
      });
      loadConversations();
    }
  };

  const handleLeaveGroup = async () => {
    if (confirm('Are you sure you want to leave this group?')) {
      await api.updateConversation(activeConversation.id, {
        action: 'remove_member',
        targetUserId: currentUser.id,
      });
      await loadConversations();
      setActiveConversationId(null);
      setInfoPanelOpen(false);
    }
  };

  const handleAddMember = async (targetUserId: string) => {
    await api.updateConversation(activeConversation.id, {
      action: 'add_member',
      targetUserId,
    });
    loadConversations();
    setShowAddMemberModal(false);
  };

  const handleSaveGroupSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.updateConversation(activeConversation.id, {
        name: editName,
        description: editDescription,
        avatar: editAvatar,
        permissions: editPermissions,
      });
      await loadConversations();
      setIsEditingGroup(false);
    } catch (err) {
      console.error('Failed to update group settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  // Shared media/files
  const sharedMedia = messages.filter((m) => m.type === 'image' || m.type === 'video');
  const sharedFiles = messages.filter((m) => m.type === 'file');
  const sharedLinks = messages.filter((m) => m.linkPreview);

  return (
    <aside className="w-full md:w-80 lg:w-96 bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col h-full select-none shrink-0 z-20">
      {/* Header */}
      <div className="p-3 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
          {activeConversation.type === 'group' ? 'Group Info' : 'Contact Info'}
        </h3>
        <button
          onClick={() => setInfoPanelOpen(false)}
          className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Contact / Group Banner */}
        <div className="flex flex-col items-center text-center space-y-2">
          <img
            src={infoAvatar}
            alt={infoName}
            className="w-24 h-24 rounded-full object-cover ring-4 ring-emerald-500/20 shadow-lg"
          />
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center justify-center gap-1.5">
            {infoName}
            {activeConversation.type === 'group' && (
              <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold rounded-full">
                Group
              </span>
            )}
          </h2>
          {infoBio && (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic max-w-xs">
              "{infoBio}"
            </p>
          )}

          {/* Group Admin Actions */}
          {activeConversation.type === 'group' && (
            <div className="pt-2 flex flex-wrap gap-2 justify-center w-full">
              {isAdmin && (
                <button
                  onClick={() => setIsEditingGroup(!isEditingGroup)}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs rounded-xl shadow flex items-center gap-1.5 transition"
                >
                  <Settings className="w-3.5 h-3.5" />
                  {isEditingGroup ? 'Close Settings' : 'Edit Group Settings'}
                </button>
              )}
              <button
                onClick={handleLeaveGroup}
                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition"
              >
                <LogOut className="w-3.5 h-3.5" /> Leave Group
              </button>
            </div>
          )}
        </div>

        {/* Group Admin Settings Form */}
        {activeConversation.type === 'group' && isAdmin && isEditingGroup && (
          <form onSubmit={handleSaveGroupSettings} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-emerald-500/30 shadow-md space-y-3 text-xs">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Settings className="w-4 h-4" /> Group Admin Settings
            </h4>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Group Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Group Topic / Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Avatar Image URL</label>
              <input
                type="text"
                value={editAvatar}
                onChange={(e) => setEditAvatar(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-2">
              <p className="font-bold text-slate-700 dark:text-slate-300">Group Permissions</p>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-[11px] mb-0.5">Who can send messages?</label>
                <select
                  value={editPermissions.sendMessages}
                  onChange={(e) => setEditPermissions({ ...editPermissions, sendMessages: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Group Members</option>
                  <option value="admins">Only Group Admins</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-[11px] mb-0.5">Who can edit group info?</label>
                <select
                  value={editPermissions.editInfo}
                  onChange={(e) => setEditPermissions({ ...editPermissions, editInfo: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="admins">Only Group Admins</option>
                  <option value="all">All Group Members</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-[11px] mb-0.5">Who can add new members?</label>
                <select
                  value={editPermissions.addMembers}
                  onChange={(e) => setEditPermissions({ ...editPermissions, addMembers: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="admins">Only Group Admins</option>
                  <option value="all">All Group Members</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={savingSettings}
                className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs shadow flex items-center justify-center gap-1 transition"
              >
                <Check className="w-3.5 h-3.5" /> {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditingGroup(false)}
                className="px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Contact Details */}
        {activeConversation.type === 'private' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
            {infoPhone && (
              <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <Phone className="w-4 h-4 text-emerald-500" />
                <span>{infoPhone}</span>
              </div>
            )}
            {infoEmail && (
              <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <Mail className="w-4 h-4 text-sky-500" />
                <span>{infoEmail}</span>
              </div>
            )}
            {otherUserObj && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5">
                {currentUser.contacts?.includes(otherUserObj.id) ? (
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium py-1">
                    <UserPlus className="w-4 h-4" />
                    <span>Saved in Contacts</span>
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      await api.manageContact(otherUserObj.id, 'add');
                      await refreshUsers();
                    }}
                    className="w-full py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <UserPlus className="w-4 h-4" /> Add to Contacts
                  </button>
                )}

                <button
                  onClick={() => setReportModalOpen(true)}
                  className="w-full py-1.5 bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 transition text-xs"
                >
                  <Flag className="w-4 h-4" /> Report User
                </button>
              </div>
            )}

            {otherUserObj && (
              <ReportUserModal
                isOpen={reportModalOpen}
                onClose={() => setReportModalOpen(false)}
                targetUserId={otherUserObj.id}
                targetUserName={otherUserObj.name}
              />
            )}
          </div>
        )}

        {/* Mute Notifications switch */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-amber-500" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-500" />
            )}
            <span>Mute Notifications</span>
          </div>
          <button
            onClick={handleToggleMute}
            className={`w-10 h-6 rounded-full transition-colors relative ${
              isMuted ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                isMuted ? 'right-1' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Navigation Tabs for Group Members / Shared Media */}
        <div className="border-b border-slate-200 dark:border-slate-800 flex gap-1">
          {activeConversation.type === 'group' && (
            <button
              onClick={() => setActiveTab('members')}
              className={`pb-2 text-xs font-semibold px-2 border-b-2 transition ${
                activeTab === 'members'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Members ({activeConversation.memberIds.length})
            </button>
          )}
          <button
            onClick={() => setActiveTab('media')}
            className={`pb-2 text-xs font-semibold px-2 border-b-2 transition ${
              activeTab === 'media'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Media ({sharedMedia.length})
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`pb-2 text-xs font-semibold px-2 border-b-2 transition ${
              activeTab === 'files'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Files ({sharedFiles.length})
          </button>
          <button
            onClick={() => setActiveTab('links')}
            className={`pb-2 text-xs font-semibold px-2 border-b-2 transition ${
              activeTab === 'links'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Links ({sharedLinks.length})
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'members' && activeConversation.type === 'group' && (
          <div className="space-y-3">
            {isAdmin && (
              <button
                onClick={() => setShowAddMemberModal(true)}
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow transition"
              >
                <UserPlus className="w-4 h-4" /> Add Group Member
              </button>
            )}

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {activeConversation.memberIds.map((mId) => {
                const memberUser = usersList.find((u) => u.id === mId);
                if (!memberUser) return null;

                const isGroupAdmin = activeConversation.groupAdmins?.includes(mId);

                return (
                  <div
                    key={mId}
                    className="py-2 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={memberUser.avatar}
                        alt={memberUser.name}
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                      <div className="truncate min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {memberUser.name}{' '}
                          {mId === currentUser.id && (
                            <span className="text-slate-400 font-normal">(You)</span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {memberUser.bio}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isGroupAdmin && (
                        <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded text-[10px] font-bold border border-emerald-500/20">
                          Admin
                        </span>
                      )}

                      {isAdmin && mId !== currentUser.id && (
                        <div className="flex items-center gap-1 ml-1">
                          {isGroupAdmin ? (
                            <button
                              onClick={() => handleDemoteAdmin(mId)}
                              className="p-1 text-amber-500 hover:bg-amber-500/10 rounded"
                              title="Demote Admin"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePromoteAdmin(mId)}
                              className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded"
                              title="Make Admin"
                            >
                              <Shield className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveMember(mId)}
                            className="p-1 text-rose-500 hover:bg-rose-500/10 rounded"
                            title="Remove Member"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'media' && (
          <div className="grid grid-cols-3 gap-2">
            {sharedMedia.length === 0 ? (
              <p className="col-span-3 text-center text-xs text-slate-400 py-4">
                No shared photos or videos
              </p>
            ) : (
              sharedMedia.map((m) => (
                <img
                  key={m.id}
                  src={m.mediaUrl}
                  alt="Shared media"
                  className="w-full h-20 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'files' && (
          <div className="space-y-2 text-xs">
            {sharedFiles.length === 0 ? (
              <p className="text-center text-slate-400 py-4">No shared files</p>
            ) : (
              sharedFiles.map((m) => (
                <a
                  key={m.id}
                  href={m.mediaUrl}
                  download
                  className="flex items-center gap-2.5 p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition"
                >
                  <FileText className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div className="truncate min-w-0 flex-1">
                    <p className="font-semibold truncate">{m.mediaName || 'File'}</p>
                    <p className="text-[10px] text-slate-400">
                      {m.mediaSize ? (m.mediaSize / 1024).toFixed(1) + ' KB' : 'File'}
                    </p>
                  </div>
                </a>
              ))
            )}
          </div>
        )}

        {activeTab === 'links' && (
          <div className="space-y-2 text-xs">
            {sharedLinks.length === 0 ? (
              <p className="text-center text-slate-400 py-4">No shared links</p>
            ) : (
              sharedLinks.map((m) => (
                <a
                  key={m.id}
                  href={m.linkPreview?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition"
                >
                  <div className="flex items-center gap-1 font-semibold text-emerald-500 truncate">
                    <LinkIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{m.linkPreview?.title}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {m.linkPreview?.url}
                  </p>
                </a>
              ))
            )}
          </div>
        )}
      </div>

      {/* Add Member Sub-modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl p-4 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Add Member to Group
              </h4>
              <button onClick={() => setShowAddMemberModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
              {usersList
                .filter((u) => !activeConversation.memberIds.includes(u.id))
                .map((u) => (
                  <div
                    key={u.id}
                    onClick={() => handleAddMember(u.id)}
                    className="p-2 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src={u.avatar}
                        alt={u.name}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {u.name}
                      </span>
                    </div>
                    <UserPlus className="w-4 h-4 text-emerald-500" />
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
