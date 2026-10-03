import React, { useRef, useEffect, useState } from 'react';
import {
  Check,
  CheckCheck,
  Clock,
  Reply,
  Share2,
  Copy,
  Star,
  Trash2,
  Flag,
  Play,
  Pause,
  Download,
  FileText,
  ExternalLink,
  Smile,
  MoreHorizontal,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { Message } from '../types';
import { api } from '../services/api';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export const MessageArea: React.FC = () => {
  const { currentUser, settings } = useAuth();
  const {
    activeConversation,
    messages,
    loadingMessages,
    searchInChatQuery,
    setReplyingToMessage,
    toggleReaction,
    toggleStar,
    deleteMessage,
    setForwardModalMessage,
    setLightboxMedia,
    selectedMessageIds,
    toggleSelectMessage,
    setSelectedMessageIds,
  } = useChat();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeMessageMenuId, setActiveMessageMenuId] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioPlaybackRates, setAudioPlaybackRates] = useState<Record<string, number>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  if (!currentUser) return null;

  // Filter search in chat
  const filteredMessages = messages.filter((m) => {
    if (!searchInChatQuery.trim()) return true;
    return m.text.toLowerCase().includes(searchInChatQuery.toLowerCase());
  });

  // Group messages by date
  const groupedMessages: { dateLabel: string; msgs: Message[] }[] = [];
  filteredMessages.forEach((msg) => {
    const d = new Date(msg.createdAt);
    const dateLabel = d.toLocaleDateString([], {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const existingGroup = groupedMessages.find((g) => g.dateLabel === dateLabel);
    if (existingGroup) {
      existingGroup.msgs.push(msg);
    } else {
      groupedMessages.push({ dateLabel, msgs: [msg] });
    }
  });

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setActiveMessageMenuId(null);
  };

  const handleReport = async (msgId: string) => {
    const reason = prompt('Reason for reporting this message:', 'Inappropriate content');
    if (reason) {
      await api.reportMessage(msgId, reason);
      alert('Message reported to administrators.');
    }
    setActiveMessageMenuId(null);
  };

  const scrollToOriginalMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-emerald-500', 'transition-all');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-emerald-500');
      }, 2000);
    }
  };

  const toggleAudioPlay = (msgId: string, url: string) => {
    if (playingAudioId === msgId) {
      audioRefs.current[msgId]?.pause();
      setPlayingAudioId(null);
    } else {
      if (playingAudioId && audioRefs.current[playingAudioId]) {
        audioRefs.current[playingAudioId].pause();
      }
      if (!audioRefs.current[msgId]) {
        const audio = new Audio(url);
        audio.onended = () => setPlayingAudioId(null);
        audioRefs.current[msgId] = audio;
      }
      const rate = audioPlaybackRates[msgId] || 1;
      audioRefs.current[msgId].playbackRate = rate;
      audioRefs.current[msgId].play();
      setPlayingAudioId(msgId);
    }
  };

  const cycleAudioRate = (msgId: string) => {
    const currentRate = audioPlaybackRates[msgId] || 1;
    const rates = [1, 1.5, 2];
    const nextRate = rates[(rates.indexOf(currentRate) + 1) % rates.length];
    setAudioPlaybackRates((prev) => ({ ...prev, [msgId]: nextRate }));
    if (audioRefs.current[msgId]) {
      audioRefs.current[msgId].playbackRate = nextRate;
    }
  };

  // Dynamic Wallpaper styles
  const getWallpaperClass = () => {
    switch (settings.wallpaper) {
      case 'dark':
        return 'bg-slate-950 text-slate-100';
      case 'emerald':
        return 'bg-emerald-950/20 dark:bg-emerald-950/40';
      case 'sunset':
        return 'bg-gradient-to-br from-amber-50/50 via-rose-50/30 to-indigo-50/40 dark:from-slate-950 dark:to-slate-900';
      case 'lavender':
        return 'bg-violet-50/50 dark:bg-slate-950';
      case 'solid':
        return 'bg-slate-100 dark:bg-slate-900';
      case 'doodle':
      default:
        return 'bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] bg-slate-50 dark:bg-slate-950';
    }
  };

  return (
    <div
      ref={scrollRef}
      className={`flex-1 overflow-y-auto p-4 space-y-4 relative ${getWallpaperClass()} ${
        settings.fontSize === 'sm' ? 'text-xs' : settings.fontSize === 'lg' ? 'text-base' : 'text-sm'
      }`}
    >
      {/* Bulk Action Header Bar if multiple messages selected */}
      {selectedMessageIds.length > 0 && (
        <div className="sticky top-0 z-40 bg-emerald-600 text-white p-2.5 rounded-xl shadow-lg flex items-center justify-between animate-fade-in">
          <span className="font-semibold text-xs">
            {selectedMessageIds.length} message(s) selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const firstMsg = messages.find((m) => selectedMessageIds.includes(m.id));
                if (firstMsg) setForwardModalMessage(firstMsg);
              }}
              className="p-1.5 hover:bg-emerald-700 rounded-lg text-xs flex items-center gap-1"
            >
              <Share2 className="w-3.5 h-3.5" /> Forward
            </button>
            <button
              onClick={() => {
                selectedMessageIds.forEach((id) => deleteMessage(id, 'for_me'));
                setSelectedMessageIds([]);
              }}
              className="p-1.5 hover:bg-emerald-700 rounded-lg text-xs flex items-center gap-1 text-rose-200 hover:text-white"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
            <button
              onClick={() => setSelectedMessageIds([])}
              className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 rounded-lg text-xs font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loadingMessages ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
        </div>
      ) : groupedMessages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 py-12">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
            <Smile className="w-8 h-8" />
          </div>
          <p className="font-medium text-slate-700 dark:text-slate-300">
            No messages yet
          </p>
          <p className="text-xs text-slate-400 max-w-xs mt-1">
            Send a message to start the conversation! Encrypted and secure.
          </p>
        </div>
      ) : (
        groupedMessages.map((group) => (
          <div key={group.dateLabel} className="space-y-3">
            {/* Date Separator Pill */}
            <div className="flex justify-center my-3">
              <span className="px-3 py-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-500 dark:text-slate-400 text-[11px] font-medium rounded-full shadow-xs border border-slate-200/50 dark:border-slate-700/50">
                {group.dateLabel}
              </span>
            </div>

            {Array.from(new Map(group.msgs.map((m) => [m.id, m])).values()).map((msg) => {
              const isMe = msg.senderId === currentUser.id;
              const isSelected = selectedMessageIds.includes(msg.id);
              const isStarred = msg.starredBy?.includes(currentUser.id);

              if (msg.type === 'system') {
                return (
                  <div key={msg.id} className="flex justify-center my-2">
                    <span className="px-3 py-1 bg-amber-500/10 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-xs rounded-lg border border-amber-500/20 max-w-md text-center">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  id={`msg-${msg.id}`}
                  key={msg.id}
                  className={`group relative flex items-start gap-2 ${
                    isMe ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* Select Checkbox */}
                  <div className="pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectMessage(msg.id)}
                      className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                    />
                  </div>

                  {/* Message Bubble Container */}
                  <div className={`relative max-w-[85%] md:max-w-[70%] space-y-1`}>
                    {/* Hover Reaction Toolbar */}
                    <div
                      className={`absolute -top-7 ${
                        isMe ? 'right-0' : 'left-0'
                      } hidden group-hover:flex items-center gap-1 bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 rounded-full px-2 py-0.5 z-30 animate-fade-in`}
                    >
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(msg.id, emoji)}
                          className="hover:scale-125 transition-transform text-xs p-0.5"
                        >
                          {emoji}
                        </button>
                      ))}
                      <button
                        onClick={() => setReplyingToMessage(msg)}
                        className="p-1 text-slate-500 hover:text-emerald-500 text-xs ml-1 border-l border-slate-200 dark:border-slate-700 pl-1.5"
                        title="Reply"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Sender Name in Group Chat */}
                    {!isMe && activeConversation.type === 'group' && (
                      <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 px-1 truncate">
                        {msg.senderName}
                      </p>
                    )}

                    {/* Main Bubble */}
                    <div
                      className={`relative rounded-2xl px-3.5 py-2 shadow-xs transition-colors ${
                        isMe
                          ? 'bg-emerald-600 text-white rounded-tr-none dark:bg-emerald-600'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-tl-none'
                      }`}
                    >
                      {/* Quoted Reply Box */}
                      {msg.replyToPreview && (
                        <div
                          onClick={() =>
                            msg.replyToMessageId &&
                            scrollToOriginalMessage(msg.replyToMessageId)
                          }
                          className={`mb-2 p-2 rounded-lg border-l-4 text-xs cursor-pointer ${
                            isMe
                              ? 'bg-emerald-700/60 border-white/80 text-emerald-100'
                              : 'bg-slate-100 dark:bg-slate-700/60 border-emerald-500 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <p className="font-semibold text-[11px] truncate">
                            {msg.replyToPreview.senderName}
                          </p>
                          <p className="truncate opacity-90">{msg.replyToPreview.text}</p>
                        </div>
                      )}

                      {/* Image Content */}
                      {msg.type === 'image' && msg.mediaUrl && (
                        <div
                          onClick={() =>
                            setLightboxMedia({
                              url: msg.mediaUrl!,
                              type: 'image',
                              name: msg.mediaName,
                            })
                          }
                          className="mb-2 rounded-xl overflow-hidden max-w-sm cursor-pointer group/img relative"
                        >
                          <img
                            src={msg.mediaUrl}
                            alt={msg.mediaName || 'Photo'}
                            className="w-full max-h-72 object-cover rounded-xl group-hover/img:scale-105 transition-transform"
                          />
                        </div>
                      )}

                      {/* Video Content */}
                      {msg.type === 'video' && msg.mediaUrl && (
                        <div className="mb-2 rounded-xl overflow-hidden max-w-sm">
                          <video
                            src={msg.mediaUrl}
                            controls
                            className="w-full max-h-72 rounded-xl"
                          />
                        </div>
                      )}

                      {/* Audio Voice Note Player */}
                      {msg.type === 'audio' && msg.mediaUrl && (
                        <div
                          className={`flex items-center gap-3 p-2 rounded-xl mb-1 min-w-56 ${
                            isMe
                              ? 'bg-emerald-700/50 text-white'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          <button
                            onClick={() => toggleAudioPlay(msg.id, msg.mediaUrl!)}
                            className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow hover:scale-105 transition"
                          >
                            {playingAudioId === msg.id ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4 ml-0.5" />
                            )}
                          </button>

                          {/* Waveform indicator */}
                          <div className="flex-1 flex items-center gap-0.5 h-6">
                            {[40, 70, 30, 90, 60, 100, 50, 80, 40, 60, 90, 30, 70, 50].map(
                              (h, idx) => (
                                <span
                                  key={idx}
                                  className={`w-1 rounded-full transition-all ${
                                    playingAudioId === msg.id
                                      ? 'bg-emerald-400 animate-pulse'
                                      : 'bg-slate-400/50'
                                  }`}
                                  style={{ height: `${h}%` }}
                                />
                              )
                            )}
                          </div>

                          <span className="text-[10px] font-mono shrink-0">
                            {msg.duration || 0}s
                          </span>

                          <button
                            onClick={() => cycleAudioRate(msg.id)}
                            className="px-1.5 py-0.5 bg-black/20 rounded text-[10px] font-bold"
                          >
                            {audioPlaybackRates[msg.id] || 1}x
                          </button>
                        </div>
                      )}

                      {/* File / Document Content */}
                      {msg.type === 'file' && msg.mediaUrl && (
                        <div
                          className={`flex items-center gap-3 p-2.5 rounded-xl mb-2 ${
                            isMe
                              ? 'bg-emerald-700/50 text-white'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          <FileText className="w-8 h-8 text-emerald-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-xs truncate">
                              {msg.mediaName || 'Document'}
                            </p>
                            <p className="text-[10px] opacity-80">
                              {msg.mediaSize
                                ? (msg.mediaSize / 1024).toFixed(1) + ' KB'
                                : 'File'}
                            </p>
                          </div>
                          <a
                            href={msg.mediaUrl}
                            download={msg.mediaName || 'file'}
                            className="p-2 hover:bg-black/20 rounded-lg transition shrink-0"
                            title="Download File"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      )}

                      {/* Main Message Text */}
                      {msg.text && (
                        <p className="whitespace-pre-wrap break-words leading-relaxed">
                          {msg.text}
                        </p>
                      )}

                      {/* Link Preview Card */}
                      {msg.linkPreview && (
                        <a
                          href={msg.linkPreview.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`mt-2 block p-2 rounded-xl border overflow-hidden transition-all ${
                            isMe
                              ? 'bg-emerald-700/40 border-emerald-400/30 hover:bg-emerald-700/60'
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {msg.linkPreview.image && (
                            <img
                              src={msg.linkPreview.image}
                              alt={msg.linkPreview.title}
                              className="w-full h-28 object-cover rounded-lg mb-1.5"
                            />
                          )}
                          <div className="flex items-center gap-1 font-semibold text-xs truncate text-emerald-400">
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{msg.linkPreview.title}</span>
                          </div>
                          <p className="text-[11px] line-clamp-2 opacity-80 mt-0.5">
                            {msg.linkPreview.description}
                          </p>
                          <span className="text-[10px] text-slate-400 block mt-1 uppercase tracking-wider font-mono">
                            {msg.linkPreview.domain}
                          </span>
                        </a>
                      )}

                      {/* Reactions Pill Display */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5 pt-1 border-t border-black/10 dark:border-white/10">
                          {Object.entries(msg.reactions).map(([emoji, userIds]) => (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(msg.id, emoji)}
                              className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1 shadow-xs transition ${
                                userIds.includes(currentUser.id)
                                  ? 'bg-emerald-500 text-white ring-1 ring-white'
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span>{userIds.length}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Message Footer: Star, Timestamp & Delivery Checks */}
                      <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-75">
                        {isStarred && <Star className="w-3 h-3 text-amber-300 fill-amber-300" />}
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isMe && (
                          <span className="ml-0.5">
                            {msg.status === 'sending' ? (
                              <Clock className="w-3 h-3 animate-spin" />
                            ) : msg.status === 'read' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                            ) : msg.status === 'delivered' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-white/80" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-white/80" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Message Dropdown Action Button */}
                    <div className="relative inline-block">
                      <button
                        onClick={() =>
                          setActiveMessageMenuId(
                            activeMessageMenuId === msg.id ? null : msg.id
                          )
                        }
                        className="p-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>

                      {activeMessageMenuId === msg.id && (
                        <div
                          className={`absolute ${
                            isMe ? 'right-0' : 'left-0'
                          } top-6 bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 z-50 text-xs w-40`}
                          onClick={() => setActiveMessageMenuId(null)}
                        >
                          <button
                            onClick={() => setReplyingToMessage(msg)}
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                          >
                            <Reply className="w-3.5 h-3.5 text-emerald-500" /> Reply
                          </button>
                          <button
                            onClick={() => setForwardModalMessage(msg)}
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                          >
                            <Share2 className="w-3.5 h-3.5 text-sky-500" /> Forward
                          </button>
                          {msg.text && (
                            <button
                              onClick={() => handleCopyText(msg.text)}
                              className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                            >
                              <Copy className="w-3.5 h-3.5 text-violet-500" /> Copy Text
                            </button>
                          )}
                          <button
                            onClick={() => toggleStar(msg.id)}
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                          >
                            <Star className="w-3.5 h-3.5 text-amber-500" />
                            {isStarred ? 'Unstar' : 'Star Message'}
                          </button>
                          <button
                            onClick={() => deleteMessage(msg.id, 'for_me')}
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete for Me
                          </button>
                          {isMe && (
                            <button
                              onClick={() => deleteMessage(msg.id, 'for_everyone')}
                              className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-rose-600 font-medium"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete for Everyone
                            </button>
                          )}
                          {!isMe && (
                            <button
                              onClick={() => handleReport(msg.id)}
                              className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 text-amber-600"
                            >
                              <Flag className="w-3.5 h-3.5" /> Report Message
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
};
