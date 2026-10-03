import React, { useState, useRef, useEffect } from 'react';
import {
  Smile,
  Paperclip,
  Send,
  Mic,
  X,
  Image as ImageIcon,
  FileText,
  Trash2,
  Square,
  Sparkles,
  Clock,
  Repeat,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { EmojiPicker } from './EmojiPicker';
import { api } from '../services/api';

export const MessageComposer: React.FC = () => {
  const { settings } = useAuth();
  const {
    activeConversationId,
    replyingToMessage,
    setReplyingToMessage,
    sendMessage,
    startTyping,
    stopTyping,
    setScheduleModalOpen,
    setRecurringModalOpen,
  } = useChat();

  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Audio Voice Recorder state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Draft message per conversation handling & typing cleanup on conversation switch
  useEffect(() => {
    if (activeConversationId) {
      const savedDraft = sessionStorage.getItem(`draft_${activeConversationId}`) || '';
      setText(savedDraft);
    }
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      stopTyping();
    };
  }, [activeConversationId]);

  const handleFocus = () => {
    startTyping();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2500);
  };

  const handleBlur = () => {
    if (!text.trim()) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      stopTyping();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    if (activeConversationId) {
      sessionStorage.setItem(`draft_${activeConversationId}`, val);
    }

    startTyping();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2500);
  };

  const handleSendText = async () => {
    if (!text.trim() || !activeConversationId) return;

    const messageText = text.trim();
    setText('');
    if (activeConversationId) {
      sessionStorage.removeItem(`draft_${activeConversationId}`);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    stopTyping();

    await sendMessage({ type: 'text', text: messageText });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (settings.enterToSend && !e.shiftKey) {
        e.preventDefault();
        handleSendText();
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isMedia: boolean) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversationId) return;

    try {
      setIsUploading(true);
      setShowAttachMenu(false);

      const uploaded = await api.uploadFile(file);
      let type = 'file';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';

      await sendMessage({
        type,
        mediaUrl: uploaded.url,
        mediaName: uploaded.name,
        mediaSize: uploaded.size,
        mediaMime: uploaded.mime,
      });
    } catch (err) {
      console.error('File upload failed:', err);
      alert('File upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Voice Recording logic using standard navigator.mediaDevices.getUserMedia
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Audio recording access denied or not supported:', err);
      alert('Microphone access is required to record voice notes.');
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    clearInterval(timerIntervalRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const sendRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    mediaRecorderRef.current.stop();
    clearInterval(timerIntervalRef.current);
    setIsRecording(false);

    setTimeout(async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const file = new File([audioBlob], `voice_${Date.now()}.webm`, {
        type: 'audio/webm',
      });

      try {
        setIsUploading(true);
        const uploaded = await api.uploadFile(file);
        await sendMessage({
          type: 'audio',
          mediaUrl: uploaded.url,
          mediaName: 'Voice note',
          duration: recordingSeconds || 1,
        });
      } catch (err) {
        console.error('Failed to send voice note:', err);
      } finally {
        setIsUploading(false);
        setRecordingSeconds(0);
      }
    }, 200);
  };

  if (!activeConversationId) return null;

  return (
    <div className="p-3 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 relative select-none shrink-0">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={imageInputRef}
        onChange={(e) => handleFileUpload(e, true)}
        accept="image/*,video/*"
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFileUpload(e, false)}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
        className="hidden"
      />

      {/* Quoted Reply Banner */}
      {replyingToMessage && (
        <div className="mb-2 p-2.5 bg-white dark:bg-slate-800 rounded-xl border-l-4 border-emerald-500 shadow-sm flex items-center justify-between text-xs animate-fade-in">
          <div className="truncate min-w-0 pr-2">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 block truncate">
              Replying to {replyingToMessage.senderName}
            </span>
            <span className="text-slate-600 dark:text-slate-300 truncate block">
              {replyingToMessage.text || replyingToMessage.type}
            </span>
          </div>
          <button
            onClick={() => setReplyingToMessage(null)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-3 z-50">
          <EmojiPicker
            onSelect={(emoji) => {
              setText((prev) => prev + emoji);
            }}
            onClose={() => setShowEmojiPicker(false)}
          />
        </div>
      )}

      {/* Attachment Options Popover */}
      {showAttachMenu && (
        <div className="absolute bottom-16 left-12 bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 rounded-2xl p-2 z-50 space-y-1 text-xs w-44 animate-fade-in">
          <button
            onClick={() => {
              imageInputRef.current?.click();
              setShowAttachMenu(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 transition"
          >
            <ImageIcon className="w-4 h-4 text-emerald-500" />
            <span>Photos & Videos</span>
          </button>
          <button
            onClick={() => {
              fileInputRef.current?.click();
              setShowAttachMenu(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 transition"
          >
            <FileText className="w-4 h-4 text-violet-500" />
            <span>Document / File</span>
          </button>
          <button
            onClick={() => {
              setScheduleModalOpen(true);
              setShowAttachMenu(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 transition border-t border-slate-100 dark:border-slate-700 pt-2"
          >
            <Clock className="w-4 h-4 text-blue-500" />
            <span>Schedule Message</span>
          </button>
          <button
            onClick={() => {
              setRecurringModalOpen(true);
              setShowAttachMenu(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 transition"
          >
            <Repeat className="w-4 h-4 text-indigo-500" />
            <span>Recurring Schedule</span>
          </button>
        </div>
      )}

      {/* Voice Recording Overlay Mode */}
      {isRecording ? (
        <div className="flex items-center justify-between bg-rose-500/10 dark:bg-rose-950/40 border border-rose-500/30 px-4 py-2.5 rounded-2xl animate-pulse">
          <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 font-semibold text-xs">
            <span className="w-3 h-3 bg-rose-500 rounded-full animate-ping" />
            <span>Recording voice note...</span>
            <span className="font-mono text-sm">
              {Math.floor(recordingSeconds / 60)
                .toString()
                .padStart(2, '0')}
              :
              {(recordingSeconds % 60).toString().padStart(2, '0')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={cancelRecording}
              className="p-2 text-rose-500 hover:bg-rose-500/20 rounded-full transition"
              title="Cancel Recording"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={sendRecording}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow flex items-center gap-1.5 transition"
            >
              <Square className="w-3.5 h-3.5 fill-white" /> Send Voice
            </button>
          </div>
        </div>
      ) : (
        /* Normal Composer Bar */
        <div className="flex items-center gap-2">
          {/* Emoji Toggle */}
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0"
            title="Emojis"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Attach Toggle */}
          <button
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Textarea Input */}
          <div className="flex-1 relative">
            <textarea
              id="message-composer-textarea"
              value={text}
              onChange={handleTextChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm rounded-2xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none max-h-32 transition-all"
            />
          </div>

          {/* Send or Voice Record Button */}
          {text.trim() ? (
            <button
              onClick={handleSendText}
              disabled={isUploading}
              className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-md hover:scale-105 transition-all shrink-0 disabled:opacity-50"
              title="Send Message"
            >
              <Send className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl transition-all shrink-0"
              title="Record Voice Note"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
