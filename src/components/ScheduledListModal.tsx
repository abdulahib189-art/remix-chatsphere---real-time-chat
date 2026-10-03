import React from 'react';
import { useChat } from '../context/ChatContext';
import { X, Clock, Plus, Trash2, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';

export const ScheduledListModal: React.FC = () => {
  const {
    scheduledMessages,
    scheduledListOpen,
    setScheduledListOpen,
    setScheduleModalOpen,
    cancelScheduledMessage,
  } = useChat();

  if (!scheduledListOpen) return null;

  const handleCancel = async (id: string) => {
    if (confirm('Are you sure you want to cancel this scheduled message?')) {
      try {
        await cancelScheduledMessage(id);
      } catch (err: any) {
        alert(err.message || 'Failed to cancel message.');
      }
    }
  };

  const formatDate = (dateISO: string, tz?: string) => {
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
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Scheduled Messages
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setScheduledListOpen(false);
                setScheduleModalOpen(true);
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Schedule
            </button>
            <button
              onClick={() => setScheduledListOpen(false)}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
          {scheduledMessages.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <Clock className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto" />
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                No Scheduled Messages
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                Schedule messages to be sent automatically at a future time & date.
              </p>
            </div>
          ) : (
            scheduledMessages.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200/80 dark:border-gray-700/80 flex items-start justify-between gap-3"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-indigo-600 dark:text-indigo-400">
                      To: {item.conversationName || 'Chat'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        item.status === 'scheduled'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          : item.status === 'sent'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                    "{item.content}"
                  </p>

                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {formatDate(item.scheduledAt, item.timezone)} ({item.timezone})
                    </span>
                  </div>
                </div>

                {item.status === 'scheduled' && (
                  <button
                    onClick={() => handleCancel(item.id)}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors shrink-0"
                    title="Cancel scheduled message"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
