import React, { useState } from 'react';
import { useChat } from '../context/ChatContext';
import { Flame, Info, CheckCircle2, Clock } from 'lucide-react';

export const StreakBadge: React.FC = () => {
  const { activeStreak, activeConversation } = useChat();
  const [showTooltip, setShowTooltip] = useState(false);

  if (!activeConversation || activeConversation.type !== 'private' || !activeStreak) {
    return null;
  }

  const { streakCount, isActiveToday, userAMessagesToday, userBMessagesToday } = activeStreak;

  return (
    <div className="relative">
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all shadow-xs border ${
          streakCount > 0
            ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900/50 hover:scale-105'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-200'
        }`}
        title="Chat Streak Status"
      >
        <Flame className={`w-3.5 h-3.5 ${streakCount > 0 ? 'text-orange-500 fill-orange-500 animate-pulse' : 'text-gray-400'}`} />
        <span>{streakCount}</span>
      </button>

      {/* Tooltip Popover */}
      {showTooltip && (
        <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 text-xs z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-gray-800 font-bold text-gray-900 dark:text-white">
            <span className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
              <Flame className="w-4 h-4 fill-orange-500" />
              Chat Streak
            </span>
            <span className="text-sm">{streakCount} Days</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-1.5 text-gray-600 dark:text-gray-300">
              {isActiveToday ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {isActiveToday ? 'Streak Active Today!' : 'Streak Pending Today'}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
                  {isActiveToday
                    ? 'Both of you sent messages today to keep the flame alive!'
                    : 'Send messages back and forth today to extend your streak.'}
                </div>
              </div>
            </div>

            <div className="p-2 bg-gray-50 dark:bg-gray-800/60 rounded-lg text-[11px] text-gray-600 dark:text-gray-300 flex justify-between">
              <span>Your msgs today: <strong>{userAMessagesToday}</strong></span>
              <span>Friend msgs today: <strong>{userBMessagesToday}</strong></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
