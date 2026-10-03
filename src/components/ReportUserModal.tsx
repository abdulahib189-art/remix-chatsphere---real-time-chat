import React, { useState } from 'react';
import { Flag, X, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { api } from '../services/api';

interface ReportUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUserName: string;
  messageId?: string;
  messageText?: string;
}

const REPORT_REASONS = [
  'Spam',
  'Harassment',
  'Fake account',
  'Hate/abusive content',
  'Scam',
  'Inappropriate content',
  'Other',
];

export const ReportUserModal: React.FC<ReportUserModalProps> = ({
  isOpen,
  onClose,
  targetUserId,
  targetUserName,
  messageId,
  messageText,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('Spam');
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.submitUserReport({
        reportedUserId: targetUserId,
        reason: selectedReason,
        messageId,
        messageText,
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in select-none">
      <div className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
          <div className="flex items-center gap-2 text-red-500 font-bold">
            <Flag className="w-5 h-5" />
            <h3>Report User: {targetUserName}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
            <h4 className="font-bold text-base text-slate-900 dark:text-white">Report Submitted</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Thank you. Our moderation team (Admin) will review this user report and take appropriate action.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Please select the main reason why you are reporting <span className="font-bold text-slate-700 dark:text-slate-300">{targetUserName}</span>:
            </p>

            {/* Reasons list */}
            <div className="space-y-2">
              {REPORT_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center justify-between p-3 rounded-2xl border text-xs font-semibold cursor-pointer transition ${
                    selectedReason === reason
                      ? 'bg-red-500/10 border-red-500/50 text-red-600 dark:text-red-400'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                    <span>{reason}</span>
                  </div>
                  <input
                    type="radio"
                    name="reportReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="accent-red-500"
                  />
                </label>
              ))}
            </div>

            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
