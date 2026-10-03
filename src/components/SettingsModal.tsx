import React from 'react';
import { Settings as SettingsIcon, X, Palette, Moon, Sun, Volume2, CornerDownLeft, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';

export const SettingsModal: React.FC = () => {
  const { settings, updateSettings } = useAuth();
  const { settingsModalOpen, setSettingsModalOpen } = useChat();

  if (!settingsModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[85vh] animate-fade-in">
        {/* Header */}
        <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-emerald-500" /> Chat Settings
          </h3>
          <button
            onClick={() => setSettingsModalOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="p-4 space-y-5 flex-1 overflow-y-auto">
          {/* Theme Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-amber-500" /> Theme Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'light', label: 'Light', icon: Sun },
                { id: 'dark', label: 'Dark', icon: Moon },
                { id: 'system', label: 'System', icon: SettingsIcon },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => updateSettings({ theme: t.id as any })}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                    settings.theme === t.id
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <t.icon className="w-4 h-4" /> {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Wallpaper Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-violet-500" /> Chat Wallpaper
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'doodle', label: 'Classic Pattern' },
                { id: 'emerald', label: 'Emerald Glow' },
                { id: 'sunset', label: 'Warm Sunset' },
                { id: 'lavender', label: 'Lavender' },
                { id: 'dark', label: 'Midnight Dark' },
                { id: 'solid', label: 'Solid Neutral' },
              ].map((w) => (
                <button
                  key={w.id}
                  onClick={() => updateSettings({ wallpaper: w.id as any })}
                  className={`p-2 rounded-xl border text-[11px] font-medium transition ${
                    settings.wallpaper === w.id
                      ? 'bg-emerald-500 text-white border-emerald-500 font-bold'
                      : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Text Font Size
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'sm', label: 'Small' },
                { id: 'md', label: 'Medium' },
                { id: 'lg', label: 'Large' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => updateSettings({ fontSize: f.id as any })}
                  className={`p-2 rounded-xl border text-xs font-medium transition ${
                    settings.fontSize === f.id
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preferences Toggles */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <Volume2 className="w-4 h-4 text-emerald-500" /> Message Sounds
              </span>
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => updateSettings({ soundEnabled: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <CornerDownLeft className="w-4 h-4 text-sky-500" /> Enter to Send
              </span>
              <input
                type="checkbox"
                checked={settings.enterToSend}
                onChange={(e) => updateSettings({ enterToSend: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <Download className="w-4 h-4 text-violet-500" /> Media Auto-Download
              </span>
              <input
                type="checkbox"
                checked={settings.mediaAutoDownload}
                onChange={(e) => updateSettings({ mediaAutoDownload: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            onClick={() => setSettingsModalOpen(false)}
            className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold shadow hover:bg-emerald-600 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
