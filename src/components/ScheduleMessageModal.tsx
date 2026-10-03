import React, { useState, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { X, Clock, Calendar, Globe, Send, AlertCircle, Loader2, User as UserIcon } from 'lucide-react';
import { api } from '../services/api';

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Australia/Sydney',
];

export const ScheduleMessageModal: React.FC = () => {
  const { currentUser, usersList } = useAuth();
  const {
    conversations,
    activeConversationId,
    scheduleModalOpen,
    setScheduleModalOpen,
    createScheduledMessage,
    setScheduledListOpen,
    loadConversations,
  } = useChat();

  const [selectedFriendId, setSelectedFriendId] = useState('');
  const [content, setContent] = useState('');

  // Default date time: 1 hour in the future
  const getMinDateTime = () => {
    const now = new Date(Date.now() + 5 * 60 * 1000); // at least 5 mins in future
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };

  const [scheduledAtLocal, setScheduledAtLocal] = useState(getMinDateTime());
  const [selectedTimezone, setSelectedTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const contactsSet = new Set(currentUser?.contacts || []);
  const friendUsers = usersList.filter(
    (u) => u.id !== currentUser?.id && contactsSet.has(u.id)
  );

  useEffect(() => {
    if (scheduleModalOpen && currentUser) {
      let initialFriendId = '';
      if (activeConversationId) {
        const activeConv = conversations.find((c) => c.id === activeConversationId);
        if (activeConv && activeConv.type === 'private') {
          const otherId = activeConv.memberIds.find((id) => id !== currentUser.id);
          if (otherId && contactsSet.has(otherId)) {
            initialFriendId = otherId;
          }
        }
      }
      if (!initialFriendId && friendUsers.length > 0) {
        initialFriendId = friendUsers[0].id;
      }
      setSelectedFriendId(initialFriendId);
      setContent('');
      setScheduledAtLocal(getMinDateTime());
      setErrorMessage('');
    }
  }, [scheduleModalOpen, activeConversationId, currentUser]);

  if (!scheduleModalOpen || !currentUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedFriendId) {
      setErrorMessage('Please select a user.');
      return;
    }

    if (!content.trim()) {
      setErrorMessage('Please write a message content.');
      return;
    }

    const targetTime = new Date(scheduledAtLocal);
    if (isNaN(targetTime.getTime()) || targetTime <= new Date()) {
      setErrorMessage('Scheduled time must be in the future.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Find or create private conversation with selected friend
      let targetConv = conversations.find(
        (c) =>
          c.type === 'private' &&
          c.memberIds.includes(currentUser.id) &&
          c.memberIds.includes(selectedFriendId)
      );

      let convId = targetConv?.id;
      if (!convId) {
        const newConv = await api.createPrivateConversation(selectedFriendId);
        await loadConversations();
        convId = newConv.id;
      }

      await createScheduledMessage({
        conversationId: convId,
        content: content.trim(),
        scheduledAt: targetTime.toISOString(),
        timezone: selectedTimezone,
      });

      setScheduleModalOpen(false);
      setScheduledListOpen(true);
    } catch (err: any) {
      console.error('Schedule failed:', err);
      setErrorMessage(err.message || 'Failed to schedule message.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-500" />
            Schedule Message
          </h2>
          <button
            onClick={() => setScheduleModalOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* User Selector (Requirement 5) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
              Select User
            </label>
            <select
              value={selectedFriendId}
              onChange={(e) => setSelectedFriendId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
            >
              {friendUsers.length === 0 ? (
                <option value="" disabled>
                  No friends added yet (add friends first)
                </option>
              ) : (
                friendUsers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} (@{f.username}) {f.email ? `• ${f.email}` : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Message Content */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
              Message Text
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type your future message here..."
              rows={3}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white resize-none"
            />
          </div>

          {/* Date & Time Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                Scheduled Time
              </label>
              <input
                type="datetime-local"
                value={scheduledAtLocal}
                onChange={(e) => setScheduledAtLocal(e.target.value)}
                min={getMinDateTime()}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                Timezone
              </label>
              <select
                value={selectedTimezone}
                onChange={(e) => setSelectedTimezone(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setScheduleModalOpen(false);
                setScheduledListOpen(true);
              }}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              View Scheduled Messages ({'->'})
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScheduleModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || friendUsers.length === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-sm flex items-center gap-2 transition-colors"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Schedule Message
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
