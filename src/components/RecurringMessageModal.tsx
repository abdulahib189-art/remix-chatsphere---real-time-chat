import React, { useState, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { X, Repeat, Calendar, Clock, Globe, Send, AlertCircle, Loader2 } from 'lucide-react';
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

export const RecurringMessageModal: React.FC = () => {
  const { currentUser, usersList } = useAuth();
  const {
    conversations,
    activeConversationId,
    recurringModalOpen,
    setRecurringModalOpen,
    createRecurringSchedule,
    setRecurringListOpen,
    loadConversations,
  } = useChat();

  const [selectedFriendId, setSelectedFriendId] = useState('');
  const [content, setContent] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [time, setTime] = useState('09:00');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endRule, setEndRule] = useState<'never' | 'custom_date' | 'occurrences'>('never');
  const [endDate, setEndDate] = useState('');
  const [maxOccurrences, setMaxOccurrences] = useState<number>(10);
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
    if (recurringModalOpen && currentUser) {
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
      setFrequency('daily');
      setTime('09:00');
      setStartDate(new Date().toISOString().slice(0, 10));
      setEndRule('never');
      setErrorMessage('');
    }
  }, [recurringModalOpen, activeConversationId, currentUser]);

  if (!recurringModalOpen || !currentUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedFriendId) {
      setErrorMessage('Please select a user.');
      return;
    }

    if (!content.trim()) {
      setErrorMessage('Please write message content.');
      return;
    }

    if (endRule === 'custom_date' && !endDate) {
      setErrorMessage('Please select an end date.');
      return;
    }

    if (endRule === 'occurrences' && (!maxOccurrences || maxOccurrences < 1)) {
      setErrorMessage('Please specify a valid number of occurrences.');
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

      await createRecurringSchedule({
        conversationId: convId,
        content: content.trim(),
        frequency,
        time,
        startAt: new Date(`${startDate}T${time}:00`).toISOString(),
        endRule,
        endAt: endRule === 'custom_date' && endDate ? new Date(`${endDate}T23:59:59`).toISOString() : undefined,
        maxOccurrences: endRule === 'occurrences' ? Number(maxOccurrences) : undefined,
        timezone: selectedTimezone,
      });

      setRecurringModalOpen(false);
      setRecurringListOpen(true);
    } catch (err: any) {
      console.error('Create recurring schedule failed:', err);
      setErrorMessage(err.message || 'Failed to create recurring schedule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Repeat className="w-5 h-5 text-emerald-500" />
            Recurring Message
          </h2>
          <button
            onClick={() => setRecurringModalOpen(false)}
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
              Recurring Message Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="e.g., Daily team check-in reminder!"
              rows={3}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white resize-none"
            />
          </div>

          {/* Frequency & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white capitalize"
              >
                <option value="daily">Daily 📅</option>
                <option value="weekly">Weekly 🗓️</option>
                <option value="monthly">Monthly 🗓️</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                Time of Day
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Start Date & Timezone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
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
                {!COMMON_TIMEZONES.includes(selectedTimezone) && (
                  <option value={selectedTimezone}>{selectedTimezone} (Local)</option>
                )}
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* End Rule */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
              End Condition
            </label>

            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2 text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="endRule"
                  value="never"
                  checked={endRule === 'never'}
                  onChange={() => setEndRule('never')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                Never (Runs indefinitely)
              </label>

              <label className="flex items-center gap-2 text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="endRule"
                  value="custom_date"
                  checked={endRule === 'custom_date'}
                  onChange={() => setEndRule('custom_date')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                End on specific date
              </label>
              {endRule === 'custom_date' && (
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="ml-6 px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              )}

              <label className="flex items-center gap-2 text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="endRule"
                  value="occurrences"
                  checked={endRule === 'occurrences'}
                  onChange={() => setEndRule('occurrences')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                End after number of occurrences
              </label>
              {endRule === 'occurrences' && (
                <div className="ml-6 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={maxOccurrences}
                    onChange={(e) => setMaxOccurrences(Number(e.target.value))}
                    className="w-20 px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                  <span>times</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setRecurringModalOpen(false);
                setRecurringListOpen(true);
              }}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              View Active Schedules ({'->'})
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRecurringModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || friendUsers.length === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Repeat className="w-4 h-4" />}
                Create Schedule
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
