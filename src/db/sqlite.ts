import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import {
  User,
  Conversation,
  Message,
  ReportedMessage,
  SystemActivityLog,
  FriendRequest,
  UserStatus,
  StatusComment,
  StatusReaction,
  ScheduledMessage,
  RecurringSchedule,
} from '../types.js';
import { hashPasswordForStorage, normalizePasswordForStorage } from '../lib/auth.js';

// DATA_DIR points at a persistent volume in production; defaults to the project root locally.
export const dataDir = process.env.DATA_DIR || process.cwd();
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'chatsphere.db');
// On first boot with an empty volume, seed it with the database bundled in the repo.
const bundledDbPath = path.join(process.cwd(), 'chatsphere.db');
if (!fs.existsSync(dbPath) && dbPath !== bundledDbPath && fs.existsSync(bundledDbPath)) {
  fs.copyFileSync(bundledDbPath, dbPath);
}
export const db = createClient({
  url: `file:${dbPath}`,
});

// Helper for safe JSON parsing
function parseJSON<T>(jsonStr: any, fallback: T): T {
  if (!jsonStr || typeof jsonStr !== 'string') return fallback;
  try {
    return JSON.parse(jsonStr);
  } catch {
    return fallback;
  }
}

// Convert SQLite user row to User entity
export function sanitizeUserForClient<T extends User | null | undefined>(user: T): T {
  if (!user) return user;
  const { password: _password, ...safeUser } = user as User & { password?: string };
  return safeUser as T;
}

function mapUserRow(row: any): User {
  return {
    id: String(row.id),
    name: String(row.name),
    username: String(row.username),
    email: String(row.email),
    password: row.password ? String(row.password) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    avatar: String(row.avatar),
    bio: String(row.bio || ''),
    role: (row.role === 'admin' ? 'admin' : 'user') as 'admin' | 'user',
    onlineStatus: (row.online_status || 'offline') as 'online' | 'offline' | 'away',
    lastSeen: String(row.last_seen),
    privacy: parseJSON(row.privacy, { showOnline: true, showLastSeen: true, showReadReceipts: true }),
    blockedUserIds: parseJSON(row.blocked_user_ids, []),
    contacts: parseJSON(row.contacts, []),
    isSuspended: Boolean(row.is_suspended),
    isBanned: Boolean(row.is_banned),
    isVerified: Boolean(row.is_verified),
    warningsCount: Number(row.warnings_count || 0),
    createdAt: String(row.created_at),
  };
}

// Convert SQLite conversation row to Conversation entity
function mapConversationRow(row: any, lastMessage?: Message): Conversation {
  return {
    id: String(row.id),
    type: row.type === 'group' ? 'group' : 'private',
    name: row.name ? String(row.name) : undefined,
    avatar: row.avatar ? String(row.avatar) : undefined,
    description: row.description ? String(row.description) : undefined,
    createdById: String(row.created_by_id),
    memberIds: parseJSON(row.member_ids, []),
    groupAdmins: parseJSON(row.group_admins, []),
    pinnedUserIds: parseJSON(row.pinned_user_ids, []),
    archivedUserIds: parseJSON(row.archived_user_ids, []),
    mutedUserIds: parseJSON(row.muted_user_ids, []),
    unreadCounts: parseJSON(row.unread_counts, {}),
    permissions: parseJSON(row.permissions, { sendMessages: 'all', editInfo: 'all', addMembers: 'all' }),
    lastMessage,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

// Convert SQLite message row to Message entity
function mapMessageRow(row: any): Message {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderId: String(row.sender_id),
    senderName: String(row.sender_name),
    senderAvatar: String(row.sender_avatar),
    type: (row.type || 'text') as any,
    text: String(row.text || ''),
    mediaUrl: row.media_url ? String(row.media_url) : undefined,
    mediaName: row.media_name ? String(row.media_name) : undefined,
    mediaSize: row.media_size ? Number(row.media_size) : undefined,
    mediaMime: row.media_mime ? String(row.media_mime) : undefined,
    duration: row.duration ? Number(row.duration) : undefined,
    replyToMessageId: row.reply_to_message_id ? String(row.reply_to_message_id) : undefined,
    replyToPreview: parseJSON(row.reply_to_preview, undefined),
    linkPreview: parseJSON(row.link_preview, undefined),
    reactions: parseJSON(row.reactions, {}),
    status: (row.status || 'delivered') as any,
    readBy: parseJSON(row.read_by, {}),
    starredBy: parseJSON(row.starred_by, []),
    deletedFor: parseJSON(row.deleted_for, []),
    deletedForEveryone: Boolean(row.deleted_for_everyone),
    createdAt: String(row.created_at),
  };
}

// Convert SQLite friend request row to FriendRequest entity
function mapFriendRequestRow(row: any): FriendRequest {
  return {
    id: String(row.id),
    senderId: String(row.sender_id),
    senderName: String(row.sender_name),
    senderUsername: String(row.sender_username),
    senderAvatar: String(row.sender_avatar),
    senderBio: row.sender_bio ? String(row.sender_bio) : undefined,
    senderEmail: row.sender_email ? String(row.sender_email) : undefined,
    receiverId: String(row.receiver_id),
    receiverName: String(row.receiver_name),
    receiverAvatar: String(row.receiver_avatar),
    status: (row.status || 'pending') as any,
    createdAt: String(row.created_at),
  };
}

// Convert SQLite user status row to UserStatus entity
function mapUserStatusRow(row: any): UserStatus {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    userName: String(row.user_name),
    userUsername: row.user_username ? String(row.user_username) : undefined,
    userAvatar: String(row.user_avatar),
    userIsVerified: Boolean(row.user_is_verified),
    type: (row.type || 'text') as any,
    content: String(row.content),
    caption: row.caption ? String(row.caption) : undefined,
    bgColor: row.bg_color ? String(row.bg_color) : undefined,
    duration: row.duration ? Number(row.duration) : undefined,
    reactions: parseJSON(row.reactions, {}),
    commentsCount: row.comments_count !== undefined ? Number(row.comments_count) : undefined,
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at),
  };
}

// Convert SQLite status comment row to StatusComment entity
function mapStatusCommentRow(row: any): StatusComment {
  return {
    id: String(row.id),
    statusId: String(row.status_id),
    userId: String(row.user_id),
    userName: String(row.user_name),
    userUsername: String(row.user_username || ''),
    userAvatar: String(row.user_avatar),
    userIsVerified: Boolean(row.user_is_verified),
    text: String(row.text),
    createdAt: String(row.created_at),
  };
}

// Convert SQLite status reaction row to StatusReaction entity
function mapStatusReactionRow(row: any): StatusReaction {
  return {
    id: String(row.id),
    statusId: String(row.status_id),
    userId: String(row.user_id),
    userName: String(row.user_name),
    userUsername: String(row.user_username || ''),
    userAvatar: String(row.user_avatar),
    userIsVerified: Boolean(row.user_is_verified),
    emoji: String(row.emoji),
    createdAt: String(row.created_at),
  };
}

// Convert SQLite report row to ReportedMessage entity
function mapReportRow(row: any): ReportedMessage {
  return {
    id: String(row.id),
    messageId: row.message_id ? String(row.message_id) : undefined,
    messageText: row.message_text ? String(row.message_text) : undefined,
    senderName: row.sender_name ? String(row.sender_name) : undefined,
    conversationId: row.conversation_id ? String(row.conversation_id) : undefined,
    reportedBy: String(row.reported_by),
    reportedByName: String(row.reported_by_name),
    reportedUserId: String(row.reported_user_id),
    reportedUserName: String(row.reported_user_name),
    reason: String(row.reason),
    status: (row.status || 'pending') as any,
    actionTaken: row.action_taken ? String(row.action_taken) : undefined,
    createdAt: String(row.created_at),
  };
}

// Convert SQLite log row
function mapActivityLogRow(row: any): SystemActivityLog {
  return {
    id: String(row.id),
    type: (row.type || 'user_registered') as any,
    description: String(row.description),
    userId: row.user_id ? String(row.user_id) : undefined,
    userName: row.user_name ? String(row.user_name) : undefined,
    timestamp: String(row.timestamp),
  };
}

// Convert SQLite scheduled message row
function mapScheduledMessageRow(row: any): ScheduledMessage {
  return {
    id: String(row.id),
    senderId: String(row.sender_id),
    senderName: String(row.sender_name),
    senderAvatar: String(row.sender_avatar),
    conversationId: String(row.conversation_id),
    conversationName: row.conversation_name ? String(row.conversation_name) : undefined,
    type: (row.type || 'text') as any,
    content: String(row.content),
    mediaUrl: row.media_url ? String(row.media_url) : undefined,
    mediaName: row.media_name ? String(row.media_name) : undefined,
    scheduledAt: String(row.scheduled_at),
    timezone: String(row.timezone || 'UTC'),
    status: (row.status || 'scheduled') as any,
    createdAt: String(row.created_at),
    sentAt: row.sent_at ? String(row.sent_at) : undefined,
    cancelledAt: row.cancelled_at ? String(row.cancelled_at) : undefined,
  };
}

// Convert SQLite recurring schedule row
function mapRecurringScheduleRow(row: any): RecurringSchedule {
  return {
    id: String(row.id),
    senderId: String(row.sender_id),
    senderName: String(row.sender_name),
    senderAvatar: String(row.sender_avatar),
    conversationId: String(row.conversation_id),
    conversationName: row.conversation_name ? String(row.conversation_name) : undefined,
    content: String(row.content),
    frequency: (row.frequency || 'daily') as any,
    time: String(row.time),
    startAt: String(row.start_at),
    endRule: (row.end_rule || 'never') as any,
    endAt: row.end_at ? String(row.end_at) : undefined,
    maxOccurrences: row.max_occurrences ? Number(row.max_occurrences) : undefined,
    occurrencesCount: Number(row.occurrences_count || 0),
    timezone: String(row.timezone || 'UTC'),
    status: (row.status || 'active') as any,
    nextRunAt: String(row.next_run_at),
    lastRunAt: row.last_run_at ? String(row.last_run_at) : undefined,
    createdAt: String(row.created_at),
  };
}

function getConfiguredAdminConfig() {
  const email = String(process.env.ADMIN_EMAIL || 'zaygapiglegend88@gmail.com').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || 'change-me-admin-password').trim();
  return { email, password };
}

// ==========================================
// DATABASE INITIALIZATION & SCHEMA MIGRATION
// ==========================================

export async function initDatabase() {
  await db.execute('PRAGMA foreign_keys = ON;');

  // 1. Users Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT,
      phone TEXT,
      avatar TEXT NOT NULL,
      bio TEXT DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user',
      online_status TEXT NOT NULL DEFAULT 'offline',
      last_seen TEXT NOT NULL,
      privacy TEXT NOT NULL,
      blocked_user_ids TEXT DEFAULT '[]',
      contacts TEXT DEFAULT '[]',
      is_suspended INTEGER DEFAULT 0,
      is_banned INTEGER DEFAULT 0,
      is_verified INTEGER DEFAULT 0,
      warnings_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);

  // 2. OTP Codes Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      email TEXT PRIMARY KEY,
      otp TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // 3. Conversations Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT,
      avatar TEXT,
      description TEXT,
      created_by_id TEXT NOT NULL,
      member_ids TEXT NOT NULL,
      group_admins TEXT NOT NULL,
      pinned_user_ids TEXT NOT NULL,
      archived_user_ids TEXT NOT NULL,
      muted_user_ids TEXT NOT NULL,
      unread_counts TEXT NOT NULL,
      permissions TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);`);

  // 4. Messages Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      sender_avatar TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      text TEXT NOT NULL,
      media_url TEXT,
      media_name TEXT,
      media_size INTEGER,
      media_mime TEXT,
      duration REAL,
      reply_to_message_id TEXT,
      reply_to_preview TEXT,
      link_preview TEXT,
      reactions TEXT DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'delivered',
      read_by TEXT DEFAULT '{}',
      starred_by TEXT DEFAULT '[]',
      deleted_for TEXT DEFAULT '[]',
      deleted_for_everyone INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at);`);

  // 5. Friend Requests Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS friend_requests (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      sender_username TEXT NOT NULL,
      sender_avatar TEXT NOT NULL,
      sender_bio TEXT,
      sender_email TEXT,
      receiver_id TEXT NOT NULL,
      receiver_name TEXT NOT NULL,
      receiver_avatar TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id, status);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id, status);`);

  // 6. User Statuses Table (Stories)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_statuses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_username TEXT,
      user_avatar TEXT NOT NULL,
      user_is_verified INTEGER DEFAULT 0,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      caption TEXT,
      bg_color TEXT,
      duration REAL,
      reactions TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_user_statuses_expires_at ON user_statuses(expires_at);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_user_statuses_user_id ON user_statuses(user_id);`);

  // Safe migrations for user_statuses columns
  try {
    await db.execute(`ALTER TABLE user_statuses ADD COLUMN user_username TEXT;`);
  } catch {}
  try {
    await db.execute(`ALTER TABLE user_statuses ADD COLUMN user_is_verified INTEGER DEFAULT 0;`);
  } catch {}

  // 6b. Status Comments Table (Separate, independent comments per status)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS status_comments (
      id TEXT PRIMARY KEY,
      status_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_username TEXT,
      user_avatar TEXT NOT NULL,
      user_is_verified INTEGER DEFAULT 0,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_status_comments_status_id ON status_comments(status_id, created_at);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_status_comments_user_id ON status_comments(user_id);`);

  // 6c. Status Reactions Table (Separate, independent reactions per status)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS status_reactions (
      id TEXT PRIMARY KEY,
      status_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_username TEXT,
      user_avatar TEXT NOT NULL,
      user_is_verified INTEGER DEFAULT 0,
      emoji TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_status_reactions_status_id ON status_reactions(status_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_status_reactions_user ON status_reactions(status_id, user_id);`);

  // 7. Reported Messages Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS reported_messages (
      id TEXT PRIMARY KEY,
      message_id TEXT,
      message_text TEXT,
      sender_name TEXT,
      conversation_id TEXT,
      reported_by TEXT NOT NULL,
      reported_by_name TEXT NOT NULL,
      reported_user_id TEXT NOT NULL,
      reported_user_name TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      action_taken TEXT,
      created_at TEXT NOT NULL
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_reported_messages_status ON reported_messages(status);`);

  // 8. System Activity Logs Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS system_activity_logs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      user_id TEXT,
      user_name TEXT,
      timestamp TEXT NOT NULL
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON system_activity_logs(timestamp);`);

  // 9. Scheduled Messages Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      sender_avatar TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      conversation_name TEXT,
      type TEXT NOT NULL DEFAULT 'text',
      content TEXT NOT NULL,
      media_url TEXT,
      media_name TEXT,
      scheduled_at TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      status TEXT NOT NULL DEFAULT 'scheduled',
      created_at TEXT NOT NULL,
      sent_at TEXT,
      cancelled_at TEXT
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status, scheduled_at);`);

  // 10. Recurring Schedules Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS recurring_schedules (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      sender_avatar TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      conversation_name TEXT,
      content TEXT NOT NULL,
      frequency TEXT NOT NULL,
      time TEXT NOT NULL,
      start_at TEXT NOT NULL,
      end_rule TEXT NOT NULL DEFAULT 'never',
      end_at TEXT,
      max_occurrences INTEGER,
      occurrences_count INTEGER NOT NULL DEFAULT 0,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      status TEXT NOT NULL DEFAULT 'active',
      next_run_at TEXT NOT NULL,
      last_run_at TEXT,
      created_at TEXT NOT NULL
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_recurring_schedules_status ON recurring_schedules(status, next_run_at);`);

  // 11. Lost & Found Items Table (for persistent lost/found tracking in SQLite)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS lost_found_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      item_date TEXT NOT NULL,
      contact_info TEXT NOT NULL,
      image_url TEXT,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_lost_found_status ON lost_found_items(status, type);`);

  // 12. Notifications Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      is_read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);`);

  // Seed default admin and initial production accounts if database is empty
  const userCountRes = await db.execute('SELECT COUNT(*) as count FROM users');
  const count = Number(userCountRes.rows[0]?.count ?? 0);
  if (count === 0) {
    console.log('[SQLite] Initializing SQLite production database...');
    const adminConfig = getConfiguredAdminConfig();
    const seedUsers = [
      {
        id: 'user_admin_zaygapig',
        name: 'Zaygapig Admin',
        username: 'zaygapiglegend88',
        email: adminConfig.email,
        password: normalizePasswordForStorage(adminConfig.password) ?? '',
        phone: '+1 (555) 999-8877',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        bio: 'Official Admin Dashboard Administrator',
        role: 'admin',
        online_status: 'online',
        last_seen: new Date().toISOString(),
        privacy: JSON.stringify({ showOnline: true, showLastSeen: true, showReadReceipts: true }),
        blocked_user_ids: JSON.stringify([]),
        contacts: JSON.stringify(['user_alex', 'user_sarah', 'user_marcus', 'user_elena', 'user_david']),
        is_suspended: 0,
        is_banned: 0,
        is_verified: 1,
        warnings_count: 0,
        created_at: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
      },
      {
        id: 'user_alex',
        name: 'Alex Rivera',
        username: 'alex_rivera',
        email: 'alex@example.com',
        password: 'password123',
        phone: '+1 (555) 019-2834',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        bio: 'Software Architect & Design Enthusiast 🚀 | Always up for coffee',
        role: 'admin',
        online_status: 'online',
        last_seen: new Date().toISOString(),
        privacy: JSON.stringify({ showOnline: true, showLastSeen: true, showReadReceipts: true }),
        blocked_user_ids: JSON.stringify([]),
        contacts: JSON.stringify(['user_sarah', 'user_marcus', 'user_elena', 'user_david', 'user_maya']),
        is_suspended: 0,
        is_banned: 0,
        is_verified: 1,
        warnings_count: 0,
        created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      },
      {
        id: 'user_sarah',
        name: 'Sarah Chen',
        username: 'sarah_c',
        email: 'sarah@example.com',
        password: 'password123',
        phone: '+1 (555) 014-9921',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        bio: 'Product Lead @ TechCorp | Plant mom 🌱',
        role: 'user',
        online_status: 'online',
        last_seen: new Date().toISOString(),
        privacy: JSON.stringify({ showOnline: true, showLastSeen: true, showReadReceipts: true }),
        blocked_user_ids: JSON.stringify([]),
        contacts: JSON.stringify(['user_alex', 'user_marcus', 'user_elena']),
        is_suspended: 0,
        is_banned: 0,
        is_verified: 0,
        warnings_count: 0,
        created_at: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
      },
      {
        id: 'user_marcus',
        name: 'Marcus Vance',
        username: 'marcus_v',
        email: 'marcus@example.com',
        password: 'password123',
        phone: '+1 (555) 018-3344',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        bio: 'Mobile Dev | Running & Cycling 🚲',
        role: 'user',
        online_status: 'away',
        last_seen: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        privacy: JSON.stringify({ showOnline: true, showLastSeen: true, showReadReceipts: true }),
        blocked_user_ids: JSON.stringify([]),
        contacts: JSON.stringify(['user_alex', 'user_sarah', 'user_david']),
        is_suspended: 0,
        is_banned: 0,
        is_verified: 0,
        warnings_count: 0,
        created_at: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
      },
      {
        id: 'user_elena',
        name: 'Elena Rostova',
        username: 'elena_r',
        email: 'elena@example.com',
        password: 'password123',
        phone: '+1 (555) 012-7788',
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
        bio: 'UX Researcher & Creative Director 🎨',
        role: 'user',
        online_status: 'offline',
        last_seen: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        privacy: JSON.stringify({ showOnline: true, showLastSeen: true, showReadReceipts: true }),
        blocked_user_ids: JSON.stringify([]),
        contacts: JSON.stringify(['user_alex', 'user_sarah', 'user_maya']),
        is_suspended: 0,
        is_banned: 0,
        is_verified: 0,
        warnings_count: 0,
        created_at: new Date(Date.now() - 18 * 24 * 3600 * 1000).toISOString(),
      },
      {
        id: 'user_david',
        name: 'David Kim',
        username: 'david_k',
        email: 'david@example.com',
        password: 'password123',
        phone: '+1 (555) 016-5544',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        bio: 'Backend Infrastructure Specialist ⚙️',
        role: 'user',
        online_status: 'online',
        last_seen: new Date().toISOString(),
        privacy: JSON.stringify({ showOnline: true, showLastSeen: true, showReadReceipts: true }),
        blocked_user_ids: JSON.stringify([]),
        contacts: JSON.stringify(['user_alex', 'user_marcus']),
        is_suspended: 0,
        is_banned: 0,
        is_verified: 0,
        warnings_count: 0,
        created_at: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
      },
      {
        id: 'user_maya',
        name: 'Maya Patel',
        username: 'maya_p',
        email: 'maya@example.com',
        password: 'password123',
        phone: '+1 (555) 011-4433',
        avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
        bio: 'Data Scientist & AI Researcher 🤖',
        role: 'user',
        online_status: 'offline',
        last_seen: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
        privacy: JSON.stringify({ showOnline: true, showLastSeen: true, showReadReceipts: true }),
        blocked_user_ids: JSON.stringify([]),
        contacts: JSON.stringify(['user_alex', 'user_elena']),
        is_suspended: 0,
        is_banned: 0,
        is_verified: 0,
        warnings_count: 0,
        created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
      },
    ];

    for (const u of seedUsers) {
      await db.execute({
        sql: `INSERT INTO users (
          id, name, username, email, password, phone, avatar, bio, role,
          online_status, last_seen, privacy, blocked_user_ids, contacts,
          is_suspended, is_banned, is_verified, warnings_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          u.id, u.name, u.username, u.email, u.password, u.phone, u.avatar, u.bio, u.role,
          u.online_status, u.last_seen, u.privacy, u.blocked_user_ids, u.contacts,
          u.is_suspended, u.is_banned, u.is_verified, u.warnings_count, u.created_at
        ],
      });
    }

    // Seed conversations
    const seedConvs = [
      {
        id: 'conv_alex_sarah',
        type: 'private',
        name: null,
        avatar: null,
        description: null,
        created_by_id: 'user_alex',
        member_ids: JSON.stringify(['user_alex', 'user_sarah']),
        group_admins: JSON.stringify([]),
        pinned_user_ids: JSON.stringify(['user_alex']),
        archived_user_ids: JSON.stringify([]),
        muted_user_ids: JSON.stringify([]),
        unread_counts: JSON.stringify({ user_alex: 0, user_sarah: 1 }),
        permissions: JSON.stringify({ sendMessages: 'all', editInfo: 'all', addMembers: 'all' }),
        created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
      {
        id: 'conv_alex_marcus',
        type: 'private',
        name: null,
        avatar: null,
        description: null,
        created_by_id: 'user_alex',
        member_ids: JSON.stringify(['user_alex', 'user_marcus']),
        group_admins: JSON.stringify([]),
        pinned_user_ids: JSON.stringify([]),
        archived_user_ids: JSON.stringify([]),
        muted_user_ids: JSON.stringify([]),
        unread_counts: JSON.stringify({ user_alex: 0, user_marcus: 0 }),
        permissions: JSON.stringify({ sendMessages: 'all', editInfo: 'all', addMembers: 'all' }),
        created_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      },
      {
        id: 'conv_product_team',
        type: 'group',
        name: '🚀 Product Launch Team',
        avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80',
        description: 'Official group for coordinating the Q3 product release and sprint deliverables.',
        created_by_id: 'user_alex',
        member_ids: JSON.stringify(['user_alex', 'user_sarah', 'user_marcus', 'user_elena', 'user_david']),
        group_admins: JSON.stringify(['user_alex', 'user_sarah']),
        pinned_user_ids: JSON.stringify(['user_alex']),
        archived_user_ids: JSON.stringify([]),
        muted_user_ids: JSON.stringify([]),
        unread_counts: JSON.stringify({ user_alex: 0, user_sarah: 0, user_marcus: 2 }),
        permissions: JSON.stringify({ sendMessages: 'all', editInfo: 'admins', addMembers: 'admins' }),
        created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      },
      {
        id: 'conv_alex_elena',
        type: 'private',
        name: null,
        avatar: null,
        description: null,
        created_by_id: 'user_alex',
        member_ids: JSON.stringify(['user_alex', 'user_elena']),
        group_admins: JSON.stringify([]),
        pinned_user_ids: JSON.stringify([]),
        archived_user_ids: JSON.stringify([]),
        muted_user_ids: JSON.stringify([]),
        unread_counts: JSON.stringify({ user_alex: 0, user_elena: 0 }),
        permissions: JSON.stringify({ sendMessages: 'all', editInfo: 'all', addMembers: 'all' }),
        created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      },
    ];

    for (const c of seedConvs) {
      await db.execute({
        sql: `INSERT INTO conversations (
          id, type, name, avatar, description, created_by_id, member_ids,
          group_admins, pinned_user_ids, archived_user_ids, muted_user_ids,
          unread_counts, permissions, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          c.id, c.type, c.name, c.avatar, c.description, c.created_by_id,
          c.member_ids, c.group_admins, c.pinned_user_ids, c.archived_user_ids,
          c.muted_user_ids, c.unread_counts, c.permissions, c.created_at, c.updated_at
        ],
      });
    }

    // Seed messages
    const seedMsgs = [
      {
        id: 'msg_1',
        conversation_id: 'conv_alex_sarah',
        sender_id: 'user_sarah',
        sender_name: 'Sarah Chen',
        sender_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        type: 'text',
        text: 'Hey Alex! Have you reviewed the final Figma mocks for the new dashboard layout?',
        status: 'read',
        read_by: JSON.stringify({ user_alex: new Date().toISOString() }),
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg_2',
        conversation_id: 'conv_alex_sarah',
        sender_id: 'user_alex',
        sender_name: 'Alex Rivera',
        sender_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        type: 'text',
        text: 'Yes! They look fantastic. The clean typography and responsive side panel really streamline navigation.',
        status: 'read',
        read_by: JSON.stringify({ user_sarah: new Date().toISOString() }),
        reactions: JSON.stringify({ '❤️': ['user_sarah'], '👍': ['user_sarah'] }),
        created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg_3',
        conversation_id: 'conv_alex_sarah',
        sender_id: 'user_alex',
        sender_name: 'Alex Rivera',
        sender_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        type: 'text',
        text: 'Check out this design reference article when you get a chance: https://tailwindcss.com',
        link_preview: JSON.stringify({
          url: 'https://tailwindcss.com',
          title: 'Tailwind CSS - Rapidly build modern websites without ever leaving your HTML',
          description: 'A utility-first CSS framework packed with classes that can be composed to build any design.',
          domain: 'tailwindcss.com',
          image: 'https://tailwindcss.com/_next/static/media/social-square.b62d04a5.png',
        }),
        status: 'read',
        created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg_4',
        conversation_id: 'conv_alex_sarah',
        sender_id: 'user_sarah',
        sender_name: 'Sarah Chen',
        sender_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        type: 'text',
        text: "Awesome! I'm scheduling the release sync for tomorrow morning at 10 AM. Will Marcus and Elena be joining?",
        status: 'read',
        created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg_group_1',
        conversation_id: 'conv_product_team',
        sender_id: 'user_alex',
        sender_name: 'Alex Rivera',
        sender_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        type: 'system',
        text: 'Alex Rivera created group "🚀 Product Launch Team"',
        status: 'read',
        created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
      },
      {
        id: 'msg_group_2',
        conversation_id: 'conv_product_team',
        sender_id: 'user_sarah',
        sender_name: 'Sarah Chen',
        sender_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        type: 'text',
        text: 'Welcome team! Here are the architecture guidelines and milestone checklists for this sprint.',
        status: 'read',
        created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      },
      {
        id: 'msg_group_3',
        conversation_id: 'conv_product_team',
        sender_id: 'user_marcus',
        sender_name: 'Marcus Vance',
        sender_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        type: 'text',
        text: 'Mobile components are 90% wired up. Real-time WebSockets & SQLite persistence are working smooth as butter! 🚀',
        reactions: JSON.stringify({ '🔥': ['user_alex', 'user_sarah', 'user_elena'] }),
        status: 'read',
        created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      },
    ];

    for (const m of seedMsgs) {
      await db.execute({
        sql: `INSERT INTO messages (
          id, conversation_id, sender_id, sender_name, sender_avatar, type, text,
          link_preview, reactions, status, read_by, starred_by, deleted_for,
          deleted_for_everyone, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          m.id, m.conversation_id, m.sender_id, m.sender_name, m.sender_avatar,
          m.type, m.text, (m as any).link_preview || null, (m as any).reactions || '{}',
          m.status, (m as any).read_by || '{}', '[]', '[]', 0, m.created_at
        ],
      });
    }

    // Seed activity logs
    await db.execute({
      sql: `INSERT INTO system_activity_logs (id, type, description, user_id, user_name, timestamp) VALUES
        (?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?)`,
      args: [
        'log_1', 'user_registered', '👤 New user registered: David Kim (david_k)', 'user_david', 'David Kim', new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        'log_2', 'account_verified', '✓ Account verified: Alex Rivera (alex_rivera)', 'user_alex', 'Alex Rivera', new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        'log_3', 'user_registered', '👤 New user registered: Zaygapig Admin', 'user_admin_zaygapig', 'Zaygapig Admin', new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
      ],
    });

    // Seed initial statuses
    await db.execute({
      sql: `INSERT INTO user_statuses (id, user_id, user_name, user_avatar, type, content, caption, bg_color, duration, reactions, created_at, expires_at) VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'status_alex_1', 'user_alex', 'Alex Rivera', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        'text', 'Building new features on ChatSphere with SQLite persistence! 🚀✨', null, 'from-blue-600 to-indigo-700', null, '{}',
        new Date(Date.now() - 2 * 3600 * 1000).toISOString(), new Date(Date.now() + 22 * 3600 * 1000).toISOString(),

        'status_sarah_1', 'user_sarah', 'Sarah Chen', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        'image', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80', 'Team dinner after productive sprint! 🍕🍷', null, null, '{}',
        new Date(Date.now() - 5 * 3600 * 1000).toISOString(), new Date(Date.now() + 19 * 3600 * 1000).toISOString(),
      ],
    });
  }
}

// ==========================================
// REPOSITORIES / DATA-ACCESS LAYER (SQLITE)
// ==========================================

// 1. User Repository
export const userRepo = {
  async getAll(excludeBlockedForUserId?: string): Promise<User[]> {
    const res = await db.execute('SELECT * FROM users ORDER BY created_at DESC');
    const list = res.rows.map(mapUserRow);
    if (excludeBlockedForUserId) {
      const current = list.find((u) => u.id === excludeBlockedForUserId);
      if (current?.blockedUserIds && current.blockedUserIds.length > 0) {
        return list.filter((u) => !current.blockedUserIds?.includes(u.id));
      }
    }
    return list;
  },

  async getById(id: string): Promise<User | null> {
    const res = await db.execute({
      sql: 'SELECT * FROM users WHERE id = ? LIMIT 1',
      args: [id],
    });
    if (res.rows.length === 0) return null;
    return mapUserRow(res.rows[0]);
  },

  async getByEmail(email: string): Promise<User | null> {
    const res = await db.execute({
      sql: 'SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
      args: [email.trim()],
    });
    if (res.rows.length === 0) return null;
    return mapUserRow(res.rows[0]);
  },

  async getByUsername(username: string): Promise<User | null> {
    const res = await db.execute({
      sql: 'SELECT * FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1',
      args: [username.trim()],
    });
    if (res.rows.length === 0) return null;
    return mapUserRow(res.rows[0]);
  },

  async findByIdentity(identity: string): Promise<User | null> {
    const clean = identity.trim().toLowerCase();
    const res = await db.execute({
      sql: 'SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1',
      args: [clean, clean],
    });
    if (res.rows.length === 0) return null;
    return mapUserRow(res.rows[0]);
  },

  async create(user: User): Promise<User> {
    const nextUser: User = {
      ...user,
      password: normalizePasswordForStorage(user.password) ?? undefined,
      username: (user.username || '').toLowerCase(),
      email: (user.email || '').toLowerCase(),
    };

    await db.execute({
      sql: `INSERT INTO users (
        id, name, username, email, password, phone, avatar, bio, role,
        online_status, last_seen, privacy, blocked_user_ids, contacts,
        is_suspended, is_banned, is_verified, warnings_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        nextUser.id,
        nextUser.name ?? '',
        nextUser.username ?? '',
        nextUser.email ?? '',
        nextUser.password ?? null,
        nextUser.phone ?? null,
        nextUser.avatar ?? '',
        nextUser.bio ?? '',
        nextUser.role ?? 'user',
        nextUser.onlineStatus ?? 'offline',
        nextUser.lastSeen ?? new Date().toISOString(),
        JSON.stringify(nextUser.privacy ?? { showOnline: true, showLastSeen: true, showReadReceipts: true }),
        JSON.stringify(nextUser.blockedUserIds || []),
        JSON.stringify(nextUser.contacts || []),
        nextUser.isSuspended ? 1 : 0,
        nextUser.isBanned ? 1 : 0,
        nextUser.isVerified ? 1 : 0,
        nextUser.warningsCount ?? 0,
        nextUser.createdAt ?? new Date().toISOString(),
      ],
    });
    return (await this.getById(nextUser.id))!;
  },

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    // Filter out undefined keys so we never overwrite defined attributes with undefined
    const cleanUpdates: Partial<User> = {};
    for (const key of Object.keys(updates) as (keyof User)[]) {
      if (updates[key] !== undefined) {
        if (key === 'password' && updates.password) {
          (cleanUpdates as any)[key] = normalizePasswordForStorage(updates.password) || undefined;
        } else {
          (cleanUpdates as any)[key] = updates[key];
        }
      }
    }

    const merged = { ...existing, ...cleanUpdates };
    await db.execute({
      sql: `UPDATE users SET
        name = ?, username = ?, email = ?, password = ?, phone = ?, avatar = ?, bio = ?,
        role = ?, online_status = ?, last_seen = ?, privacy = ?, blocked_user_ids = ?,
        contacts = ?, is_suspended = ?, is_banned = ?, is_verified = ?, warnings_count = ?
      WHERE id = ?`,
      args: [
        merged.name ?? '',
        merged.username ?? '',
        merged.email ?? '',
        merged.password ?? null,
        merged.phone ?? null,
        merged.avatar ?? '',
        merged.bio ?? '',
        merged.role ?? 'user',
        merged.onlineStatus ?? 'offline',
        merged.lastSeen ?? new Date().toISOString(),
        JSON.stringify(merged.privacy ?? { showOnline: true, showLastSeen: true, showReadReceipts: true }),
        JSON.stringify(merged.blockedUserIds || []),
        JSON.stringify(merged.contacts || []),
        merged.isSuspended ? 1 : 0,
        merged.isBanned ? 1 : 0,
        merged.isVerified ? 1 : 0,
        merged.warningsCount ?? 0,
        id,
      ],
    });
    return (await this.getById(id))!;
  },

  async delete(id: string): Promise<boolean> {
    const res = await db.execute({
      sql: 'DELETE FROM users WHERE id = ?',
      args: [id],
    });
    return res.rowsAffected > 0;
  },

  async setOnlineStatus(id: string, status: 'online' | 'offline' | 'away'): Promise<void> {
    await db.execute({
      sql: 'UPDATE users SET online_status = ?, last_seen = ? WHERE id = ?',
      args: [status, new Date().toISOString(), id],
    });
  },

  async toggleBlock(userId: string, targetUserId: string): Promise<string[]> {
    const user = await this.getById(userId);
    if (!user) return [];
    let list = user.blockedUserIds || [];
    if (list.includes(targetUserId)) {
      list = list.filter((id) => id !== targetUserId);
    } else {
      list.push(targetUserId);
    }
    await this.update(userId, { blockedUserIds: list });
    return list;
  },

  async updateContacts(userId: string, contactUserId: string, action: 'add' | 'remove'): Promise<string[]> {
    const user = await this.getById(userId);
    if (!user) return [];
    let list = user.contacts || [];
    if (action === 'add' && !list.includes(contactUserId)) {
      list.push(contactUserId);
    } else if (action === 'remove') {
      list = list.filter((id) => id !== contactUserId);
    }
    await this.update(userId, { contacts: list });
    return list;
  },
};

// 2. OTP Repository
export const otpRepo = {
  async saveOtp(email: string, otp: string, expiresAt: number): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    await db.execute({
      sql: `INSERT INTO otp_codes (email, otp, expires_at, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET otp = excluded.otp, expires_at = excluded.expires_at, created_at = excluded.created_at`,
      args: [cleanEmail, otp, expiresAt, new Date().toISOString()],
    });
  },

  async getOtp(email: string): Promise<{ otp: string; expiresAt: number } | null> {
    const cleanEmail = email.trim().toLowerCase();
    const res = await db.execute({
      sql: 'SELECT * FROM otp_codes WHERE email = ? LIMIT 1',
      args: [cleanEmail],
    });
    if (res.rows.length === 0) return null;
    return {
      otp: String(res.rows[0].otp),
      expiresAt: Number(res.rows[0].expires_at),
    };
  },

  async deleteOtp(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    await db.execute({
      sql: 'DELETE FROM otp_codes WHERE email = ?',
      args: [cleanEmail],
    });
  },
};

// 3. Message Repository
export const messageRepo = {
  async getByConversation(convId: string, forUserId?: string): Promise<Message[]> {
    const res = await db.execute({
      sql: 'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      args: [convId],
    });
    let list = res.rows.map(mapMessageRow);
    if (forUserId) {
      list = list.filter((m) => !m.deletedFor || !m.deletedFor.includes(forUserId));
    }
    return list;
  },

  async getById(id: string): Promise<Message | null> {
    const res = await db.execute({
      sql: 'SELECT * FROM messages WHERE id = ? LIMIT 1',
      args: [id],
    });
    if (res.rows.length === 0) return null;
    return mapMessageRow(res.rows[0]);
  },

  async getLastMessageForConv(convId: string): Promise<Message | undefined> {
    const res = await db.execute({
      sql: 'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1',
      args: [convId],
    });
    if (res.rows.length === 0) return undefined;
    return mapMessageRow(res.rows[0]);
  },

  async create(msg: Message): Promise<Message> {
    await db.execute({
      sql: `INSERT INTO messages (
        id, conversation_id, sender_id, sender_name, sender_avatar,
        type, text, media_url, media_name, media_size, media_mime,
        duration, reply_to_message_id, reply_to_preview, link_preview,
        reactions, status, read_by, starred_by, deleted_for, deleted_for_everyone,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        msg.id,
        msg.conversationId,
        msg.senderId,
        msg.senderName,
        msg.senderAvatar,
        msg.type || 'text',
        msg.text || '',
        msg.mediaUrl || null,
        msg.mediaName || null,
        msg.mediaSize || null,
        msg.mediaMime || null,
        msg.duration || null,
        msg.replyToMessageId || null,
        msg.replyToPreview ? JSON.stringify(msg.replyToPreview) : null,
        msg.linkPreview ? JSON.stringify(msg.linkPreview) : null,
        JSON.stringify(msg.reactions || {}),
        msg.status || 'delivered',
        JSON.stringify(msg.readBy || {}),
        JSON.stringify(msg.starredBy || []),
        JSON.stringify(msg.deletedFor || []),
        msg.deletedForEveryone ? 1 : 0,
        msg.createdAt || new Date().toISOString(),
      ],
    });
    return (await this.getById(msg.id))!;
  },

  async updateReactions(id: string, reactions: Record<string, string[]>): Promise<void> {
    await db.execute({
      sql: 'UPDATE messages SET reactions = ? WHERE id = ?',
      args: [JSON.stringify(reactions), id],
    });
  },

  async toggleStar(id: string, userId: string): Promise<string[]> {
    const msg = await this.getById(id);
    if (!msg) return [];
    let starred = msg.starredBy || [];
    if (starred.includes(userId)) {
      starred = starred.filter((u) => u !== userId);
    } else {
      starred.push(userId);
    }
    await db.execute({
      sql: 'UPDATE messages SET starred_by = ? WHERE id = ?',
      args: [JSON.stringify(starred), id],
    });
    return starred;
  },

  async deleteForEveryone(id: string): Promise<void> {
    await db.execute({
      sql: 'UPDATE messages SET deleted_for_everyone = 1, text = ?, media_url = NULL WHERE id = ?',
      args: ['This message was deleted', id],
    });
  },

  async deleteForUser(id: string, userId: string): Promise<void> {
    const msg = await this.getById(id);
    if (!msg) return;
    const deletedFor = msg.deletedFor || [];
    if (!deletedFor.includes(userId)) {
      deletedFor.push(userId);
    }
    await db.execute({
      sql: 'UPDATE messages SET deleted_for = ? WHERE id = ?',
      args: [JSON.stringify(deletedFor), id],
    });
  },

  async markAsRead(convId: string, userId: string): Promise<void> {
    const nowISO = new Date().toISOString();
    const res = await db.execute({
      sql: 'SELECT * FROM messages WHERE conversation_id = ? AND sender_id != ? AND status != ?',
      args: [convId, userId, 'read'],
    });

    for (const row of res.rows) {
      const msg = mapMessageRow(row);
      const readBy = msg.readBy || {};
      readBy[userId] = nowISO;
      await db.execute({
        sql: 'UPDATE messages SET status = ?, read_by = ? WHERE id = ?',
        args: ['read', JSON.stringify(readBy), msg.id],
      });
    }
  },

  async countByUser(userId: string): Promise<number> {
    const res = await db.execute({
      sql: 'SELECT COUNT(*) as cnt FROM messages WHERE sender_id = ?',
      args: [userId],
    });
    return Number(res.rows[0]?.cnt ?? 0);
  },
};

// 4. Conversation Repository
export const conversationRepo = {
  async getUserConversations(userId: string): Promise<Conversation[]> {
    const res = await db.execute('SELECT * FROM conversations ORDER BY updated_at DESC');
    const allConvs = res.rows.map((row) => mapConversationRow(row));
    const userConvs = allConvs.filter((c) => c.memberIds.includes(userId));

    for (const conv of userConvs) {
      conv.lastMessage = await messageRepo.getLastMessageForConv(conv.id);
    }

    return userConvs;
  },

  async getById(id: string): Promise<Conversation | null> {
    const res = await db.execute({
      sql: 'SELECT * FROM conversations WHERE id = ? LIMIT 1',
      args: [id],
    });
    if (res.rows.length === 0) return null;
    const conv = mapConversationRow(res.rows[0]);
    conv.lastMessage = await messageRepo.getLastMessageForConv(conv.id);
    return conv;
  },

  async findPrivate(userA: string, userB: string): Promise<Conversation | null> {
    const res = await db.execute("SELECT * FROM conversations WHERE type = 'private'");
    for (const row of res.rows) {
      const conv = mapConversationRow(row);
      if (conv.memberIds.length === 2 && conv.memberIds.includes(userA) && conv.memberIds.includes(userB)) {
        conv.lastMessage = await messageRepo.getLastMessageForConv(conv.id);
        return conv;
      }
    }
    return null;
  },

  async create(conv: Conversation): Promise<Conversation> {
    await db.execute({
      sql: `INSERT INTO conversations (
        id, type, name, avatar, description, created_by_id, member_ids,
        group_admins, pinned_user_ids, archived_user_ids, muted_user_ids,
        unread_counts, permissions, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        conv.id,
        conv.type,
        conv.name || null,
        conv.avatar || null,
        conv.description || null,
        conv.createdById,
        JSON.stringify(conv.memberIds),
        JSON.stringify(conv.groupAdmins || []),
        JSON.stringify(conv.pinnedUserIds || []),
        JSON.stringify(conv.archivedUserIds || []),
        JSON.stringify(conv.mutedUserIds || []),
        JSON.stringify(conv.unreadCounts || {}),
        JSON.stringify(conv.permissions || { sendMessages: 'all', editInfo: 'all', addMembers: 'all' }),
        conv.createdAt || new Date().toISOString(),
        conv.updatedAt || new Date().toISOString(),
      ],
    });
    return (await this.getById(conv.id))!;
  },

  async update(conv: Conversation): Promise<Conversation> {
    await db.execute({
      sql: `UPDATE conversations SET
        name = ?, avatar = ?, description = ?, member_ids = ?, group_admins = ?,
        pinned_user_ids = ?, archived_user_ids = ?, muted_user_ids = ?,
        unread_counts = ?, permissions = ?, updated_at = ?
      WHERE id = ?`,
      args: [
        conv.name || null,
        conv.avatar || null,
        conv.description || null,
        JSON.stringify(conv.memberIds),
        JSON.stringify(conv.groupAdmins || []),
        JSON.stringify(conv.pinnedUserIds || []),
        JSON.stringify(conv.archivedUserIds || []),
        JSON.stringify(conv.mutedUserIds || []),
        JSON.stringify(conv.unreadCounts || {}),
        JSON.stringify(conv.permissions || {}),
        conv.updatedAt || new Date().toISOString(),
        conv.id,
      ],
    });
    return (await this.getById(conv.id))!;
  },

  async resetUnreadCount(convId: string, userId: string): Promise<void> {
    const conv = await this.getById(convId);
    if (!conv) return;
    conv.unreadCounts[userId] = 0;
    await this.update(conv);
  },

  async incrementUnreadCounts(convId: string, senderId: string): Promise<void> {
    const conv = await this.getById(convId);
    if (!conv) return;
    conv.memberIds.forEach((mId) => {
      if (mId !== senderId) {
        conv.unreadCounts[mId] = (conv.unreadCounts[mId] || 0) + 1;
      }
    });
    conv.updatedAt = new Date().toISOString();
    await this.update(conv);
  },
};

// 5. Friend Request Repository
export const friendRequestRepo = {
  async getForUser(userId: string): Promise<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }> {
    const res = await db.execute('SELECT * FROM friend_requests ORDER BY created_at DESC');
    const all = res.rows.map(mapFriendRequestRow);
    const incoming = all.filter((r) => r.receiverId === userId && r.status === 'pending');
    const outgoing = all.filter((r) => r.senderId === userId);
    return { incoming, outgoing };
  },

  async getById(id: string): Promise<FriendRequest | null> {
    const res = await db.execute({
      sql: 'SELECT * FROM friend_requests WHERE id = ? LIMIT 1',
      args: [id],
    });
    if (res.rows.length === 0) return null;
    return mapFriendRequestRow(res.rows[0]);
  },

  async findPending(senderId: string, receiverId: string): Promise<FriendRequest | null> {
    const res = await db.execute({
      sql: `SELECT * FROM friend_requests
        WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
        AND status = 'pending' LIMIT 1`,
      args: [senderId, receiverId, receiverId, senderId],
    });
    if (res.rows.length === 0) return null;
    return mapFriendRequestRow(res.rows[0]);
  },

  async create(req: FriendRequest): Promise<FriendRequest> {
    await db.execute({
      sql: `INSERT INTO friend_requests (
        id, sender_id, sender_name, sender_username, sender_avatar,
        sender_bio, sender_email, receiver_id, receiver_name,
        receiver_avatar, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        req.id,
        req.senderId,
        req.senderName,
        req.senderUsername,
        req.senderAvatar,
        req.senderBio || null,
        req.senderEmail || null,
        req.receiverId,
        req.receiverName,
        req.receiverAvatar,
        req.status || 'pending',
        req.createdAt || new Date().toISOString(),
      ],
    });
    return (await this.getById(req.id))!;
  },

  async updateStatus(id: string, status: 'accepted' | 'denied'): Promise<FriendRequest | null> {
    await db.execute({
      sql: 'UPDATE friend_requests SET status = ? WHERE id = ?',
      args: [status, id],
    });
    return await this.getById(id);
  },
};

// 6. User Statuses Repository
export const statusRepo = {
  async getActive(): Promise<UserStatus[]> {
    const nowISO = new Date().toISOString();
    const res = await db.execute({
      sql: `SELECT s.*, 
            (SELECT COUNT(*) FROM status_comments WHERE status_id = s.id) as comments_count,
            u.avatar as live_avatar,
            u.name as live_name,
            u.username as live_username,
            u.is_verified as live_verified
            FROM user_statuses s
            LEFT JOIN users u ON s.user_id = u.id
            WHERE s.expires_at > ?
            ORDER BY s.created_at DESC`,
      args: [nowISO],
    });

    return res.rows.map((row: any) => {
      const status = mapUserStatusRow(row);
      // Use live user metadata if available
      if (row.live_name) status.userName = String(row.live_name);
      if (row.live_avatar) status.userAvatar = String(row.live_avatar);
      if (row.live_username) status.userUsername = String(row.live_username);
      if (row.live_verified !== undefined) status.userIsVerified = Boolean(row.live_verified);
      return status;
    });
  },

  async getById(id: string): Promise<UserStatus | null> {
    const res = await db.execute({
      sql: `SELECT s.*, 
            (SELECT COUNT(*) FROM status_comments WHERE status_id = s.id) as comments_count,
            u.avatar as live_avatar,
            u.name as live_name,
            u.username as live_username,
            u.is_verified as live_verified
            FROM user_statuses s
            LEFT JOIN users u ON s.user_id = u.id
            WHERE s.id = ? LIMIT 1`,
      args: [id],
    });
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    const status = mapUserStatusRow(row);
    if (row.live_name) status.userName = String(row.live_name);
    if (row.live_avatar) status.userAvatar = String(row.live_avatar);
    if (row.live_username) status.userUsername = String(row.live_username);
    if (row.live_verified !== undefined) status.userIsVerified = Boolean(row.live_verified);

    // Attach comments and reactions
    status.comments = await statusCommentRepo.getByStatusId(id);
    status.reactionsList = await statusReactionRepo.getByStatusId(id);
    status.commentsCount = status.comments.length;

    return status;
  },

  async getByUserId(userId: string): Promise<UserStatus[]> {
    const nowISO = new Date().toISOString();
    const res = await db.execute({
      sql: `SELECT s.*, 
            (SELECT COUNT(*) FROM status_comments WHERE status_id = s.id) as comments_count
            FROM user_statuses s
            WHERE s.user_id = ? AND s.expires_at > ?
            ORDER BY s.created_at DESC`,
      args: [userId, nowISO],
    });
    return res.rows.map(mapUserStatusRow);
  },

  async create(status: UserStatus): Promise<UserStatus> {
    await db.execute({
      sql: `INSERT INTO user_statuses (
        id, user_id, user_name, user_username, user_avatar, user_is_verified,
        type, content, caption, bg_color, duration, reactions, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        status.id,
        status.userId,
        status.userName,
        status.userUsername || null,
        status.userAvatar,
        status.userIsVerified ? 1 : 0,
        status.type,
        status.content,
        status.caption || null,
        status.bgColor || null,
        status.duration || null,
        JSON.stringify(status.reactions || {}),
        status.createdAt || new Date().toISOString(),
        status.expiresAt,
      ],
    });
    return (await this.getById(status.id))!;
  },

  async delete(id: string): Promise<boolean> {
    // Delete child comments and reactions first
    await statusCommentRepo.deleteByStatusId(id);
    await statusReactionRepo.deleteByStatusId(id);

    const res = await db.execute({
      sql: 'DELETE FROM user_statuses WHERE id = ?',
      args: [id],
    });
    return res.rowsAffected > 0;
  },

  async updateReactions(id: string, reactions: Record<string, string[]>): Promise<void> {
    await db.execute({
      sql: 'UPDATE user_statuses SET reactions = ? WHERE id = ?',
      args: [JSON.stringify(reactions), id],
    });
  },
};

// 6b. Status Comments Repository (Independent per status)
export const statusCommentRepo = {
  async getByStatusId(statusId: string): Promise<StatusComment[]> {
    const res = await db.execute({
      sql: `SELECT c.*, 
            u.avatar as live_avatar,
            u.name as live_name,
            u.username as live_username,
            u.is_verified as live_verified
            FROM status_comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.status_id = ?
            ORDER BY c.created_at ASC`,
      args: [statusId],
    });
    return res.rows.map((row: any) => {
      const comment = mapStatusCommentRow(row);
      if (row.live_name) comment.userName = String(row.live_name);
      if (row.live_avatar) comment.userAvatar = String(row.live_avatar);
      if (row.live_username) comment.userUsername = String(row.live_username);
      if (row.live_verified !== undefined) comment.userIsVerified = Boolean(row.live_verified);
      return comment;
    });
  },

  async getById(id: string): Promise<StatusComment | null> {
    const res = await db.execute({
      sql: 'SELECT * FROM status_comments WHERE id = ? LIMIT 1',
      args: [id],
    });
    if (res.rows.length === 0) return null;
    return mapStatusCommentRow(res.rows[0]);
  },

  async create(comment: StatusComment): Promise<StatusComment> {
    await db.execute({
      sql: `INSERT INTO status_comments (
        id, status_id, user_id, user_name, user_username, user_avatar, user_is_verified, text, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        comment.id,
        comment.statusId,
        comment.userId,
        comment.userName,
        comment.userUsername || null,
        comment.userAvatar,
        comment.userIsVerified ? 1 : 0,
        comment.text,
        comment.createdAt || new Date().toISOString(),
      ],
    });
    return (await this.getById(comment.id))!;
  },

  async delete(id: string): Promise<boolean> {
    const res = await db.execute({
      sql: 'DELETE FROM status_comments WHERE id = ?',
      args: [id],
    });
    return res.rowsAffected > 0;
  },

  async deleteByStatusId(statusId: string): Promise<void> {
    await db.execute({
      sql: 'DELETE FROM status_comments WHERE status_id = ?',
      args: [statusId],
    });
  },
};

// 6c. Status Reactions Repository (Independent per status)
export const statusReactionRepo = {
  async getByStatusId(statusId: string): Promise<StatusReaction[]> {
    const res = await db.execute({
      sql: `SELECT r.*,
            u.avatar as live_avatar,
            u.name as live_name,
            u.username as live_username,
            u.is_verified as live_verified
            FROM status_reactions r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.status_id = ?
            ORDER BY r.created_at ASC`,
      args: [statusId],
    });
    return res.rows.map((row: any) => {
      const rx = mapStatusReactionRow(row);
      if (row.live_name) rx.userName = String(row.live_name);
      if (row.live_avatar) rx.userAvatar = String(row.live_avatar);
      if (row.live_username) rx.userUsername = String(row.live_username);
      if (row.live_verified !== undefined) rx.userIsVerified = Boolean(row.live_verified);
      return rx;
    });
  },

  async toggle(
    statusId: string,
    user: { id: string; name: string; username?: string; avatar: string; isVerified?: boolean },
    emoji: string
  ): Promise<{ reactions: Record<string, string[]>; reactionsList: StatusReaction[] }> {
    // Check if user already reacted with this exact emoji on this status
    const existing = await db.execute({
      sql: 'SELECT * FROM status_reactions WHERE status_id = ? AND user_id = ? AND emoji = ? LIMIT 1',
      args: [statusId, user.id, emoji],
    });

    if (existing.rows.length > 0) {
      // Remove reaction
      await db.execute({
        sql: 'DELETE FROM status_reactions WHERE status_id = ? AND user_id = ? AND emoji = ?',
        args: [statusId, user.id, emoji],
      });
    } else {
      // Add reaction
      const id = `srx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.execute({
        sql: `INSERT INTO status_reactions (
          id, status_id, user_id, user_name, user_username, user_avatar, user_is_verified, emoji, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          statusId,
          user.id,
          user.name,
          user.username || null,
          user.avatar,
          user.isVerified ? 1 : 0,
          emoji,
          new Date().toISOString(),
        ],
      });
    }

    // Load full reactions list for status
    const reactionsList = await this.getByStatusId(statusId);

    // Compute aggregated reactions map
    const reactions: Record<string, string[]> = {};
    reactionsList.forEach((rx) => {
      if (!reactions[rx.emoji]) {
        reactions[rx.emoji] = [];
      }
      if (!reactions[rx.emoji].includes(rx.userId)) {
        reactions[rx.emoji].push(rx.userId);
      }
    });

    // Update status cached reactions JSON
    await statusRepo.updateReactions(statusId, reactions);

    return { reactions, reactionsList };
  },

  async deleteByStatusId(statusId: string): Promise<void> {
    await db.execute({
      sql: 'DELETE FROM status_reactions WHERE status_id = ?',
      args: [statusId],
    });
  },
};

// 7. Report Repository
export const reportRepo = {
  async getAll(): Promise<ReportedMessage[]> {
    const res = await db.execute('SELECT * FROM reported_messages ORDER BY created_at DESC');
    return res.rows.map(mapReportRow);
  },

  async getById(id: string): Promise<ReportedMessage | null> {
    const res = await db.execute({
      sql: 'SELECT * FROM reported_messages WHERE id = ? LIMIT 1',
      args: [id],
    });
    if (res.rows.length === 0) return null;
    return mapReportRow(res.rows[0]);
  },

  async create(rep: ReportedMessage): Promise<ReportedMessage> {
    await db.execute({
      sql: `INSERT INTO reported_messages (
        id, message_id, message_text, sender_name, conversation_id,
        reported_by, reported_by_name, reported_user_id, reported_user_name,
        reason, status, action_taken, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        rep.id,
        rep.messageId || null,
        rep.messageText || null,
        rep.senderName || null,
        rep.conversationId || null,
        rep.reportedBy,
        rep.reportedByName,
        rep.reportedUserId,
        rep.reportedUserName,
        rep.reason,
        rep.status || 'pending',
        rep.actionTaken || null,
        rep.createdAt || new Date().toISOString(),
      ],
    });
    return (await this.getById(rep.id))!;
  },

  async update(id: string, updates: Partial<ReportedMessage>): Promise<ReportedMessage | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates };
    await db.execute({
      sql: 'UPDATE reported_messages SET status = ?, action_taken = ? WHERE id = ?',
      args: [merged.status, merged.actionTaken || null, id],
    });
    return await this.getById(id);
  },

  async countByTargetUser(userId: string): Promise<number> {
    const res = await db.execute({
      sql: 'SELECT COUNT(*) as cnt FROM reported_messages WHERE reported_user_id = ?',
      args: [userId],
    });
    return Number(res.rows[0]?.cnt ?? 0);
  },
};

// 8. Activity Log Repository
export const activityLogRepo = {
  async getAll(limit = 50): Promise<SystemActivityLog[]> {
    const res = await db.execute({
      sql: 'SELECT * FROM system_activity_logs ORDER BY timestamp DESC LIMIT ?',
      args: [limit],
    });
    return res.rows.map(mapActivityLogRow);
  },

  async create(type: SystemActivityLog['type'], description: string, userId?: string, userName?: string): Promise<SystemActivityLog> {
    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const timestamp = new Date().toISOString();
    await db.execute({
      sql: 'INSERT INTO system_activity_logs (id, type, description, user_id, user_name, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, type, description, userId || null, userName || null, timestamp],
    });
    return { id, type, description, userId, userName, timestamp };
  },
};

// 9. Scheduled Message Repository
export const scheduledMessageRepo = {
  async getByUser(userId: string): Promise<ScheduledMessage[]> {
    const res = await db.execute({
      sql: 'SELECT * FROM scheduled_messages WHERE sender_id = ? ORDER BY scheduled_at ASC',
      args: [userId],
    });
    return res.rows.map(mapScheduledMessageRow);
  },

  async getById(id: string): Promise<ScheduledMessage | null> {
    const res = await db.execute({
      sql: 'SELECT * FROM scheduled_messages WHERE id = ? LIMIT 1',
      args: [id],
    });
    if (res.rows.length === 0) return null;
    return mapScheduledMessageRow(res.rows[0]);
  },

  async getPendingDue(nowISO: string): Promise<ScheduledMessage[]> {
    const res = await db.execute({
      sql: "SELECT * FROM scheduled_messages WHERE status = 'scheduled' AND scheduled_at <= ? ORDER BY scheduled_at ASC",
      args: [nowISO],
    });
    return res.rows.map(mapScheduledMessageRow);
  },

  async create(sched: ScheduledMessage): Promise<ScheduledMessage> {
    await db.execute({
      sql: `INSERT INTO scheduled_messages (
        id, sender_id, sender_name, sender_avatar, conversation_id,
        conversation_name, type, content, media_url, media_name,
        scheduled_at, timezone, status, created_at, sent_at, cancelled_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        sched.id,
        sched.senderId,
        sched.senderName,
        sched.senderAvatar,
        sched.conversationId,
        sched.conversationName || null,
        sched.type || 'text',
        sched.content,
        sched.mediaUrl || null,
        sched.mediaName || null,
        sched.scheduledAt,
        sched.timezone || 'UTC',
        sched.status || 'scheduled',
        sched.createdAt || new Date().toISOString(),
        sched.sentAt || null,
        sched.cancelledAt || null,
      ],
    });
    return (await this.getById(sched.id))!;
  },

  async update(id: string, updates: Partial<ScheduledMessage>): Promise<ScheduledMessage | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates };
    await db.execute({
      sql: 'UPDATE scheduled_messages SET status = ?, sent_at = ?, cancelled_at = ? WHERE id = ?',
      args: [merged.status, merged.sentAt || null, merged.cancelledAt || null, id],
    });
    return await this.getById(id);
  },
};

// 10. Recurring Schedule Repository
export const recurringScheduleRepo = {
  async getByUser(userId: string): Promise<RecurringSchedule[]> {
    const res = await db.execute({
      sql: 'SELECT * FROM recurring_schedules WHERE sender_id = ? ORDER BY created_at DESC',
      args: [userId],
    });
    return res.rows.map(mapRecurringScheduleRow);
  },

  async getById(id: string): Promise<RecurringSchedule | null> {
    const res = await db.execute({
      sql: 'SELECT * FROM recurring_schedules WHERE id = ? LIMIT 1',
      args: [id],
    });
    if (res.rows.length === 0) return null;
    return mapRecurringScheduleRow(res.rows[0]);
  },

  async getActiveDue(nowISO: string): Promise<RecurringSchedule[]> {
    const res = await db.execute({
      sql: "SELECT * FROM recurring_schedules WHERE status = 'active' AND next_run_at <= ? ORDER BY next_run_at ASC",
      args: [nowISO],
    });
    return res.rows.map(mapRecurringScheduleRow);
  },

  async create(rec: RecurringSchedule): Promise<RecurringSchedule> {
    await db.execute({
      sql: `INSERT INTO recurring_schedules (
        id, sender_id, sender_name, sender_avatar, conversation_id,
        conversation_name, content, frequency, time, start_at,
        end_rule, end_at, max_occurrences, occurrences_count, timezone,
        status, next_run_at, last_run_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        rec.id,
        rec.senderId,
        rec.senderName,
        rec.senderAvatar,
        rec.conversationId,
        rec.conversationName || null,
        rec.content,
        rec.frequency,
        rec.time,
        rec.startAt,
        rec.endRule || 'never',
        rec.endAt || null,
        rec.maxOccurrences || null,
        rec.occurrencesCount || 0,
        rec.timezone || 'UTC',
        rec.status || 'active',
        rec.nextRunAt,
        rec.lastRunAt || null,
        rec.createdAt || new Date().toISOString(),
      ],
    });
    return (await this.getById(rec.id))!;
  },

  async update(id: string, updates: Partial<RecurringSchedule>): Promise<RecurringSchedule | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates };
    await db.execute({
      sql: `UPDATE recurring_schedules SET
        status = ?, next_run_at = ?, last_run_at = ?, occurrences_count = ?
      WHERE id = ?`,
      args: [merged.status, merged.nextRunAt, merged.lastRunAt || null, merged.occurrencesCount, id],
    });
    return await this.getById(id);
  },
};

// 11. Lost & Found Items Repository
export const lostFoundRepo = {
  async getAll(type?: 'lost' | 'found', status?: string): Promise<any[]> {
    let sql = 'SELECT * FROM lost_found_items';
    const args: any[] = [];
    const conditions: string[] = [];
    if (type) {
      conditions.push('type = ?');
      args.push(type);
    }
    if (status) {
      conditions.push('status = ?');
      args.push(status);
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY created_at DESC';
    const res = await db.execute({ sql, args });
    return res.rows;
  },

  async getById(id: string): Promise<any | null> {
    const res = await db.execute({
      sql: 'SELECT * FROM lost_found_items WHERE id = ? LIMIT 1',
      args: [id],
    });
    if (res.rows.length === 0) return null;
    return res.rows[0];
  },

  async create(item: any): Promise<any> {
    const id = item.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    await db.execute({
      sql: `INSERT INTO lost_found_items (
        id, type, title, description, category, location,
        item_date, contact_info, image_url, user_id, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        item.type || 'lost',
        item.title,
        item.description,
        item.category || 'General',
        item.location || 'Unknown',
        item.itemDate || now,
        item.contactInfo || '',
        item.imageUrl || null,
        item.userId,
        item.status || 'open',
        now,
        now,
      ],
    });
    return await this.getById(id);
  },

  async update(id: string, updates: any): Promise<any | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const now = new Date().toISOString();
    await db.execute({
      sql: `UPDATE lost_found_items SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        category = COALESCE(?, category),
        location = COALESCE(?, location),
        status = COALESCE(?, status),
        updated_at = ?
      WHERE id = ?`,
      args: [
        updates.title || null,
        updates.description || null,
        updates.category || null,
        updates.location || null,
        updates.status || null,
        now,
        id,
      ],
    });
    return await this.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const res = await db.execute({
      sql: 'DELETE FROM lost_found_items WHERE id = ?',
      args: [id],
    });
    return res.rowsAffected > 0;
  },
};

// 12. Notifications Repository
export const notificationRepo = {
  async getByUser(userId: string): Promise<any[]> {
    const res = await db.execute({
      sql: 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      args: [userId],
    });
    return res.rows;
  },

  async create(userId: string, title: string, message: string, type = 'info', link?: string): Promise<any> {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    await db.execute({
      sql: 'INSERT INTO notifications (id, user_id, title, message, type, is_read, link, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
      args: [id, userId, title, message, type, link || null, now],
    });
    return { id, userId, title, message, type, isRead: false, link, createdAt: now };
  },

  async markAsRead(id: string): Promise<void> {
    await db.execute({
      sql: 'UPDATE notifications SET is_read = 1 WHERE id = ?',
      args: [id],
    });
  },
};
