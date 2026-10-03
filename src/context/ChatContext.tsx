import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Conversation,
  Message,
  FriendRequest,
  WSEvent,
  UserStatus,
  StatusComment,
  StatusReaction,
  ChatStreak,
  ScheduledMessage,
  RecurringSchedule,
} from '../types';
import { api, getCurrentUserId } from '../services/api';
import { wsClient } from '../services/websocket';
import { useAuth } from './AuthContext';

export type FilterTab = 'all' | 'unread' | 'groups' | 'notifications' | 'archived' | 'starred';

interface ChatContextType {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  activeConversationId: string | null;
  messages: Message[];
  loadingMessages: boolean;
  filterTab: FilterTab;
  searchQuery: string;
  searchInChatQuery: string;
  typingUsers: Record<string, { userId: string; userName: string }[]>;
  replyingToMessage: Message | null;
  selectedMessageIds: string[];
  infoPanelOpen: boolean;
  lightboxMedia: { url: string; type: 'image' | 'video'; name?: string } | null;
  forwardModalMessage: Message | null;
  // Friend Requests
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  // Modals
  newChatOpen: boolean;
  addContactOpen: boolean;
  createGroupOpen: boolean;
  profileModalOpen: boolean;
  settingsModalOpen: boolean;
  adminModalOpen: boolean;

  // Feature States & Modals
  statuses: UserStatus[];
  activeStreak: ChatStreak | null;
  scheduledMessages: ScheduledMessage[];
  recurringSchedules: RecurringSchedule[];

  createStatusOpen: boolean;
  statusViewerOpen: boolean;
  viewingStatusIndex: number;
  scheduleModalOpen: boolean;
  scheduledListOpen: boolean;
  recurringModalOpen: boolean;
  recurringListOpen: boolean;

  // Feature Actions
  setCreateStatusOpen: (open: boolean) => void;
  setStatusViewerOpen: (open: boolean) => void;
  setViewingStatusIndex: (idx: number) => void;
  setScheduleModalOpen: (open: boolean) => void;
  setScheduledListOpen: (open: boolean) => void;
  setRecurringModalOpen: (open: boolean) => void;
  setRecurringListOpen: (open: boolean) => void;

  loadStatuses: () => Promise<void>;
  fetchStatusDetails: (statusId: string) => Promise<UserStatus | null>;
  createStatus: (data: {
    type: 'text' | 'image' | 'video' | 'audio';
    content: string;
    caption?: string;
    bgColor?: string;
    duration?: number;
  }) => Promise<void>;
  deleteStatus: (statusId: string) => Promise<void>;
  reactToStatus: (statusId: string, emoji: string) => Promise<void>;
  addStatusComment: (statusId: string, text: string) => Promise<StatusComment | null>;
  deleteStatusComment: (statusId: string, commentId: string) => Promise<void>;
  sendDirectStatusReply: (
    status: UserStatus,
    replyText: string
  ) => Promise<{ success: boolean; conversationId?: string; error?: string }>;

  loadStreak: (conversationId: string) => Promise<void>;

  loadScheduledMessages: () => Promise<void>;
  createScheduledMessage: (data: {
    conversationId: string;
    type?: string;
    content: string;
    mediaUrl?: string;
    mediaName?: string;
    scheduledAt: string;
    timezone?: string;
  }) => Promise<void>;
  cancelScheduledMessage: (id: string) => Promise<void>;

  loadRecurringSchedules: () => Promise<void>;
  createRecurringSchedule: (data: {
    conversationId: string;
    content: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
    startAt: string;
    endRule?: 'never' | 'custom_date' | 'occurrences';
    endAt?: string;
    maxOccurrences?: number;
    timezone?: string;
  }) => Promise<void>;
  updateRecurringScheduleStatus: (id: string, action: 'pause' | 'resume' | 'cancel') => Promise<void>;
  deleteRecurringSchedule: (id: string) => Promise<void>;

  // Actions
  setActiveConversationId: (id: string | null) => void;
  setFilterTab: (tab: FilterTab) => void;
  setSearchQuery: (q: string) => void;
  setSearchInChatQuery: (q: string) => void;
  setReplyingToMessage: (msg: Message | null) => void;
  setSelectedMessageIds: React.Dispatch<React.SetStateAction<string[]>>;
  toggleSelectMessage: (msgId: string) => void;
  setInfoPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLightboxMedia: (media: { url: string; type: 'image' | 'video'; name?: string } | null) => void;
  setForwardModalMessage: (msg: Message | null) => void;
  setNewChatOpen: (open: boolean) => void;
  setAddContactOpen: (open: boolean) => void;
  setCreateGroupOpen: (open: boolean) => void;
  setProfileModalOpen: (open: boolean) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setAdminModalOpen: (open: boolean) => void;

  // Friend Request Actions
  loadFriendRequests: () => Promise<void>;
  sendFriendRequest: (receiverId: string) => Promise<void>;
  respondFriendRequest: (requestId: string, action: 'accept' | 'deny') => Promise<void>;

  // Real-time actions
  loadConversations: () => Promise<void>;
  sendMessage: (payload: {
    type?: string;
    text?: string;
    mediaUrl?: string;
    mediaName?: string;
    mediaSize?: number;
    mediaMime?: string;
    duration?: number;
  }) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  toggleStar: (messageId: string) => Promise<void>;
  deleteMessage: (messageId: string, mode: 'for_me' | 'for_everyone') => Promise<void>;
  forwardMessages: (targetConvIds: string[]) => Promise<void>;
  markConversationAsRead: (convId: string) => Promise<void>;
  startCall: (type: 'audio' | 'video') => void;
  endCall: () => void;
  toggleMuteCall: () => void;
  toggleVideoCall: () => void;
  startTyping: () => void;
  stopTyping: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, settings } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchInChatQuery, setSearchInChatQuery] = useState<string>('');
  const [typingUsers, setTypingUsers] = useState<Record<string, { userId: string; userName: string }[]>>({});
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [infoPanelOpen, setInfoPanelOpen] = useState<boolean>(false);
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; type: 'image' | 'video'; name?: string } | null>(null);
  const [forwardModalMessage, setForwardModalMessage] = useState<Message | null>(null);

  // Friend Requests State
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);

  // Modals
  const [newChatOpen, setNewChatOpen] = useState<boolean>(false);
  const [addContactOpen, setAddContactOpen] = useState<boolean>(false);
  const [createGroupOpen, setCreateGroupOpen] = useState<boolean>(false);
  const [profileModalOpen, setProfileModalOpen] = useState<boolean>(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);
  const [adminModalOpen, setAdminModalOpen] = useState<boolean>(false);

  // New Feature States
  const [statuses, setStatuses] = useState<UserStatus[]>([]);
  const [activeStreak, setActiveStreak] = useState<ChatStreak | null>(null);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [recurringSchedules, setRecurringSchedules] = useState<RecurringSchedule[]>([]);

  // Feature Modal States
  const [createStatusOpen, setCreateStatusOpen] = useState<boolean>(false);
  const [statusViewerOpen, setStatusViewerOpen] = useState<boolean>(false);
  const [viewingStatusIndex, setViewingStatusIndex] = useState<number>(0);
  const [scheduleModalOpen, setScheduleModalOpen] = useState<boolean>(false);
  const [scheduledListOpen, setScheduledListOpen] = useState<boolean>(false);
  const [recurringModalOpen, setRecurringModalOpen] = useState<boolean>(false);
  const [recurringListOpen, setRecurringListOpen] = useState<boolean>(false);

  const loadStatuses = useCallback(async () => {
    try {
      const data = await api.getStatuses();
      setStatuses(data);
    } catch (err) {
      console.error('Failed to load statuses:', err);
    }
  }, []);

  const fetchStatusDetails = useCallback(async (statusId: string): Promise<UserStatus | null> => {
    try {
      const fullStatus = await api.getStatus(statusId);
      if (fullStatus) {
        setStatuses((prev) =>
          prev.map((s) => (s.id === statusId ? { ...s, ...fullStatus } : s))
        );
      }
      return fullStatus;
    } catch (err) {
      console.error('Failed to fetch status details:', err);
      return null;
    }
  }, []);

  const createStatus = async (data: {
    type: 'text' | 'image' | 'video' | 'audio';
    content: string;
    caption?: string;
    bgColor?: string;
    duration?: number;
  }) => {
    await api.createStatus(data);
    await loadStatuses();
  };

  const deleteStatus = async (statusId: string) => {
    await api.deleteStatus(statusId);
    setStatuses((prev) => prev.filter((s) => s.id !== statusId));
  };

  const reactToStatus = async (statusId: string, emoji: string) => {
    try {
      const res = await api.reactToStatus(statusId, emoji);
      if (res && res.reactions) {
        setStatuses((prev) =>
          prev.map((s) =>
            s.id === statusId
              ? {
                  ...s,
                  reactions: res.reactions,
                  reactionsList: res.reactionsList,
                }
              : s
          )
        );
      }
    } catch (err) {
      console.error('Failed to react to status:', err);
      loadStatuses();
    }
  };

  const addStatusComment = async (statusId: string, text: string): Promise<StatusComment | null> => {
    try {
      const res = await api.addStatusComment(statusId, text);
      if (res && res.comment) {
        setStatuses((prev) =>
          prev.map((s) => {
            if (s.id !== statusId) return s;
            const currentComments = s.comments || [];
            return {
              ...s,
              commentsCount: (s.commentsCount || currentComments.length) + 1,
              comments: [...currentComments, res.comment],
            };
          })
        );
        return res.comment;
      }
      return null;
    } catch (err) {
      console.error('Failed to add status comment:', err);
      return null;
    }
  };

  const deleteStatusComment = async (statusId: string, commentId: string) => {
    try {
      await api.deleteStatusComment(statusId, commentId);
      setStatuses((prev) =>
        prev.map((s) => {
          if (s.id !== statusId) return s;
          const currentComments = (s.comments || []).filter((c) => c.id !== commentId);
          return {
            ...s,
            commentsCount: Math.max(0, (s.commentsCount || 1) - 1),
            comments: currentComments,
          };
        })
      );
    } catch (err) {
      console.error('Failed to delete status comment:', err);
    }
  };

  const sendDirectStatusReply = async (
    status: UserStatus,
    replyText: string
  ): Promise<{ success: boolean; conversationId?: string; error?: string }> => {
    if (!currentUser) return { success: false, error: 'Not logged in' };
    if (!status || !status.userId) return { success: false, error: 'Invalid status' };
    if (status.userId === currentUser.id) return { success: false, error: 'Cannot reply to your own status' };

    try {
      // Find existing private conversation or create one
      let conv = conversations.find(
        (c) =>
          c.type === 'private' &&
          c.memberIds.includes(status.userId) &&
          c.memberIds.includes(currentUser.id)
      );

      if (!conv) {
        conv = await api.createPrivateConversation(status.userId);
        await loadConversations();
      }

      if (!conv) {
        return { success: false, error: 'Failed to start conversation' };
      }

      // Format rich context header so recipient knows exactly which story was replied to
      let storyContext = '';
      if (status.type === 'text') {
        const preview = status.content.length > 70 ? status.content.slice(0, 70) + '...' : status.content;
        storyContext = `💬 *Replied to story:*\n> "${preview}"\n\n`;
      } else if (status.type === 'image') {
        const cap = status.caption ? `: "${status.caption}"` : '';
        storyContext = `📷 *Replied to photo story${cap}*\n\n`;
      } else if (status.type === 'video') {
        const cap = status.caption ? `: "${status.caption}"` : '';
        storyContext = `🎥 *Replied to video story${cap}*\n\n`;
      } else if (status.type === 'audio') {
        storyContext = `🎤 *Replied to voice story*\n\n`;
      }

      const fullMessageText = `${storyContext}${replyText.trim()}`;

      await api.sendMessage(conv.id, {
        type: 'text',
        text: fullMessageText,
      });

      await loadConversations();
      return { success: true, conversationId: conv.id };
    } catch (err: any) {
      console.error('Failed to send direct status reply:', err);
      return { success: false, error: err?.message || 'Failed to send direct reply' };
    }
  };

  const loadStreak = useCallback(async (convId: string) => {
    try {
      const data = await api.getStreak(convId);
      setActiveStreak(data);
    } catch (err) {
      console.error('Failed to load streak:', err);
      setActiveStreak(null);
    }
  }, []);

  const loadScheduledMessages = useCallback(async () => {
    try {
      const data = await api.getScheduledMessages();
      setScheduledMessages(data);
    } catch (err) {
      console.error('Failed to load scheduled messages:', err);
    }
  }, []);

  const createScheduledMessage = async (data: {
    conversationId: string;
    type?: string;
    content: string;
    mediaUrl?: string;
    mediaName?: string;
    scheduledAt: string;
    timezone?: string;
  }) => {
    await api.createScheduledMessage(data);
    await loadScheduledMessages();
  };

  const cancelScheduledMessage = async (id: string) => {
    await api.cancelScheduledMessage(id);
    await loadScheduledMessages();
  };

  const loadRecurringSchedules = useCallback(async () => {
    try {
      const data = await api.getRecurringSchedules();
      setRecurringSchedules(data);
    } catch (err) {
      console.error('Failed to load recurring schedules:', err);
    }
  }, []);

  const createRecurringSchedule = async (data: {
    conversationId: string;
    content: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
    startAt: string;
    endRule?: 'never' | 'custom_date' | 'occurrences';
    endAt?: string;
    maxOccurrences?: number;
    timezone?: string;
  }) => {
    await api.createRecurringSchedule(data);
    await loadRecurringSchedules();
  };

  const updateRecurringScheduleStatus = async (id: string, action: 'pause' | 'resume' | 'cancel') => {
    await api.updateRecurringScheduleStatus(id, action);
    await loadRecurringSchedules();
  };

  const deleteRecurringSchedule = async (id: string) => {
    await api.deleteRecurringSchedule(id);
    await loadRecurringSchedules();
  };

  const loadFriendRequests = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await api.getFriendRequests();
      setIncomingRequests(res.incoming || []);
      setOutgoingRequests(res.outgoing || []);
    } catch (err) {
      console.error('Failed to load friend requests:', err);
    }
  }, [currentUser]);

  const sendFriendRequest = async (receiverId: string) => {
    await api.sendFriendRequest(receiverId);
    await loadFriendRequests();
  };

  const respondFriendRequest = async (requestId: string, action: 'accept' | 'deny') => {
    await api.respondFriendRequest(requestId, action);
    await loadFriendRequests();
    await loadConversations();
  };

  const playNotificationSound = useCallback(() => {
    if (!settings.soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 note
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5 note
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } catch {
      // AudioContext restriction ignored
    }
  }, [settings.soundEnabled]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.getConversations();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, []);

  const loadMessages = useCallback(async (convId: string) => {
    try {
      setLoadingMessages(true);
      const data = await api.getMessages(convId);
      setMessages(data);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadConversations();
      loadFriendRequests();
      loadStatuses();
      loadScheduledMessages();
      loadRecurringSchedules();
      if (currentUser.role === 'admin' || currentUser.email === 'zaygapiglegend88@gmail.com') {
        setAdminModalOpen(true);
      }
    }
  }, [
    currentUser,
    loadConversations,
    loadFriendRequests,
    loadStatuses,
    loadScheduledMessages,
    loadRecurringSchedules,
  ]);

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
      loadStreak(activeConversationId);
      setReplyingToMessage(null);
      setSelectedMessageIds([]);
    } else {
      setMessages([]);
      setActiveStreak(null);
    }
  }, [activeConversationId, loadMessages, loadStreak]);

  const typingAutoClearsRef = useRef<Record<string, any>>({});

  // Handle incoming real-time WebSocket events
  useEffect(() => {
    const unsubscribe = wsClient.subscribe((event: WSEvent) => {
      if (event.type === 'new_message') {
        const msg = event.payload;
        if (msg.conversationId === activeConversationId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            if (msg.senderId === getCurrentUserId()) {
              const optIndex = prev.findIndex((m) => m.id.startsWith('opt_'));
              if (optIndex !== -1) {
                const updated = [...prev];
                updated[optIndex] = msg;
                return updated;
              }
            }
            return [...prev, msg];
          });
          loadStreak(activeConversationId);
        }
        if (msg.senderId !== getCurrentUserId()) {
          playNotificationSound();
        }
        loadConversations();
      } else if (event.type === 'status_update') {
        loadStatuses();
      } else if (event.type === 'status_reaction') {
        const { statusId, reactions, reactionsList } = event.payload;
        setStatuses((prev) =>
          prev.map((s) =>
            s.id === statusId
              ? {
                  ...s,
                  reactions: reactions || s.reactions,
                  reactionsList: reactionsList || s.reactionsList,
                }
              : s
          )
        );
      } else if (event.type === 'status_comment_added') {
        const { statusId, comment } = event.payload;
        setStatuses((prev) =>
          prev.map((s) => {
            if (s.id !== statusId) return s;
            const curComments = s.comments || [];
            // Only add if not already in list
            const hasComment = curComments.some((c) => c.id === comment.id);
            const newComments = hasComment ? curComments : [...curComments, comment];
            return {
              ...s,
              commentsCount: (s.commentsCount || curComments.length) + (hasComment ? 0 : 1),
              comments: newComments,
            };
          })
        );
      } else if (event.type === 'status_comment_deleted') {
        const { statusId, commentId } = event.payload;
        setStatuses((prev) =>
          prev.map((s) => {
            if (s.id !== statusId) return s;
            const curComments = (s.comments || []).filter((c) => c.id !== commentId);
            return {
              ...s,
              commentsCount: Math.max(0, (s.commentsCount || 1) - 1),
              comments: curComments,
            };
          })
        );
      } else if (event.type === 'streak_update') {
        if (activeConversationId) {
          loadStreak(activeConversationId);
        }
      } else if (event.type === 'scheduled_message_sent') {
        loadScheduledMessages();
        loadConversations();
      } else if (event.type === 'recurring_message_sent') {
        loadRecurringSchedules();
        loadConversations();
      } else if (event.type === 'typing_start') {
        const { conversationId, userId, userName } = event.payload;
        setTypingUsers((prev) => {
          const list = prev[conversationId] || [];
          if (list.some((u) => u.userId === userId)) return prev;
          return { ...prev, [conversationId]: [...list, { userId, userName }] };
        });

        // Auto-clear typing indicator after 3.5 seconds in case no stop event is received
        const key = `${conversationId}_${userId}`;
        if (typingAutoClearsRef.current[key]) {
          clearTimeout(typingAutoClearsRef.current[key]);
        }
        typingAutoClearsRef.current[key] = setTimeout(() => {
          setTypingUsers((prev) => {
            const list = prev[conversationId] || [];
            return { ...prev, [conversationId]: list.filter((u) => u.userId !== userId) };
          });
          delete typingAutoClearsRef.current[key];
        }, 3500);
      } else if (event.type === 'typing_stop') {
        const { conversationId, userId } = event.payload;
        const key = `${conversationId}_${userId}`;
        if (typingAutoClearsRef.current[key]) {
          clearTimeout(typingAutoClearsRef.current[key]);
          delete typingAutoClearsRef.current[key];
        }
        setTypingUsers((prev) => {
          const list = prev[conversationId] || [];
          return { ...prev, [conversationId]: list.filter((u) => u.userId !== userId) };
        });
      } else if (event.type === 'reaction_update') {
        const { messageId, reactions } = event.payload;
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
        );
      } else if (event.type === 'message_delete') {
        const { messageId, mode } = event.payload;
        if (mode === 'for_everyone') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, deletedForEveryone: true, text: 'This message was deleted' }
                : m
            )
          );
        }
        loadConversations();
      } else if (event.type === 'message_read') {
        const { conversationId, userId } = event.payload;
        if (conversationId === activeConversationId) {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.senderId !== userId) {
                return {
                  ...m,
                  status: 'read',
                  readBy: { ...(m.readBy || {}), [userId]: new Date().toISOString() },
                };
              }
              return m;
            })
          );
        }
        loadConversations();
      } else if (event.type === 'group_update' || event.type === 'conversation_created') {
        loadConversations();
      } else if (event.type === 'friend_request') {
        loadFriendRequests();
        playNotificationSound();
      } else if (event.type === 'friend_request_update') {
        loadFriendRequests();
        loadConversations();
      } else if (event.type === 'user_updated') {
        loadConversations();
        loadStatuses();
      } else if (event.type === 'status_delete') {
        const { statusId } = event.payload;
        setStatuses((prev) => prev.filter((s) => s.id !== statusId));
      } else if (event.type === 'scheduled_message_update') {
        loadScheduledMessages();
      } else if (event.type === 'recurring_message_update') {
        loadRecurringSchedules();
      }
    });

    return () => unsubscribe();
  }, [
    activeConversationId,
    playNotificationSound,
    loadConversations,
    loadStatuses,
    loadStreak,
    loadFriendRequests,
    loadScheduledMessages,
    loadRecurringSchedules,
  ]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  const sendMessage = async (payload: {
    type?: string;
    text?: string;
    mediaUrl?: string;
    mediaName?: string;
    mediaSize?: number;
    mediaMime?: string;
    duration?: number;
  }) => {
    if (!activeConversationId) return;

    // Check link preview
    let linkPreview = undefined;
    if (payload.text) {
      const urlMatch = payload.text.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        try {
          linkPreview = await api.fetchLinkPreview(urlMatch[0]);
        } catch {
          // ignore link preview error
        }
      }
    }

    const optimisticMsg: Message = {
      id: `opt_${Date.now()}`,
      conversationId: activeConversationId,
      senderId: currentUser?.id || '',
      senderName: currentUser?.name || '',
      senderAvatar: currentUser?.avatar || '',
      type: (payload.type as any) || 'text',
      text: payload.text || '',
      mediaUrl: payload.mediaUrl,
      mediaName: payload.mediaName,
      mediaSize: payload.mediaSize,
      mediaMime: payload.mediaMime,
      duration: payload.duration,
      replyToMessageId: replyingToMessage?.id,
      replyToPreview: replyingToMessage
        ? {
            id: replyingToMessage.id,
            senderName: replyingToMessage.senderName,
            text: replyingToMessage.text,
            type: replyingToMessage.type,
          }
        : undefined,
      linkPreview,
      status: 'sending',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setReplyingToMessage(null);

    try {
      const sentMsg = await api.sendMessage(activeConversationId, {
        ...payload,
        replyToMessageId: replyingToMessage?.id,
        linkPreview,
      });

      setMessages((prev) => {
        const alreadyExists = prev.some((m) => m.id === sentMsg.id);
        if (alreadyExists) {
          return prev
            .filter((m) => m.id !== optimisticMsg.id)
            .map((m) => (m.id === sentMsg.id ? sentMsg : m));
        }
        return prev.map((m) => (m.id === optimisticMsg.id ? sentMsg : m));
      });
      loadConversations();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser) return;
    const { reactions } = await api.toggleReaction(messageId, emoji);
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
    );
  };

  const toggleStar = async (messageId: string) => {
    const { starredBy } = await api.toggleStar(messageId);
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, starredBy } : m))
    );
  };

  const deleteMessage = async (messageId: string, mode: 'for_me' | 'for_everyone') => {
    await api.deleteMessage(messageId, mode);
    if (mode === 'for_me') {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } else {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, deletedForEveryone: true, text: 'This message was deleted' }
            : m
        )
      );
    }
    loadConversations();
  };

  const forwardMessages = async (targetConvIds: string[]) => {
    if (!forwardModalMessage) return;
    for (const convId of targetConvIds) {
      await api.sendMessage(convId, {
        type: forwardModalMessage.type,
        text: forwardModalMessage.text,
        mediaUrl: forwardModalMessage.mediaUrl,
        mediaName: forwardModalMessage.mediaName,
        mediaSize: forwardModalMessage.mediaSize,
        mediaMime: forwardModalMessage.mediaMime,
      });
    }
    setForwardModalMessage(null);
    loadConversations();
  };

  const markConversationAsRead = async (convId: string) => {
    // Already marked when fetching messages
  };

  const toggleSelectMessage = (msgId: string) => {
    setSelectedMessageIds((prev) =>
      prev.includes(msgId) ? prev.filter((id) => id !== msgId) : [...prev, msgId]
    );
  };

  const startTyping = () => {
    if (activeConversationId && currentUser) {
      wsClient.startTyping(activeConversationId, currentUser.name || currentUser.username || 'User');
    }
  };

  const stopTyping = () => {
    if (activeConversationId) {
      wsClient.stopTyping(activeConversationId);
    }
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversation,
        activeConversationId,
        messages,
        loadingMessages,
        filterTab,
        searchQuery,
        searchInChatQuery,
        typingUsers,
        replyingToMessage,
        selectedMessageIds,
        infoPanelOpen,
        lightboxMedia,
        forwardModalMessage,
        incomingRequests,
        outgoingRequests,
        newChatOpen,
        addContactOpen,
        createGroupOpen,
        profileModalOpen,
        settingsModalOpen,
        adminModalOpen,
        statuses,
        activeStreak,
        scheduledMessages,
        recurringSchedules,
        createStatusOpen,
        statusViewerOpen,
        viewingStatusIndex,
        scheduleModalOpen,
        scheduledListOpen,
        recurringModalOpen,
        recurringListOpen,
        setCreateStatusOpen,
        setStatusViewerOpen,
        setViewingStatusIndex,
        setScheduleModalOpen,
        setScheduledListOpen,
        setRecurringModalOpen,
        setRecurringListOpen,
        loadStatuses,
        fetchStatusDetails,
        createStatus,
        deleteStatus,
        reactToStatus,
        addStatusComment,
        deleteStatusComment,
        sendDirectStatusReply,
        loadStreak,
        loadScheduledMessages,
        createScheduledMessage,
        cancelScheduledMessage,
        loadRecurringSchedules,
        createRecurringSchedule,
        updateRecurringScheduleStatus,
        deleteRecurringSchedule,
        setActiveConversationId,
        setFilterTab,
        setSearchQuery,
        setSearchInChatQuery,
        setReplyingToMessage,
        setSelectedMessageIds,
        toggleSelectMessage,
        setInfoPanelOpen,
        setLightboxMedia,
        setForwardModalMessage,
        setNewChatOpen,
        setAddContactOpen,
        setCreateGroupOpen,
        setProfileModalOpen,
        setSettingsModalOpen,
        setAdminModalOpen,
        loadFriendRequests,
        sendFriendRequest,
        respondFriendRequest,
        loadConversations,
        sendMessage,
        toggleReaction,
        toggleStar,
        deleteMessage,
        forwardMessages,
        markConversationAsRead,
        startCall: () => {},
        endCall: () => {},
        toggleMuteCall: () => {},
        toggleVideoCall: () => {},
        startTyping,
        stopTyping,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within ChatProvider');
  return context;
};
