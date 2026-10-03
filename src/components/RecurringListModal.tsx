import React from 'react';
import { useChat } from '../context/ChatContext';
import { X, Repeat, Plus, Trash2, Pause, Play, Calendar, Clock } from 'lucide-react';

export const RecurringListModal: React.FC = () => {
  const {
    recurringSchedules,
    recurringListOpen,
    setRecurringListOpen,
    setRecurringModalOpen,
    updateRecurringScheduleStatus,
    deleteRecurringSchedule,
  } = useChat();

  if (!recurringListOpen) return null;

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    try {
      const action = currentStatus === 'active' ? 'pause' : 'resume';
      await updateRecurringScheduleStatus(id, action);
    } catch (err: any) {
      alert(err.message || 'Failed to update status.');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to cancel and delete this recurring schedule?')) {
      try {
        await deleteRecurringSchedule(id);
      } catch (err: any) {
        alert(err.message || 'Failed to delete schedule.');
      }
    }
  };

  const formatDate = (dateISO?: string, tz?: string) => {
    if (!dateISO) return 'N/A';
    try {
      return new Date(dateISO).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: tz || undefined,
      });
    } catch {
      return dateISO;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Repeat className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Recurring Schedules
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setRecurringListOpen(false);
                setRecurringModalOpen(true);
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Schedule
            </button>
            <button
              onClick={() => setRecurringListOpen(false)}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
          {recurringSchedules.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <Repeat className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto" />
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                No Active Recurring Messages
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                Set up automated daily, weekly, or monthly messages to be sent continuously.
              </p>
            </div>
          ) : (
            recurringSchedules.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200/80 dark:border-gray-700/80 flex items-start justify-between gap-3"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-xs text-indigo-600 dark:text-indigo-400">
                      To: {item.conversationName || 'Chat'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                      {item.frequency} @ {item.time}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        item.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : item.status === 'paused'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                    "{item.content}"
                  </p>

                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      Next run: {formatDate(item.nextRunAt, item.timezone)}
                    </span>
                    <span>
                      Runs completed: <strong>{item.occurrencesCount}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {item.status !== 'cancelled' && (
                    <button
                      onClick={() => handleToggleStatus(item.id, item.status)}
                      className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                      title={item.status === 'active' ? 'Pause schedule' : 'Resume schedule'}
                    >
                      {item.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                    title="Delete schedule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
