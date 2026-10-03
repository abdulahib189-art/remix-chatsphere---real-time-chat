export type UserRole = 'user' | 'admin';
export type OnlineStatus = 'online' | 'offline' | 'away';

export interface UserPrivacy {
  showOnline: boolean;
  showLastSeen: boolean;
  showReadReceipts: boolean;
}

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  password?: string;
  phone?: string;
  avatar: string;
  bio: string;
  role: UserRole;
  onlineStatus: OnlineStatus;
  lastSeen: string;
  privacy: UserPrivacy;
  blockedUserIds?: string[];
  contacts?: string[]; // Array of contact user IDs
  createdAt: string;
  isSuspended?: boolean;
  isBanned?: boolean;
  isVerified?: boolean;
  warningsCount?: number;
  lastActive?: string;
}

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'system';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image?: string;
  domain: string;
}

export interface ReplyPreview {
  id: string;
  senderName: string;
  text: string;
  type: MessageType;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  type: MessageType;
  text: string;
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: number;
  mediaMime?: string;
  duration?: number; // For audio voice messages in seconds
  linkPreview?: LinkPreview;
  replyToMessageId?: string;
  replyToPreview?: ReplyPreview;
  reactions?: Record<string, string[]>; // emoji -> array of userIds who reacted
  status: MessageStatus;
  readBy?: Record<string, string>; // userId -> timestamp
  starredBy?: string[]; // userIds who starred this
  deletedFor?: string[]; // userIds for whom message is deleted locally
  deletedForEveryone?: boolean;
  createdAt: string;
}

export interface GroupPermissions {
  sendMessages: 'all' | 'admins';
  editInfo: 'all' | 'admins';
  addMembers: 'all' | 'admins';
}

export interface Conversation {
  id: string;
  type: 'private' | 'group';
  name?: string;
  avatar?: string;
  description?: string;
  createdById: string;
  memberIds: string[];
  groupAdmins: string[];
  pinnedUserIds: string[];
  archivedUserIds: string[];
  mutedUserIds: string[];
  unreadCounts: Record<string, number>; // userId -> number
  permissions: GroupPermissions;
  lastMessage?: Message;
  createdAt: string;
  updatedAt: string;
}

export interface ReportedMessage {
  id: string;
  messageId?: string;
  messageText?: string;
  senderName?: string;
  conversationId?: string;
  reportedBy: string; // reporter userId
  reportedByName: string; // reporter user name
  reportedUserId: string; // reported target userId
  reportedUserName: string; // reported target name
  reason: 'Spam' | 'Harassment' | 'Fake account' | 'Hate/abusive content' | 'Scam' | 'Inappropriate content' | 'Other' | string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed' | 'escalated';
  actionTaken?: string;
  createdAt: string;
}

export interface SystemActivityLog {
  id: string;
  type:
    | 'user_registered'
    | 'report_received'
    | 'account_suspended'
    | 'account_banned'
    | 'account_warned'
    | 'account_verified'
    | 'report_action'
    | 'admin_message'
    | 'system_event';
  description: string;
  userId?: string;
  userName?: string;
  timestamp: string;
}

export interface AdminDashboardOverview {
  totalUsers: number;
  activeUsers: number;
  onlineUsers: number;
  pendingReports: number;
  suspendedAccounts: number;
  newUsersToday: number;
  systemAlerts: number;
}

export interface UserAnalyticsData {
  dau: number;
  mau: number;
  newRegistrationsToday: number;
  avgSessionDuration: string;
  dauTrend: { date: string; dau: number; newUsers: number }[];
  messageVolumeTrend: { date: string; messages: number }[];
  reportsCategoryDistribution: { category: string; count: number }[];
}

export interface UserSettings {
  wallpaper: 'doodle' | 'dark' | 'emerald' | 'sunset' | 'lavender' | 'solid';
  theme: 'light' | 'dark' | 'system';
  fontSize: 'sm' | 'md' | 'lg';
  soundEnabled: boolean;
  enterToSend: boolean;
  mediaAutoDownload: boolean;
}

export interface FriendRequest {
  id: string;
  senderId: string;
  senderName: string;
  senderUsername: string;
  senderAvatar: string;
  senderBio?: string;
  senderEmail?: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar: string;
  status: 'pending' | 'accepted' | 'denied';
  createdAt: string;
}

export interface StatusComment {
  id: string;
  statusId: string;
  userId: string;
  userName: string;
  userUsername: string;
  userAvatar: string;
  userIsVerified?: boolean;
  text: string;
  createdAt: string; // ISO
}

export interface StatusReaction {
  id: string;
  statusId: string;
  userId: string;
  userName: string;
  userUsername: string;
  userAvatar: string;
  userIsVerified?: boolean;
  emoji: string;
  createdAt: string; // ISO
}

export interface UserStatus {
  id: string;
  userId: string;
  userName: string;
  userUsername?: string;
  userAvatar: string;
  userIsVerified?: boolean;
  type: 'text' | 'image' | 'video' | 'audio';
  content: string; // text or mediaUrl
  caption?: string;
  bgColor?: string; // background color for text status
  duration?: number; // duration in seconds for audio/video (max 60s)
  createdAt: string; // ISO
  expiresAt: string; // ISO
  reactions?: Record<string, string[]>; // emoji -> array of userIds
  reactionsList?: StatusReaction[]; // full list of reactions with user info
  commentsCount?: number;
  comments?: StatusComment[];
}

export interface ChatStreak {
  userAId: string;
  userBId: string;
  streakCount: number;
  lastQualifyingDate: string; // YYYY-MM-DD
  userAMessagesToday: number;
  userBMessagesToday: number;
  isActiveToday: boolean;
}

export interface ScheduledMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  conversationId: string;
  conversationName?: string;
  type: MessageType;
  content: string;
  mediaUrl?: string;
  mediaName?: string;
  scheduledAt: string; // ISO timestamp
  timezone: string;
  status: 'scheduled' | 'sent' | 'cancelled' | 'failed';
  createdAt: string;
  sentAt?: string;
  cancelledAt?: string;
}

export interface RecurringSchedule {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  conversationId: string;
  conversationName?: string;
  content: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // "HH:MM" 24h
  startAt: string; // ISO date
  endRule: 'never' | 'custom_date' | 'occurrences';
  endAt?: string; // ISO date
  maxOccurrences?: number;
  occurrencesCount: number;
  timezone: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled' | 'failed';
  nextRunAt: string; // ISO timestamp
  lastRunAt?: string; // ISO timestamp
  createdAt: string;
}

export interface WSEvent {
  type:
    | 'auth'
    | 'typing_start'
    | 'typing_stop'
    | 'presence_update'
    | 'new_message'
    | 'message_read'
    | 'reaction_update'
    | 'message_delete'
    | 'message_star'
    | 'group_update'
    | 'conversation_created'
    | 'friend_request'
    | 'friend_request_update'
    | 'user_updated'
    | 'user_registered'
    | 'notification'
    | 'status_update'
    | 'status_delete'
    | 'status_reaction'
    | 'status_comment_added'
    | 'status_comment_deleted'
    | 'streak_update'
    | 'scheduled_message_update'
    | 'scheduled_message_sent'
    | 'recurring_message_update'
    | 'recurring_message_sent'
    | 'admin_action';
  payload: any;
}
