import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Sparkles,
  Smile,
  Users,
  Send,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Heart,
} from 'lucide-react';

const QUICK_EMOJIS = ['❤️', '👍', '🔥', '😂', '😮', '😢', '🎉', '👏'];
const EXTENDED_EMOJIS = [
  '❤️', '👍', '🔥', '😂', '😮', '😢', '🎉', '👏',
  '😍', '🙌', '💯', '🚀', '🥰', '🤩', '💩', '🥳', '😎', '🙏'
];

export const StatusViewerModal: React.FC = () => {
  const { currentUser } = useAuth();
  const {
    statuses,
    statusViewerOpen,
    setStatusViewerOpen,
    viewingStatusIndex,
    setViewingStatusIndex,
    deleteStatus,
    reactToStatus,
    sendDirectStatusReply,
    setActiveConversationId,
    fetchStatusDetails,
  } = useChat();

  const [isPlayingAudio, setIsPlayingAudio] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  // Reaction & Reply UI states
  const [isPaused, setIsPaused] = useState(false);
  const [showMoreEmojis, setShowMoreEmojis] = useState(false);
  const [showReactionsModal, setShowReactionsModal] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [sentFeedback, setSentFeedback] = useState<{
    show: boolean;
    convId?: string;
    userName: string;
    message: string;
  } | null>(null);
  const [flyingEmoji, setFlyingEmoji] = useState<{ emoji: string; id: number } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressTimerRef = useRef<any>(null);
  const replyInputRef = useRef<HTMLInputElement | null>(null);

  const currentStatus = statuses[viewingStatusIndex];

  // Fetch complete details (reactions list) when viewing a status
  useEffect(() => {
    if (statusViewerOpen && currentStatus?.id) {
      fetchStatusDetails(currentStatus.id);
    }
  }, [statusViewerOpen, currentStatus?.id, fetchStatusDetails]);

  // Auto-progress story
  useEffect(() => {
    if (!statusViewerOpen || !currentStatus) return;

    if (isPaused || showMoreEmojis || showReactionsModal || isSendingReply || replyText.trim().length > 0) {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      return;
    }

    setProgress(0);
    setIsPlayingAudio(true);

    const storyDurationSeconds = currentStatus.duration || (currentStatus.type === 'text' ? 6 : 8);
    const stepIntervalMs = 50;
    const totalSteps = (storyDurationSeconds * 1000) / stepIntervalMs;

    let step = 0;
    progressTimerRef.current = setInterval(() => {
      step++;
      const currentPct = (step / totalSteps) * 100;
      setProgress(currentPct);

      if (currentPct >= 100) {
        clearInterval(progressTimerRef.current);
        handleNext();
      }
    }, stepIntervalMs);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [statusViewerOpen, viewingStatusIndex, currentStatus, isPaused, showMoreEmojis, showReactionsModal, isSendingReply, replyText]);

  if (!statusViewerOpen || !currentStatus || !currentUser) return null;

  const isOwner = currentStatus.userId === currentUser.id;
  const isAdmin = currentUser.role === 'admin';

  const handleNext = () => {
    setShowMoreEmojis(false);
    setShowReactionsModal(false);
    setReplyText('');
    if (viewingStatusIndex < statuses.length - 1) {
      setViewingStatusIndex(viewingStatusIndex + 1);
    } else {
      setStatusViewerOpen(false);
    }
  };

  const handlePrev = () => {
    setShowMoreEmojis(false);
    setShowReactionsModal(false);
    setReplyText('');
    if (viewingStatusIndex > 0) {
      setViewingStatusIndex(viewingStatusIndex - 1);
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this story?')) {
      try {
        await deleteStatus(currentStatus.id);
        if (statuses.length <= 1) {
          setStatusViewerOpen(false);
        } else if (viewingStatusIndex >= statuses.length - 1) {
          setViewingStatusIndex(Math.max(0, viewingStatusIndex - 1));
        }
      } catch (err: any) {
        alert(err.message || 'Failed to delete status.');
      }
    }
  };

  const handleReact = async (emoji: string) => {
    if (!currentStatus) return;
    setFlyingEmoji({ emoji, id: Date.now() });
    setTimeout(() => setFlyingEmoji(null), 1000);

    try {
      await reactToStatus(currentStatus.id, emoji);
    } catch (err) {
      console.error('Failed to react to status:', err);
    }
  };

  const handleSendDirectReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!replyText.trim() || isSendingReply || !currentStatus || isOwner) return;

    const textToSend = replyText.trim();
    setIsSendingReply(true);

    try {
      const res = await sendDirectStatusReply(currentStatus, textToSend);
      if (res.success) {
        setReplyText('');
        setSentFeedback({
          show: true,
          convId: res.conversationId,
          userName: currentStatus.userName,
          message: textToSend,
        });

        // Hide feedback banner after 5 seconds
        setTimeout(() => {
          setSentFeedback((prev) => (prev?.message === textToSend ? null : prev));
        }, 5000);
      } else {
        alert(res.error || 'Failed to send reply to user');
      }
    } catch (err: any) {
      console.error('Failed to send status reply:', err);
      alert(err.message || 'Failed to send reply');
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleOpenConversation = (convId?: string) => {
    setStatusViewerOpen(false);
    if (convId) {
      setActiveConversationId(convId);
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Reactions calculations for THIS status only
  const reactionsMap = currentStatus.reactions || {};
  const activeEmojis = Object.keys(reactionsMap);
  const totalReactions = activeEmojis.reduce((acc, emoji) => acc + (reactionsMap[emoji]?.length || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md h-full sm:h-[90vh] sm:rounded-3xl bg-gray-950 overflow-hidden flex flex-col justify-between shadow-2xl border border-gray-800">
        
        {/* Story Top Header Bar */}
        <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent space-y-3">
          {/* Progress Bars */}
          <div className="flex gap-1.5 w-full">
            {statuses.map((s, idx) => (
              <div key={s.id} className="h-1 bg-white/30 rounded-full flex-1 overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-75"
                  style={{
                    width:
                      idx < viewingStatusIndex
                        ? '100%'
                        : idx === viewingStatusIndex
                        ? `${progress}%`
                        : '0%',
                  }}
                />
              </div>
            ))}
          </div>

          {/* User Info Header */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <img
                src={currentStatus.userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={currentStatus.userName}
                className="w-10 h-10 rounded-full object-cover border-2 border-white/80 shrink-0"
              />
              <div>
                <div className="flex items-center gap-1 font-semibold text-sm leading-tight">
                  <span className="truncate max-w-[160px]">{currentStatus.userName}</span>
                  {currentStatus.userIsVerified && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 fill-blue-400/20" aria-label="Verified Account" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white/70">
                  {currentStatus.userUsername && (
                    <span>@{currentStatus.userUsername}</span>
                  )}
                  {currentStatus.userUsername && <span>•</span>}
                  <span>{getTimeAgo(currentStatus.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {(isOwner || isAdmin) && (
                <button
                  onClick={handleDelete}
                  className="p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-full transition-colors"
                  title="Delete Story"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setStatusViewerOpen(false)}
                className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* FEEDBACK TOAST: Direct Reply Sent */}
        {sentFeedback?.show && (
          <div className="absolute top-20 left-4 right-4 z-40 bg-emerald-950/95 border border-emerald-500/50 backdrop-blur-xl text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-top-4 duration-200">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                <Send className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-emerald-200">Reply Sent Directly!</div>
                <div className="text-[11px] text-slate-300 truncate">
                  Sent to <span className="font-semibold text-white">{sentFeedback.userName}</span> in chat
                </div>
              </div>
            </div>
            <button
              onClick={() => handleOpenConversation(sentFeedback.convId)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1 shrink-0 transition-colors shadow-sm"
            >
              <span>Open Chat</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* STORY CONTENT AREA */}
        <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden">
          {/* Previous / Next tap areas */}
          <button
            onClick={handlePrev}
            disabled={viewingStatusIndex === 0}
            className="absolute left-3 z-10 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full disabled:opacity-0 transition-opacity"
            title="Previous status"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-3 z-10 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-opacity"
            title="Next status"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Flying Emoji Animation */}
          {flyingEmoji && (
            <div
              key={flyingEmoji.id}
              className="absolute inset-0 pointer-events-none flex items-center justify-center z-50 animate-bounce"
            >
              <span className="text-8xl drop-shadow-2xl transition-all duration-700 transform scale-150 opacity-90">
                {flyingEmoji.emoji}
              </span>
            </div>
          )}

          {/* TEXT STORY */}
          {currentStatus.type === 'text' && (
            <div
              className={`w-full h-full rounded-2xl bg-gradient-to-br ${currentStatus.bgColor || 'from-indigo-600 to-purple-700'} flex items-center justify-center p-8 text-center text-white shadow-2xl`}
            >
              <p className="text-2xl sm:text-3xl font-bold leading-relaxed drop-shadow-md break-words max-w-full">
                {currentStatus.content}
              </p>
            </div>
          )}

          {/* IMAGE STORY */}
          {currentStatus.type === 'image' && (
            <div className="relative w-full h-full flex flex-col items-center justify-center">
              <img
                src={currentStatus.content}
                alt="Story"
                className="w-full h-full object-contain rounded-xl"
              />
              {currentStatus.caption && (
                <div className="absolute bottom-20 left-4 right-4 p-3 bg-black/70 backdrop-blur-md rounded-xl text-center text-white text-sm font-medium z-10">
                  {currentStatus.caption}
                </div>
              )}
            </div>
          )}

          {/* AUDIO STORY */}
          {currentStatus.type === 'audio' && (
            <div className="w-full h-full rounded-2xl bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-950 flex flex-col items-center justify-center p-8 text-center text-white shadow-2xl gap-6">
              <div className="w-24 h-24 rounded-full bg-indigo-600/30 border-4 border-indigo-400 flex items-center justify-center animate-pulse">
                <Sparkles className="w-12 h-12 text-indigo-300" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">Voice Status</h3>
                <p className="text-xs text-indigo-200">Duration: {currentStatus.duration || 10} seconds</p>
              </div>

              <audio
                ref={audioRef}
                src={currentStatus.content}
                autoPlay
                className="hidden"
                onEnded={handleNext}
              />

              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    if (audioRef.current) {
                      if (isPlayingAudio) {
                        audioRef.current.pause();
                        setIsPlayingAudio(false);
                      } else {
                        audioRef.current.play();
                        setIsPlayingAudio(true);
                      }
                    }
                  }}
                  className="p-4 bg-indigo-600 hover:bg-indigo-500 rounded-full text-white shadow-lg transition-transform hover:scale-105"
                >
                  {isPlayingAudio ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                </button>
              </div>
            </div>
          )}

          {/* VIDEO STORY */}
          {currentStatus.type === 'video' && (
            <div className="relative w-full h-full flex flex-col items-center justify-center bg-black">
              <video
                ref={videoRef}
                src={currentStatus.content}
                autoPlay
                muted={isMuted}
                playsInline
                className="w-full h-full object-contain"
                onEnded={handleNext}
              />
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="absolute top-20 right-4 p-2.5 bg-black/60 backdrop-blur-md text-white rounded-full hover:bg-black/80 transition-colors z-10"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              {currentStatus.caption && (
                <div className="absolute bottom-20 left-4 right-4 p-3 bg-black/70 backdrop-blur-md rounded-xl text-center text-white text-sm font-medium z-10">
                  {currentStatus.caption}
                </div>
              )}
            </div>
          )}
        </div>

        {/* BOTTOM SECTION: DIRECT REPLY BAR & EMOJI REACTIONS */}
        <div
          className="relative z-30 p-3 bg-gradient-to-t from-black/95 via-black/85 to-transparent flex flex-col gap-2.5"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => {
            if (!replyText && !showMoreEmojis && !showReactionsModal) {
              setIsPaused(false);
            }
          }}
        >
          {/* Extended Emoji Grid Popover */}
          {showMoreEmojis && (
            <div className="absolute bottom-full left-3 right-3 mb-2 p-3 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl grid grid-cols-6 gap-2 animate-in slide-in-from-bottom-2 duration-150">
              {EXTENDED_EMOJIS.map((emoji) => {
                const userHasReacted = reactionsMap[emoji]?.includes(currentUser.id);
                return (
                  <button
                    key={emoji}
                    onClick={() => {
                      handleReact(emoji);
                      setShowMoreEmojis(false);
                    }}
                    className={`p-2 rounded-xl text-xl hover:bg-white/20 hover:scale-125 transition-all flex items-center justify-center ${
                      userHasReacted ? 'bg-indigo-600/40 border border-indigo-400 scale-110' : ''
                    }`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          )}

          {/* Quick Reaction Emojis & Stats Row */}
          <div className="flex items-center justify-between gap-1 px-1">
            {/* Quick Reactions Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              {QUICK_EMOJIS.slice(0, 6).map((emoji) => {
                const userHasReacted = reactionsMap[emoji]?.includes(currentUser.id);
                const count = reactionsMap[emoji]?.length || 0;

                return (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className={`relative p-1.5 rounded-full transition-all duration-150 hover:scale-125 active:scale-95 flex items-center justify-center ${
                      userHasReacted
                        ? 'bg-indigo-500/40 border border-indigo-400 scale-110'
                        : 'bg-white/10 hover:bg-white/20'
                    }`}
                    title={`React with ${emoji}`}
                  >
                    <span className="text-base leading-none">{emoji}</span>
                    {count > 0 && (
                      <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-indigo-600 text-white px-1 rounded-full border border-black min-w-[12px] h-[12px] flex items-center justify-center">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}

              <button
                onClick={() => {
                  setShowMoreEmojis(!showMoreEmojis);
                  setShowReactionsModal(false);
                }}
                className={`p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors ${
                  showMoreEmojis ? 'bg-indigo-600 text-white' : 'bg-white/10'
                }`}
                title="More Emojis"
              >
                <Smile className="w-4 h-4" />
              </button>
            </div>

            {/* Reactions Summary Pill */}
            {totalReactions > 0 && (
              <button
                onClick={() => {
                  setShowReactionsModal(true);
                  setShowMoreEmojis(false);
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-xs text-white/90 font-medium transition-all shrink-0"
              >
                <Heart className="w-3 h-3 text-red-400 fill-red-400" />
                <span>{totalReactions}</span>
              </button>
            )}
          </div>

          {/* MAIN DIRECT REPLY INPUT (OR OWNER ACTIONS) */}
          {!isOwner ? (
            <form
              onSubmit={handleSendDirectReply}
              className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-xl border border-slate-700/70 rounded-2xl p-1.5 shadow-xl"
            >
              <input
                ref={replyInputRef}
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={() => setIsPaused(true)}
                onBlur={() => {
                  if (!replyText) setIsPaused(false);
                }}
                placeholder={`Reply to ${currentStatus.userName}...`}
                className="flex-1 bg-transparent px-3 py-2 text-white placeholder-slate-400 text-xs font-medium focus:outline-none"
                maxLength={500}
              />
              <button
                type="submit"
                disabled={!replyText.trim() || isSendingReply}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 shadow-md"
                title="Send Direct Reply"
              >
                {isSendingReply ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Reply</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 rounded-2xl p-2.5 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-full font-medium text-[11px]">
                  Your Story
                </span>
                <span>{totalReactions} total {totalReactions === 1 ? 'reaction' : 'reactions'}</span>
              </div>
              <button
                onClick={() => setShowReactionsModal(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline-offset-2 hover:underline"
              >
                View Details
              </button>
            </div>
          )}
        </div>

        {/* REACTIONS DETAILS DRAWER / MODAL */}
        {showReactionsModal && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200">
            <div className="bg-gray-900 border-t border-gray-800 rounded-t-3xl max-h-[70%] p-4 flex flex-col gap-3 shadow-2xl">
              <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <span>Story Reactions ({totalReactions})</span>
                </div>
                <button
                  onClick={() => setShowReactionsModal(false)}
                  className="p-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Reactions list */}
              <div className="overflow-y-auto space-y-2.5 max-h-[300px] pr-1">
                {activeEmojis.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm">No reactions yet</div>
                ) : (
                  activeEmojis.map((emoji) => {
                    // Match reactions from reactionsList or reactions map
                    const rxForEmoji = (currentStatus.reactionsList || []).filter((r) => r.emoji === emoji);
                    const userIds = reactionsMap[emoji] || [];

                    return (
                      <div key={emoji} className="bg-gray-800/60 rounded-xl p-2.5 space-y-2 border border-gray-700/50">
                        <div className="flex items-center gap-2 text-sm font-semibold text-indigo-300">
                          <span className="text-lg">{emoji}</span>
                          <span>{userIds.length}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2 pl-2">
                          {userIds.map((uId) => {
                            const rxItem = rxForEmoji.find((r) => r.userId === uId);
                            const name = rxItem?.userName || (uId === currentUser.id ? 'You' : 'User');
                            const avatar = rxItem?.userAvatar || (uId === currentUser.id ? currentUser.avatar : '');
                            const username = rxItem?.userUsername;
                            const isVerified = rxItem?.userIsVerified;

                            return (
                              <div key={uId} className="flex items-center justify-between text-xs text-gray-200">
                                <div className="flex items-center gap-2">
                                  <img
                                    src={avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                    alt={name}
                                    className="w-6 h-6 rounded-full object-cover border border-gray-600"
                                  />
                                  <span className="font-medium text-white">{name}</span>
                                  {isVerified && (
                                    <CheckCircle2 className="w-3 h-3 text-blue-400 fill-blue-400/20 shrink-0" />
                                  )}
                                  {username && (
                                    <span className="text-slate-400 text-[11px]">@{username}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
