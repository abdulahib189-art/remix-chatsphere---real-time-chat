import React, { useState, useRef } from 'react';
import { User as UserIcon, X, Camera, Lock, Shield, Check, LogOut, Mail, Loader2, AlertCircle, BadgeCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { api } from '../services/api';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
];

export const ProfileModal: React.FC = () => {
  const { currentUser, updateProfile, logout } = useAuth();
  const { profileModalOpen, setProfileModalOpen } = useChat();

  const [name, setName] = useState(currentUser?.name || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [showOnline, setShowOnline] = useState(currentUser?.privacy?.showOnline ?? true);
  const [showLastSeen, setShowLastSeen] = useState(currentUser?.privacy?.showLastSeen ?? true);
  const [showReadReceipts, setShowReadReceipts] = useState(currentUser?.privacy?.showReadReceipts ?? true);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!profileModalOpen || !currentUser) return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateProfile({
        name: name.trim(),
        username: username.trim(),
        bio: bio.trim(),
        avatar,
        privacy: { showOnline, showLastSeen, showReadReceipts },
      });
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        setProfileModalOpen(false);
      }, 1000);
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please select a valid image file (PNG, JPG, WEBP, etc.).');
      return;
    }

    setAvatarError(null);
    setUploadingAvatar(true);

    try {
      // Create local preview immediately for great UX
      const localPreviewUrl = URL.createObjectURL(file);
      setAvatar(localPreviewUrl);

      // Compress avatar image to 300x300 square canvas for crisp and super fast upload
      const compressedDataUrl = await new Promise<string>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 300;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.88));
          } else {
            resolve(localPreviewUrl);
          }
        };
        img.onerror = () => resolve(localPreviewUrl);
        img.src = localPreviewUrl;
      });

      // Try uploading to backend
      let finalAvatarUrl = compressedDataUrl;
      try {
        const uploaded = await api.uploadFile(file);
        if (uploaded && uploaded.url) {
          finalAvatarUrl = uploaded.url;
        }
      } catch (uploadErr) {
        console.warn('Backend upload fell back to dataUrl:', uploadErr);
      }

      setAvatar(finalAvatarUrl);
      // Persist profile picture to backend and current user state
      await updateProfile({ avatar: finalAvatarUrl });
    } catch (err: any) {
      console.error('Avatar upload failed:', err);
      setAvatarError(err.message || 'Failed to upload profile picture.');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
        {/* Header */}
        <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-emerald-500" /> Edit Profile
            </h3>
            {currentUser.isVerified && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[11px] font-bold border border-blue-500/20">
                <BadgeCheck className="w-3.5 h-3.5 fill-blue-500/20" /> Verified
              </span>
            )}
            {currentUser.role === 'admin' && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[11px] font-bold border border-amber-500/20">
                <Shield className="w-3.5 h-3.5" /> Admin
              </span>
            )}
          </div>
          <button
            onClick={() => setProfileModalOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {avatarError && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{avatarError}</span>
            </div>
          )}

          {/* Avatar Section */}
          <div className="flex flex-col items-center space-y-2">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <img
                src={avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                alt={name || 'User'}
                className="w-24 h-24 rounded-full object-cover ring-4 ring-emerald-500/30"
              />
              <div className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition">
                {uploadingAvatar ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <>
                    <Camera className="w-6 h-6 text-white" />
                    <span className="text-[10px] text-white font-medium mt-0.5">Change</span>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleAvatarUpload}
                accept="image/*"
                className="hidden"
              />
            </div>

            <p className="text-[11px] text-slate-400">Click avatar to upload photo from your device</p>

            {/* Presets */}
            <div className="flex items-center gap-2 pt-1">
              {PRESET_AVATARS.map((img) => (
                <img
                  key={img}
                  src={img}
                  alt="Preset"
                  onClick={async () => {
                    setAvatar(img);
                    await updateProfile({ avatar: img });
                  }}
                  className={`w-8 h-8 rounded-full object-cover cursor-pointer transition ${
                    avatar === img
                      ? 'ring-2 ring-emerald-500 scale-110'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Registered Email Address (Requirement 1) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-emerald-500" />
              <input
                type="email"
                readOnly
                value={currentUser.email || ''}
                className="w-full pl-9 pr-3 py-2 bg-slate-100/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-xs rounded-xl border border-slate-200 dark:border-slate-600 focus:outline-none cursor-not-allowed font-medium select-all"
                title="Registered account email address"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              This is the verified email address linked to your account.
            </p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              About / Bio
            </label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Add a status or bio..."
              className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Privacy Toggles */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-500" /> Privacy Options
            </h4>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-700 dark:text-slate-300">
                Show Online Status
              </span>
              <input
                type="checkbox"
                checked={showOnline}
                onChange={(e) => setShowOnline(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-700 dark:text-slate-300">
                Show Last Seen
              </span>
              <input
                type="checkbox"
                checked={showLastSeen}
                onChange={(e) => setShowLastSeen(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-700 dark:text-slate-300">
                Show Read Receipts
              </span>
              <input
                type="checkbox"
                checked={showReadReceipts}
                onChange={(e) => setShowReadReceipts(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <button
            onClick={() => {
              logout();
              setProfileModalOpen(false);
            }}
            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4" /> Saved!
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
