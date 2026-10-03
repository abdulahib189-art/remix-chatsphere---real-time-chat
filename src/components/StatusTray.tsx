import React from 'react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { Plus, Mic, Image as ImageIcon, Video, Sparkles } from 'lucide-react';

export const StatusTray: React.FC = () => {
  const { currentUser } = useAuth();
  const {
    statuses,
    setCreateStatusOpen,
    setStatusViewerOpen,
    setViewingStatusIndex,
  } = useChat();

  if (!currentUser) return null;

  // Find user's own status
  const myStatuses = statuses.filter((s) => s.userId === currentUser.id);
  const myLatestStatus = myStatuses[0];

  // Other users' statuses
  const otherStatuses = statuses.filter((s) => s.userId !== currentUser.id);

  // Group other statuses by user to display unique avatars
  const groupedOtherUsers: { [userId: string]: typeof statuses } = {};
  otherStatuses.forEach((s) => {
    if (!groupedOtherUsers[s.userId]) {
      groupedOtherUsers[s.userId] = [];
    }
    groupedOtherUsers[s.userId].push(s);
  });

  const otherUserList = Object.values(groupedOtherUsers);

  const handleOpenMyStatus = () => {
    if (myStatuses.length > 0) {
      // Find index of my first status in global statuses array
      const globalIdx = statuses.findIndex((s) => s.id === myLatestStatus.id);
      setViewingStatusIndex(globalIdx !== -1 ? globalIdx : 0);
      setStatusViewerOpen(true);
    } else {
      setCreateStatusOpen(true);
    }
  };

  const handleOpenUserStatus = (firstStatusId: string) => {
    const globalIdx = statuses.findIndex((s) => s.id === firstStatusId);
    setViewingStatusIndex(globalIdx !== -1 ? globalIdx : 0);
    setStatusViewerOpen(true);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="w-3 h-3 text-white" />;
      case 'video':
        return <Video className="w-3 h-3 text-white" />;
      case 'audio':
        return <Mic className="w-3 h-3 text-white" />;
      default:
        return <Sparkles className="w-3 h-3 text-white" />;
    }
  };

  return (
    <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Status
        </span>
        <button
          onClick={() => setCreateStatusOpen(true)}
          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Status
        </button>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
        {/* My Status Item */}
        <div className="flex flex-col items-center gap-1 min-w-[60px] cursor-pointer group" onClick={handleOpenMyStatus}>
          <div className="relative">
            <div
              className={`w-12 h-12 rounded-full p-0.5 transition-transform group-hover:scale-105 ${
                myLatestStatus
                  ? 'bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-600'
                  : 'border-2 border-dashed border-slate-300 dark:border-slate-700'
              }`}
            >
              <img
                src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={currentUser.name}
                className="w-full h-full object-cover rounded-full bg-slate-200 dark:bg-slate-800"
              />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCreateStatusOpen(true);
              }}
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm hover:bg-emerald-700 transition-colors"
              title="Add new status"
            >
              <Plus className="w-3 h-3 stroke-[3]" />
            </button>
          </div>
          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate max-w-[60px]">
            My Status
          </span>
        </div>

        {/* Other Users' Statuses */}
        {otherUserList.map((userStatusGroup) => {
          const latest = userStatusGroup[0];
          return (
            <div
              key={latest.userId}
              className="flex flex-col items-center gap-1 min-w-[60px] cursor-pointer group"
              onClick={() => handleOpenUserStatus(latest.id)}
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 transition-transform group-hover:scale-105 shadow-xs">
                  <img
                    src={latest.userAvatar}
                    alt={latest.userName}
                    className="w-full h-full object-cover rounded-full bg-slate-200 dark:bg-slate-800 border border-white dark:border-slate-900"
                  />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-600 rounded-full flex items-center justify-center border border-white dark:border-slate-900 shadow-2xs">
                  {getTypeIcon(latest.type)}
                </div>
              </div>
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate max-w-[64px]">
                {latest.userName.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
