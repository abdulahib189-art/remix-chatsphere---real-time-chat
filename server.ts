import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import {
  User,
  Conversation,
  Message,
  ReportedMessage,
  SystemActivityLog,
  WSEvent,
  OnlineStatus,
  FriendRequest,
  UserStatus,
  StatusComment,
  StatusReaction,
  ChatStreak,
  ScheduledMessage,
  RecurringSchedule,
} from './src/types.js';
import { verifyPassword } from './src/lib/auth.js';
import {
  initDatabase,
  userRepo,
  otpRepo,
  messageRepo,
  conversationRepo,
  friendRequestRepo,
  statusRepo,
  statusCommentRepo,
  statusReactionRepo,
  reportRepo,
  activityLogRepo,
  scheduledMessageRepo,
  recurringScheduleRepo,
  lostFoundRepo,
  notificationRepo,
} from './src/db/sqlite.js';
import { sanitizeUserForClient, dataDir } from './src/db/sqlite.js';

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const BROWSER_HOST = 'localhost';
const BROWSER_ORIGIN = `http://${BROWSER_HOST}:${PORT}`;
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || 'zaygapiglegend88@gmail.com').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || 'change-me-admin-password').trim();

function isAdminUser(user?: Partial<User> | null): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.email?.toLowerCase() === ADMIN_EMAIL;
}

function isAdminEmail(email?: string): boolean {
  return !!email && email.trim().toLowerCase() === ADMIN_EMAIL;
}

async function requireAuthenticatedUser(req: any, res: any, next: any) {
  const userId = String(req.headers['x-user-id'] || '').trim();
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const user = await resolveUser(userId);
  if (!user) {
    return res.status(401).json({ error: 'Session invalid or user not found.' });
  }

  req.user = user;
  next();
}

async function requireAdminUser(req: any, res: any, next: any) {
  const userId = String(req.headers['x-user-id'] || '').trim();
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const user = await resolveUser(userId);
  if (!user) {
    return res.status(401).json({ error: 'Session invalid or user not found.' });
  }

  if (!isAdminUser(user)) {
    return res.status(403).json({ error: 'Forbidden: Admin access required.' });
  }

  req.user = user;
  next();
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Setup file uploads storage
const uploadsDir = path.join(dataDir, 'uploads');
const bundledUploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  // Seed a fresh volume with the uploads bundled in the repo.
  if (uploadsDir !== bundledUploadsDir && fs.existsSync(bundledUploadsDir)) {
    fs.cpSync(bundledUploadsDir, uploadsDir, { recursive: true });
  }
}
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

// ==========================================
// EMAIL TRANSPORTER (SMTP)
// ==========================================
const mailTransporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'abdulahibashiir145@gmail.com',
    pass: process.env.SMTP_PASS || 'xceu yynv zydm cwdg',
  },
});

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Helper to resolve user from request header without falling back to an arbitrary account
async function resolveUser(userIdHeader?: string): Promise<User | null> {
  if (!userIdHeader || !userIdHeader.trim()) return null;

  const lookup = userIdHeader.trim();
  const found =
    (await userRepo.getById(lookup)) ||
    (await userRepo.getByEmail(lookup)) ||
    (await userRepo.getByUsername(lookup));

  return found ?? null;
}

// Helper for streak calculation between two users from SQLite messages
async function calculateStreak(userAId: string, userBId: string): Promise<ChatStreak> {
  const conv = await conversationRepo.findPrivate(userAId, userBId);

  if (!conv) {
    return {
      userAId,
      userBId,
      streakCount: 0,
      lastQualifyingDate: '',
      userAMessagesToday: 0,
      userBMessagesToday: 0,
      isActiveToday: false,
    };
  }

  const convMsgs = await messageRepo.getByConversation(conv.id);
  const nonSystemMsgs = convMsgs.filter((m) => m.type !== 'system' && !m.deletedForEveryone);

  const todayStr = new Date().toISOString().slice(0, 10);
  let userAMessagesToday = 0;
  let userBMessagesToday = 0;

  const userADates = new Set<string>();
  const userBDates = new Set<string>();

  nonSystemMsgs.forEach((m) => {
    const dateStr = m.createdAt.slice(0, 10);
    if (m.senderId === userAId) {
      userADates.add(dateStr);
      if (dateStr === todayStr) userAMessagesToday++;
    } else if (m.senderId === userBId) {
      userBDates.add(dateStr);
      if (dateStr === todayStr) userBMessagesToday++;
    }
  });

  const qualifyingDates = Array.from(userADates)
    .filter((d) => userBDates.has(d))
    .sort((a, b) => b.localeCompare(a));

  const isActiveToday = qualifyingDates.includes(todayStr);

  if (qualifyingDates.length === 0) {
    return {
      userAId,
      userBId,
      streakCount: 0,
      lastQualifyingDate: '',
      userAMessagesToday,
      userBMessagesToday,
      isActiveToday: false,
    };
  }

  let streakCount = 0;
  let currentDate = new Date();
  let currentDateStr = currentDate.toISOString().slice(0, 10);

  if (!qualifyingDates.includes(currentDateStr)) {
    const yesterday = new Date(currentDate.getTime() - 86400000);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    if (!qualifyingDates.includes(yesterdayStr)) {
      return {
        userAId,
        userBId,
        streakCount: 0,
        lastQualifyingDate: qualifyingDates[0] || '',
        userAMessagesToday,
        userBMessagesToday,
        isActiveToday: false,
      };
    }
    currentDate = yesterday;
    currentDateStr = yesterdayStr;
  }

  while (qualifyingDates.includes(currentDateStr)) {
    streakCount++;
    currentDate = new Date(currentDate.getTime() - 86400000);
    currentDateStr = currentDate.toISOString().slice(0, 10);
  }

  return {
    userAId,
    userBId,
    streakCount,
    lastQualifyingDate: qualifyingDates[0],
    userAMessagesToday,
    userBMessagesToday,
    isActiveToday,
  };
}

// Helper to compute next run timestamp for recurring schedules
function computeNextRunAt(
  startAtISO: string,
  timeHHMM: string,
  frequency: 'daily' | 'weekly' | 'monthly',
  lastRunAtISO?: string
): string {
  const [targetHour, targetMin] = timeHHMM.split(':').map((n) => parseInt(n, 10) || 0);

  let baseDate = lastRunAtISO ? new Date(lastRunAtISO) : new Date(startAtISO);
  if (isNaN(baseDate.getTime())) baseDate = new Date();

  let nextDate = new Date(baseDate);

  if (lastRunAtISO) {
    if (frequency === 'daily') {
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (frequency === 'weekly') {
      nextDate.setDate(nextDate.getDate() + 7);
    } else if (frequency === 'monthly') {
      const origDay = nextDate.getDate();
      nextDate.setMonth(nextDate.getMonth() + 1);
      if (nextDate.getDate() !== origDay) {
        nextDate.setDate(0);
      }
    }
  }

  nextDate.setHours(targetHour, targetMin, 0, 0);

  const now = new Date();
  while (nextDate <= now) {
    if (frequency === 'daily') {
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (frequency === 'weekly') {
      nextDate.setDate(nextDate.getDate() + 7);
    } else if (frequency === 'monthly') {
      const origDay = nextDate.getDate();
      nextDate.setMonth(nextDate.getMonth() + 1);
      if (nextDate.getDate() !== origDay) {
        nextDate.setDate(0);
      }
    }
    nextDate.setHours(targetHour, targetMin, 0, 0);
  }

  return nextDate.toISOString();
}

// ==========================================
// WEBSOCKET BROADCASTING & PRESENCE MANAGER
// ==========================================

const wss = new WebSocketServer({ noServer: true });
const userSockets = new Map<string, Set<WebSocket>>(); // userId -> Set of WS connections

server.on('upgrade', (request, socket, head) => {
  try {
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname === '/ws' || url.pathname === '/ws/' || url.pathname.startsWith('/ws')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  } catch (err) {
    console.error('Upgrade handler error:', err);
  }
});

// Ping interval to keep connections alive through proxies
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((client: any) => {
    if (client.isAlive === false) {
      return client.terminate();
    }
    client.isAlive = false;
    client.ping();
  });
}, 25000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

function sendToUser(userId: string, event: WSEvent) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    const data = JSON.stringify(event);
    sockets.forEach((s) => {
      if (s.readyState === WebSocket.OPEN) {
        s.send(data);
      }
    });
  }
}

function broadcastToAll(event: WSEvent, excludeUserId?: string) {
  const data = JSON.stringify(event);
  userSockets.forEach((sockets, userId) => {
    if (userId === excludeUserId) return;
    sockets.forEach((s) => {
      if (s.readyState === WebSocket.OPEN) {
        s.send(data);
      }
    });
  });
}

async function broadcastToConversation(conversationId: string, event: WSEvent, excludeUserId?: string) {
  const conv = await conversationRepo.getById(conversationId);
  if (!conv) return;

  const data = JSON.stringify(event);
  conv.memberIds.forEach((memberId) => {
    if (memberId === excludeUserId) return;
    const sockets = userSockets.get(memberId);
    if (sockets) {
      sockets.forEach((s) => {
        if (s.readyState === WebSocket.OPEN) {
          s.send(data);
        }
      });
    }
  });
}

async function broadcastPresence(userId: string, status: OnlineStatus) {
  await userRepo.setOnlineStatus(userId, status);
  const nowISO = new Date().toISOString();

  broadcastToAll({
    type: 'presence_update',
    payload: { userId, status, lastSeen: nowISO },
  });
}

wss.on('connection', (ws: any) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  let authenticatedUserId: string | null = null;

  ws.on('message', async (raw: any) => {
    try {
      const event: WSEvent = JSON.parse(raw.toString());

      if (event.type === 'auth') {
        authenticatedUserId = event.payload.userId;
        if (authenticatedUserId) {
          let sockets = userSockets.get(authenticatedUserId);
          if (!sockets) {
            sockets = new Set();
            userSockets.set(authenticatedUserId, sockets);
          }
          const isFirstSocket = sockets.size === 0;
          sockets.add(ws);
          if (isFirstSocket) {
            await broadcastPresence(authenticatedUserId, 'online');
          }
        }
      } else if (event.type === 'typing_start') {
        const { conversationId, userId, userName } = event.payload;
        await broadcastToConversation(
          conversationId,
          {
            type: 'typing_start',
            payload: { conversationId, userId, userName },
          },
          userId
        );
      } else if (event.type === 'typing_stop') {
        const { conversationId, userId } = event.payload;
        await broadcastToConversation(
          conversationId,
          {
            type: 'typing_stop',
            payload: { conversationId, userId },
          },
          userId
        );
      }
    } catch (err) {
      console.error('WebSocket parse error:', err);
    }
  });

  ws.on('close', async () => {
    if (authenticatedUserId) {
      const sockets = userSockets.get(authenticatedUserId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) {
          userSockets.delete(authenticatedUserId);
          await broadcastPresence(authenticatedUserId, 'offline');
        }
      }
    }
  });

  ws.on('error', (err: any) => {
    console.warn('WebSocket client socket error:', err?.message || err);
  });
});

// Admin helper function to send notifications via SQLite
async function sendAdminNotification(
  userId: string,
  text: string,
  requestingAdminId?: string,
  customTitle?: string
) {
  const allUsers = await userRepo.getAll();
  let adminAcc = requestingAdminId
    ? allUsers.find((u) => u.id === requestingAdminId)
    : null;
  if (!adminAcc) {
    adminAcc = allUsers.find((u) => isAdminUser(u)) ?? null;
  }
  if (!adminAcc) return;

  const targetUser = await userRepo.getById(userId);
  if (!targetUser) return;

  let conv = await conversationRepo.findPrivate(adminAcc.id, userId);
  if (!conv) {
    conv = await conversationRepo.create({
      id: `conv_admin_${adminAcc.id}_${userId}`,
      type: 'private',
      createdById: adminAcc.id,
      memberIds: [adminAcc.id, userId],
      groupAdmins: [],
      pinnedUserIds: [],
      archivedUserIds: [],
      mutedUserIds: [],
      unreadCounts: { [userId]: 1 },
      permissions: { sendMessages: 'all', editInfo: 'all', addMembers: 'all' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const titlePrefix = customTitle || 'ADMIN TEAM NOTICE';
  const newMsg: Message = {
    id: `msg_admin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    conversationId: conv.id,
    senderId: adminAcc.id,
    senderName: `${adminAcc.name} (Admin Team)`,
    senderAvatar: adminAcc.avatar,
    type: 'text',
    text: `🛡️ [${titlePrefix}]: ${text}`,
    status: 'delivered',
    createdAt: new Date().toISOString(),
  };

  await messageRepo.create(newMsg);
  await conversationRepo.incrementUnreadCounts(conv.id, adminAcc.id);
  await notificationRepo.create(userId, titlePrefix, text, 'warning');

  broadcastToConversation(conv.id, { type: 'new_message', payload: newMsg });
  sendToUser(userId, {
    type: 'notification',
    payload: { title: titlePrefix, body: text, fromAdmin: true, adminName: adminAcc.name },
  });
}

// ==========================================
// REST API ENDPOINTS (SQLITE DATABASE LAYER)
// ==========================================

// Auth: Login (Strict Email Address + Password against SQLite database)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, identity, password } = req.body;
    const emailToUse = (email || identity || '').trim().toLowerCase();
    if (!emailToUse || !password) {
      return res.status(400).json({ error: 'Email address and password are required.' });
    }

    // Strictly authenticate against the real registered email in the SQLite database
    const user = await userRepo.getByEmail(emailToUse);

    if (!user) {
      return res.status(401).json({ error: 'No account found with this email address. Please check your email or sign up.' });
    }

    if (isAdminEmail(emailToUse)) {
      const adminRole = user.role === 'admin' || emailToUse === ADMIN_EMAIL;
      if (adminRole && ADMIN_PASSWORD && user.password && !verifyPassword(password, user.password)) {
        return res.status(401).json({ error: 'Incorrect admin password. Please try again.' });
      }
      if (adminRole) {
        await userRepo.update(user.id, { role: 'admin' });
        const refreshedUser = await userRepo.getById(user.id);
        if (refreshedUser) {
          refreshedUser.onlineStatus = 'online';
          await userRepo.setOnlineStatus(refreshedUser.id, 'online');
          return res.json({ user: refreshedUser, token: `token_${refreshedUser.id}` });
        }
      }
    }

    if (user.password && !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'This account has been suspended or banned. Please contact support.' });
    }

    await userRepo.setOnlineStatus(user.id, 'online');
    user.onlineStatus = 'online';

    const safeUser = sanitizeUserForClient(user);
    res.json({ user: safeUser, token: `token_${user.id}` });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Database error occurred during login.' });
  }
});

// Auth: Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    if (!name || !username || !email || !password) {
      return res.status(400).json({ error: 'Name, username, email, and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();

    if (cleanEmail === ADMIN_EMAIL) {
      return res.status(403).json({ error: 'This admin account is managed securely and cannot be registered through the public signup flow.' });
    }

    const existingEmail = await userRepo.getByEmail(cleanEmail);
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already registered. Please login or use a different email.' });
    }

    const existingUser = await userRepo.getByUsername(cleanUsername);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken. Please choose another username.' });
    }

    const newUser: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      username: cleanUsername,
      email: cleanEmail,
      password,
      avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
      bio: 'Hey there! I am using ChatSphere.',
      role: 'user',
      onlineStatus: 'online',
      lastSeen: new Date().toISOString(),
      privacy: { showOnline: true, showLastSeen: true, showReadReceipts: true },
      contacts: ['user_alex', 'user_sarah'],
      createdAt: new Date().toISOString(),
      isVerified: false,
      isSuspended: false,
      isBanned: false,
      warningsCount: 0,
    };

    const savedUser = await userRepo.create(newUser);
    await activityLogRepo.create('user_registered', `👤 New user registered: ${savedUser.name} (${savedUser.username})`, savedUser.id, savedUser.name);

    broadcastToAll({ type: 'user_registered', payload: sanitizeUserForClient(savedUser) });

    res.status(201).json({ user: sanitizeUserForClient(savedUser), token: `token_${savedUser.id}` });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Database error occurred during registration.' });
  }
});

// Auth: Send OTP for Password Reset
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await userRepo.getByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address.' });
    }

    // Generate 6-digit OTP code & store in SQLite
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

    await otpRepo.saveOtp(cleanEmail, otp, expiresAt);

    try {
      await mailTransporter.sendMail({
        from: '"ChatSphere Support" <abdulahibashiir145@gmail.com>',
        to: cleanEmail,
        subject: `${otp} - Your ChatSphere Password Reset OTP`,
        text: `Hello ${user.name},\n\nYour 6-digit password reset OTP code is: ${otp}\n\nThis code will expire in 5 minutes.\n\nIf you did not request this password reset, please ignore this email.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #cbd5e1; border-radius: 16px; background-color: #0f172a; color: #f8fafc;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #10b981; margin: 0; font-size: 22px;">ChatSphere Verification</h2>
              <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Password Reset Verification Code</p>
            </div>
            <p style="font-size: 14px; color: #e2e8f0;">Hello <strong>${user.name}</strong>,</p>
            <p style="font-size: 14px; color: #cbd5e1;">Your 6-digit OTP code to reset your password is:</p>
            <div style="text-align: center; margin: 24px 0; padding: 18px; background-color: #064e3b; border: 2px dashed #10b981; border-radius: 12px; color: #34d399; font-size: 32px; font-weight: bold; letter-spacing: 8px;">
              ${otp}
            </div>
            <div style="background-color: #1e293b; padding: 12px 16px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
              <p style="color: #fbbf24; font-size: 12px; margin: 0; font-weight: 600;">⏱️ This OTP expires in 5 minutes.</p>
            </div>
            <p style="color: #64748b; font-size: 12px; text-align: center; margin: 0;">If you did not request a password reset, you can safely ignore this message.</p>
          </div>
        `,
      });

      res.json({ success: true, message: '6-digit OTP code sent to your email.' });
    } catch (err: any) {
      console.error('SMTP Error when sending OTP:', err);
      res.status(500).json({ error: 'Failed to send OTP email via SMTP. Please verify network or try again.' });
    }
  } catch (err: any) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Database error occurred while processing OTP request.' });
  }
});

// Auth: Reset Password with OTP
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP code, and new password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    const storedOtp = await otpRepo.getOtp(cleanEmail);
    if (!storedOtp) {
      return res.status(400).json({ error: 'No OTP code found for this email. Please request a new code.' });
    }

    if (Date.now() > storedOtp.expiresAt) {
      await otpRepo.deleteOtp(cleanEmail);
      return res.status(400).json({ error: 'OTP code has expired (5 minute limit). Please request a new code.' });
    }

    if (storedOtp.otp !== cleanOtp) {
      return res.status(400).json({ error: 'Wrong OTP code! Password reset rejected.' });
    }

    const user = await userRepo.getByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    await userRepo.update(user.id, { password: newPassword });
    await otpRepo.deleteOtp(cleanEmail); // Clear OTP after successful reset

    res.json({ success: true, message: 'Password updated successfully! You can now log in.' });
  } catch (err: any) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Database error occurred during password reset.' });
  }
});

app.post('/api/auth/password', (req, res) => {
  res.json({ success: true, message: 'Password updated successfully.' });
});

// Users REST
app.get('/api/users', async (req, res) => {
  try {
    const currentUserId = req.headers['x-user-id'] as string;
    const result = await userRepo.getAll(currentUserId);
    const visibleUsers = result
      .filter((u) => u.role !== 'admin' && u.id !== currentUserId)
      .map((u) => sanitizeUserForClient(u));
    res.json(visibleUsers);
  } catch (err: any) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to retrieve users from SQLite database.' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await userRepo.getById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(sanitizeUserForClient(user));
  } catch (err: any) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Database error retrieving user.' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const updates: Partial<User> = {};
    const allowedKeys: (keyof User)[] = [
      'name',
      'username',
      'email',
      'bio',
      'avatar',
      'phone',
      'privacy',
      'onlineStatus',
      'lastSeen',
      'role',
      'isVerified',
      'isSuspended',
      'isBanned',
      'warningsCount',
    ];
    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        (updates as any)[key] = req.body[key];
      }
    }

    const updated = await userRepo.update(req.params.id, updates);
    if (!updated) return res.status(404).json({ error: 'User not found' });

    broadcastToAll({ type: 'user_updated', payload: sanitizeUserForClient(updated) });

    res.json(sanitizeUserForClient(updated));
  } catch (err: any) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user in SQLite database.' });
  }
});

app.post('/api/users/:id/block', async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const blockedList = await userRepo.toggleBlock(req.params.id, targetUserId);
    const updatedUser = await userRepo.getById(req.params.id);
    if (updatedUser) {
      broadcastToAll({ type: 'user_updated', payload: updatedUser });
    }
    res.json({ blockedUserIds: blockedList });
  } catch (err: any) {
    console.error('Block user error:', err);
    res.status(500).json({ error: 'Database error toggling block status.' });
  }
});

app.post('/api/users/:id/contacts', async (req, res) => {
  try {
    const { contactUserId, action } = req.body;
    const contacts = await userRepo.updateContacts(req.params.id, contactUserId, action);
    const updatedUser = await userRepo.getById(req.params.id);
    if (updatedUser) {
      broadcastToAll({ type: 'user_updated', payload: updatedUser });
    }
    res.json({ contacts });
  } catch (err: any) {
    console.error('Update contacts error:', err);
    res.status(500).json({ error: 'Database error updating contacts.' });
  }
});

app.post('/api/contacts/add', async (req, res) => {
  try {
    const currentUser = await resolveUser(req.headers['x-user-id'] as string);
    if (!currentUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const { name, phone, username, email, bio } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Contact name is required' });
    }

    const allUsers = await userRepo.getAll();
    let existingUser = allUsers.find((u) => {
      if (u.id === currentUser.id) return false;
      if (username && u.username?.toLowerCase() === username.trim().toLowerCase()) return true;
      if (email && u.email?.toLowerCase() === email.trim().toLowerCase()) return true;
      if (phone && u.phone && u.phone.replace(/\D/g, '') === phone.replace(/\D/g, '')) return true;
      return false;
    });

    if (existingUser) {
      const updatedContacts = await userRepo.updateContacts(currentUser.id, existingUser.id, 'add');
      const userA = await userRepo.getById(currentUser.id);
      if (userA) broadcastToAll({ type: 'user_updated', payload: userA });
      return res.status(200).json({ user: existingUser, isNew: false, contacts: updatedContacts });
    }

    const sanitizedUsername = username
      ? username.trim().toLowerCase().replace(/\s+/g, '_')
      : `user_${Date.now().toString().slice(-6)}`;

    const newContact: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      username: sanitizedUsername,
      email: email ? email.trim().toLowerCase() : `${sanitizedUsername}@chatsphere.app`,
      phone: phone ? phone.trim() : undefined,
      avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
      bio: bio ? bio.trim() : 'Hey there! I am using ChatSphere.',
      role: 'user',
      onlineStatus: 'offline',
      lastSeen: new Date().toISOString(),
      privacy: { showOnline: true, showLastSeen: true, showReadReceipts: true },
      contacts: [currentUser.id],
      createdAt: new Date().toISOString(),
    };

    const createdContact = await userRepo.create(newContact);
    const updatedContacts = await userRepo.updateContacts(currentUser.id, createdContact.id, 'add');

    const userA = await userRepo.getById(currentUser.id);
    if (userA) broadcastToAll({ type: 'user_updated', payload: sanitizeUserForClient(userA) });
    broadcastToAll({ type: 'user_registered', payload: createdContact });

    res.status(201).json({ user: createdContact, isNew: true, contacts: updatedContacts });
  } catch (err: any) {
    console.error('Add contact error:', err);
    res.status(500).json({ error: 'Database error creating contact.' });
  }
});

// FRIEND REQUESTS REST (SQLITE)
app.get('/api/friend-requests', async (req, res) => {
  try {
    const currentUser = await resolveUser(req.headers['x-user-id'] as string);
    const data = await friendRequestRepo.getForUser(currentUser.id);
    res.json(data);
  } catch (err: any) {
    console.error('Get friend requests error:', err);
    res.status(500).json({ error: 'Failed to retrieve friend requests from SQLite.' });
  }
});

app.post('/api/friend-requests/send', async (req, res) => {
  try {
    const currentUser = await resolveUser(req.headers['x-user-id'] as string);
    const { receiverId } = req.body;

    const receiverUser = await userRepo.getById(receiverId);
    if (!receiverUser) return res.status(404).json({ error: 'Target user not found' });

    if (receiverId === currentUser.id) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    if (currentUser.contacts?.includes(receiverId)) {
      return res.status(400).json({ error: 'User is already in your contacts' });
    }

    const existingReq = await friendRequestRepo.findPending(currentUser.id, receiverId);
    if (existingReq) {
      return res.status(400).json({ error: 'A pending friend request already exists' });
    }

    const newReq: FriendRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderUsername: currentUser.username,
      senderAvatar: currentUser.avatar,
      senderBio: currentUser.bio,
      senderEmail: currentUser.email,
      receiverId: receiverUser.id,
      receiverName: receiverUser.name,
      receiverAvatar: receiverUser.avatar,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const savedReq = await friendRequestRepo.create(newReq);

    sendToUser(receiverUser.id, {
      type: 'friend_request',
      payload: { request: savedReq },
    });
    sendToUser(receiverUser.id, {
      type: 'friend_request_update',
      payload: { request: savedReq, action: 'send' },
    });
    sendToUser(currentUser.id, {
      type: 'friend_request_update',
      payload: { request: savedReq, action: 'send' },
    });

    res.status(201).json({ request: savedReq });
  } catch (err: any) {
    console.error('Send friend request error:', err);
    res.status(500).json({ error: 'Database error sending friend request.' });
  }
});

app.post('/api/friend-requests/:id/respond', async (req, res) => {
  try {
    const currentUser = await resolveUser(req.headers['x-user-id'] as string);
    const reqId = req.params.id;
    const { action } = req.body; // 'accept' | 'deny'

    const targetReq = await friendRequestRepo.getById(reqId);
    if (!targetReq) return res.status(404).json({ error: 'Friend request not found' });

    if (targetReq.receiverId !== currentUser.id) {
      return res.status(403).json({ error: 'Not authorized to respond to this request' });
    }

    const updated = await friendRequestRepo.updateStatus(reqId, action === 'accept' ? 'accepted' : 'denied');

    let updatedContacts = currentUser.contacts || [];
    if (action === 'accept') {
      await userRepo.updateContacts(targetReq.senderId, currentUser.id, 'add');
      updatedContacts = await userRepo.updateContacts(currentUser.id, targetReq.senderId, 'add');

      // Update both user profiles in real time so Friends lists refresh across all clients
      const senderUser = await userRepo.getById(targetReq.senderId);
      const receiverUser = await userRepo.getById(currentUser.id);
      if (senderUser) broadcastToAll({ type: 'user_updated', payload: senderUser });
      if (receiverUser) broadcastToAll({ type: 'user_updated', payload: receiverUser });

      // Automatically create direct message conversation if none exists
      let conv = await conversationRepo.findPrivate(targetReq.senderId, currentUser.id);
      if (!conv) {
        const newConv: Conversation = {
          id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: 'private',
          createdById: currentUser.id,
          memberIds: [targetReq.senderId, currentUser.id],
          groupAdmins: [],
          pinnedUserIds: [],
          archivedUserIds: [],
          mutedUserIds: [],
          unreadCounts: { [targetReq.senderId]: 0, [currentUser.id]: 0 },
          permissions: { sendMessages: 'all', editInfo: 'all', addMembers: 'all' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        conv = await conversationRepo.create(newConv);
      }
      if (conv) {
        sendToUser(targetReq.senderId, { type: 'conversation_created', payload: conv });
        sendToUser(currentUser.id, { type: 'conversation_created', payload: conv });
        sendToUser(targetReq.senderId, { type: 'group_update', payload: conv });
        sendToUser(currentUser.id, { type: 'group_update', payload: conv });
      }

      sendToUser(targetReq.senderId, {
        type: 'notification',
        payload: { title: 'Friend Request Accepted', message: `${currentUser.name} accepted your friend request!` },
      });
    }

    sendToUser(targetReq.senderId, {
      type: 'friend_request_update',
      payload: { request: updated, action },
    });
    sendToUser(currentUser.id, {
      type: 'friend_request_update',
      payload: { request: updated, action },
    });

    res.json({ request: updated, contacts: updatedContacts });
  } catch (err: any) {
    console.error('Respond friend request error:', err);
    res.status(500).json({ error: 'Database error responding to friend request.' });
  }
});

// CONVERSATIONS REST (SQLITE)
app.get('/api/conversations', async (req, res) => {
  try {
    const user = await resolveUser(req.headers['x-user-id'] as string);
    if (!user) return res.json([]);

    const userConvs = await conversationRepo.getUserConversations(user.id);
    res.json(userConvs);
  } catch (err: any) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Failed to retrieve conversations from SQLite.' });
  }
});

app.post('/api/conversations', async (req, res) => {
  try {
    const { type, targetUserId, name, avatar, description, memberIds } = req.body;
    const user = await resolveUser(req.headers['x-user-id'] as string);
    const currentUserId = user.id;

    if (type === 'private') {
      if (!targetUserId) {
        return res.status(400).json({ error: 'targetUserId is required for private conversations' });
      }
      const existing = await conversationRepo.findPrivate(currentUserId, targetUserId);
      if (existing) return res.json(existing);

      const newConv: Conversation = {
        id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'private',
        createdById: currentUserId,
        memberIds: [currentUserId, targetUserId],
        groupAdmins: [],
        pinnedUserIds: [],
        archivedUserIds: [],
        mutedUserIds: [],
        unreadCounts: { [currentUserId]: 0, [targetUserId]: 0 },
        permissions: { sendMessages: 'all', editInfo: 'all', addMembers: 'all' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const created = await conversationRepo.create(newConv);
      return res.status(201).json(created);
    }

    if (type === 'group') {
      const allMembers = Array.from(new Set([currentUserId, ...(memberIds || [])]));
      const unreadObj: Record<string, number> = {};
      allMembers.forEach((m) => (unreadObj[m] = 0));

      const newGroup: Conversation = {
        id: `conv_group_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'group',
        name: name || 'New Group',
        avatar: avatar || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80',
        description: description || '',
        createdById: currentUserId,
        memberIds: allMembers,
        groupAdmins: [currentUserId],
        pinnedUserIds: [],
        archivedUserIds: [],
        mutedUserIds: [],
        unreadCounts: unreadObj,
        permissions: { sendMessages: 'all', editInfo: 'admins', addMembers: 'admins' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const created = await conversationRepo.create(newGroup);

      const creator = await userRepo.getById(currentUserId);
      const systemMsg: Message = {
        id: `msg_sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        conversationId: created.id,
        senderId: currentUserId,
        senderName: creator ? creator.name : 'User',
        senderAvatar: creator ? creator.avatar : '',
        type: 'system',
        text: `${creator?.name || 'User'} created group "${created.name}"`,
        status: 'read',
        createdAt: new Date().toISOString(),
      };
      await messageRepo.create(systemMsg);
      created.lastMessage = systemMsg;

      broadcastToConversation(created.id, { type: 'group_update', payload: created });
      return res.status(201).json(created);
    }

    res.status(400).json({ error: 'Invalid conversation type' });
  } catch (err: any) {
    console.error('Create conversation error:', err);
    res.status(500).json({ error: 'Failed to create conversation in SQLite.' });
  }
});

app.put('/api/conversations/:id', async (req, res) => {
  try {
    const conv = await conversationRepo.getById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const userId = req.headers['x-user-id'] as string;
    const { name, avatar, description, permissions, action, targetUserId } = req.body;

    if (name !== undefined) conv.name = name;
    if (avatar !== undefined) conv.avatar = avatar;
    if (description !== undefined) conv.description = description;
    if (permissions) conv.permissions = { ...conv.permissions, ...permissions };

    if (action === 'pin' && !conv.pinnedUserIds.includes(userId)) {
      conv.pinnedUserIds.push(userId);
    } else if (action === 'unpin') {
      conv.pinnedUserIds = conv.pinnedUserIds.filter((id) => id !== userId);
    } else if (action === 'archive' && !conv.archivedUserIds.includes(userId)) {
      conv.archivedUserIds.push(userId);
    } else if (action === 'unarchive') {
      conv.archivedUserIds = conv.archivedUserIds.filter((id) => id !== userId);
    } else if (action === 'mute' && !conv.mutedUserIds.includes(userId)) {
      conv.mutedUserIds.push(userId);
    } else if (action === 'unmute') {
      conv.mutedUserIds = conv.mutedUserIds.filter((id) => id !== userId);
    } else if (action === 'add_member' && targetUserId) {
      if (!conv.memberIds.includes(targetUserId)) {
        conv.memberIds.push(targetUserId);
        conv.unreadCounts[targetUserId] = 0;
      }
    } else if (action === 'remove_member' && targetUserId) {
      conv.memberIds = conv.memberIds.filter((id) => id !== targetUserId);
      conv.groupAdmins = conv.groupAdmins.filter((id) => id !== targetUserId);
    } else if (action === 'promote' && targetUserId) {
      if (!conv.groupAdmins.includes(targetUserId)) conv.groupAdmins.push(targetUserId);
    } else if (action === 'demote' && targetUserId) {
      conv.groupAdmins = conv.groupAdmins.filter((id) => id !== targetUserId);
    }

    conv.updatedAt = new Date().toISOString();
    const updated = await conversationRepo.update(conv);

    broadcastToConversation(conv.id, { type: 'group_update', payload: updated });
    res.json(updated);
  } catch (err: any) {
    console.error('Update conversation error:', err);
    res.status(500).json({ error: 'Failed to update conversation in SQLite.' });
  }
});

// MESSAGES REST (SQLITE)
app.get('/api/conversations/:id/messages', async (req, res) => {
  try {
    const convId = req.params.id;
    const userId = req.headers['x-user-id'] as string;

    const convMsgs = await messageRepo.getByConversation(convId, userId);

    // Mark unread messages as read in SQLite for this user
    if (userId) {
      await messageRepo.markAsRead(convId, userId);
      await conversationRepo.resetUnreadCount(convId, userId);
      broadcastToConversation(
        convId,
        {
          type: 'message_read',
          payload: { conversationId: convId, userId },
        },
        userId
      );
    }

    res.json(convMsgs);
  } catch (err: any) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Failed to retrieve messages from SQLite.' });
  }
});

app.post('/api/conversations/:id/read', async (req, res) => {
  try {
    const convId = req.params.id;
    const userId = req.headers['x-user-id'] as string;
    if (userId) {
      await messageRepo.markAsRead(convId, userId);
      await conversationRepo.resetUnreadCount(convId, userId);
      broadcastToConversation(
        convId,
        {
          type: 'message_read',
          payload: { conversationId: convId, userId },
        },
        userId
      );
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

app.post('/api/conversations/:id/messages', async (req, res) => {
  try {
    const convId = req.params.id;
    const sender = await resolveUser(req.headers['x-user-id'] as string);

    const {
      type = 'text',
      text = '',
      mediaUrl,
      mediaName,
      mediaSize,
      mediaMime,
      duration,
      replyToMessageId,
      linkPreview,
    } = req.body;

    let replyToPreview = undefined;
    if (replyToMessageId) {
      const parentMsg = await messageRepo.getById(replyToMessageId);
      if (parentMsg) {
        replyToPreview = {
          id: parentMsg.id,
          senderName: parentMsg.senderName,
          text: parentMsg.text,
          type: parentMsg.type,
        };
      }
    }

    const newMsg: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      conversationId: convId,
      senderId: sender.id,
      senderName: sender.name,
      senderAvatar: sender.avatar,
      type,
      text,
      mediaUrl,
      mediaName,
      mediaSize,
      mediaMime,
      duration,
      replyToMessageId,
      replyToPreview,
      linkPreview,
      status: 'delivered',
      readBy: {},
      starredBy: [],
      deletedFor: [],
      deletedForEveryone: false,
      createdAt: new Date().toISOString(),
    };

    const savedMsg = await messageRepo.create(newMsg);
    await conversationRepo.incrementUnreadCounts(convId, sender.id);

    broadcastToConversation(convId, { type: 'new_message', payload: savedMsg });

    // Calculate streak if private conversation
    const conv = await conversationRepo.getById(convId);
    if (conv && conv.type === 'private' && conv.memberIds.length === 2) {
      const otherUserId = conv.memberIds.find((id) => id !== sender.id);
      if (otherUserId) {
        const streak = await calculateStreak(sender.id, otherUserId);
        broadcastToConversation(convId, { type: 'streak_update', payload: { conversationId: convId, streak } });
      }
    }

    res.status(201).json(savedMsg);
  } catch (err: any) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Database error saving message to SQLite.' });
  }
});

// Reactions REST (SQLITE)
app.post('/api/messages/:id/reaction', async (req, res) => {
  try {
    const msg = await messageRepo.getById(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    const userId = req.headers['x-user-id'] as string;
    const { emoji } = req.body;

    const reactions = msg.reactions || {};
    Object.keys(reactions).forEach((e) => {
      reactions[e] = reactions[e].filter((id) => id !== userId);
      if (reactions[e].length === 0) delete reactions[e];
    });

    if (emoji) {
      if (!reactions[emoji]) reactions[emoji] = [];
      reactions[emoji].push(userId);
    }

    await messageRepo.updateReactions(msg.id, reactions);

    broadcastToConversation(msg.conversationId, {
      type: 'reaction_update',
      payload: { messageId: msg.id, reactions },
    });

    res.json({ reactions });
  } catch (err: any) {
    console.error('Message reaction error:', err);
    res.status(500).json({ error: 'Database error updating message reaction.' });
  }
});

// Star message REST (SQLITE)
app.post('/api/messages/:id/star', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const starredBy = await messageRepo.toggleStar(req.params.id, userId);
    res.json({ starredBy });
  } catch (err: any) {
    console.error('Star message error:', err);
    res.status(500).json({ error: 'Database error updating message star.' });
  }
});

// Delete message REST (SQLITE)
app.delete('/api/messages/:id', async (req, res) => {
  try {
    const msg = await messageRepo.getById(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    const userId = req.headers['x-user-id'] as string;
    const mode = req.query.mode as string; // 'for_me' | 'for_everyone'

    if (mode === 'for_everyone') {
      await messageRepo.deleteForEveryone(msg.id);
      broadcastToConversation(msg.conversationId, {
        type: 'message_delete',
        payload: { messageId: msg.id, mode: 'for_everyone' },
      });
    } else {
      await messageRepo.deleteForUser(msg.id, userId);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Database error deleting message.' });
  }
});

// Report message REST (SQLITE)
app.post('/api/messages/:id/report', async (req, res) => {
  try {
    const msg = await messageRepo.getById(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    const userId = req.headers['x-user-id'] as string;
    const reporter = await userRepo.getById(userId);
    const { reason } = req.body;

    const report: ReportedMessage = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      messageId: msg.id,
      messageText: msg.text,
      senderName: msg.senderName,
      conversationId: msg.conversationId,
      reportedBy: userId,
      reportedByName: reporter?.name || 'User',
      reportedUserId: msg.senderId,
      reportedUserName: msg.senderName,
      reason: reason || 'Inappropriate content',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const savedReport = await reportRepo.create(report);
    await activityLogRepo.create('report_received', `🚨 Report against ${msg.senderName} for ${reason}`, msg.senderId, msg.senderName);

    res.json({ success: true, report: savedReport });
  } catch (err: any) {
    console.error('Report message error:', err);
    res.status(500).json({ error: 'Database error saving report.' });
  }
});

// Link preview parser helper
app.post('/api/messages/link-preview', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    const parsed = new URL(url);
    res.json({
      url,
      title: `${parsed.hostname} - Web Page`,
      description: `Explore content and resources on ${parsed.hostname}`,
      domain: parsed.hostname,
      image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80',
    });
  } catch {
    res.status(400).json({ error: 'Invalid URL' });
  }
});

// File Upload endpoint (multipart/form-data)
app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, (err: any) => {
    res.setHeader('Content-Type', 'application/json');
    if (err) {
      console.error('Upload multer error:', err);
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      url: fileUrl,
      name: req.file.originalname,
      size: req.file.size,
      mime: req.file.mimetype,
    });
  });
});

// Base64 Data-URL File Upload endpoint (JSON)
app.post('/api/upload-base64', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { dataUrl, filename, mime } = req.body;
    if (!dataUrl) {
      return res.status(400).json({ error: 'dataUrl is required' });
    }

    const matches = dataUrl.match(/^data:([A-Za-z0-9-+/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const detectedMime = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      const extMatch = detectedMime.split('/')[1]?.split('+')[0] || 'png';
      const ext = extMatch === 'jpeg' ? 'jpg' : extMatch;
      const safeFilename = `file-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
      const filePath = path.join(uploadsDir, safeFilename);
      fs.writeFileSync(filePath, buffer);

      return res.json({
        url: `/uploads/${safeFilename}`,
        name: filename || safeFilename,
        size: buffer.length,
        mime: mime || detectedMime,
      });
    }

    // If it's already a URL, return as is
    res.json({
      url: dataUrl,
      name: filename || 'file',
      size: 0,
      mime: mime || 'image/png',
    });
  } catch (err: any) {
    console.error('Upload base64 error:', err);
    res.status(500).json({ error: 'Failed to process base64 upload' });
  }
});

// STATUSES / STORIES REST (SQLITE)
app.get('/api/statuses', async (req, res) => {
  try {
    const activeStatuses = await statusRepo.getActive();
    res.json(activeStatuses);
  } catch (err: any) {
    console.error('Get statuses error:', err);
    res.status(500).json({ error: 'Database error retrieving statuses from SQLite.' });
  }
});

app.get('/api/statuses/:id', async (req, res) => {
  try {
    const status = await statusRepo.getById(req.params.id);
    if (!status) {
      return res.status(404).json({ error: 'Status not found' });
    }
    res.json(status);
  } catch (err: any) {
    console.error('Get status by ID error:', err);
    res.status(500).json({ error: 'Database error retrieving status from SQLite.' });
  }
});

app.post('/api/statuses', async (req, res) => {
  try {
    const user = await resolveUser(req.headers['x-user-id'] as string);
    const { type, content, caption, bgColor, duration } = req.body;

    if (!type || !content) {
      return res.status(400).json({ error: 'Status type and content are required' });
    }

    if ((type === 'audio' || type === 'video') && duration) {
      const numDuration = Number(duration);
      if (numDuration > 60) {
        return res.status(400).json({ error: 'Media duration exceeds 60 seconds limit' });
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 3600 * 1000);

    const newStatus: UserStatus = {
      id: `status_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: user.id,
      userName: user.name,
      userUsername: user.username,
      userAvatar: user.avatar,
      userIsVerified: user.isVerified || false,
      type,
      content,
      caption: caption || '',
      bgColor: bgColor || 'from-indigo-600 to-purple-700',
      duration: duration ? Number(duration) : undefined,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      reactions: {},
      commentsCount: 0,
    };

    const savedStatus = await statusRepo.create(newStatus);
    broadcastToAll({ type: 'status_update', payload: savedStatus });

    res.status(201).json(savedStatus);
  } catch (err: any) {
    console.error('Create status error:', err);
    res.status(500).json({ error: 'Database error saving status to SQLite.' });
  }
});

app.delete('/api/statuses/:id', async (req, res) => {
  try {
    const user = await resolveUser(req.headers['x-user-id'] as string);
    const status = await statusRepo.getById(req.params.id);

    if (!status) {
      return res.status(404).json({ error: 'Status not found' });
    }

    if (status.userId !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: You can only delete your own status' });
    }

    await statusRepo.delete(req.params.id);
    broadcastToAll({ type: 'status_delete', payload: { statusId: req.params.id } });

    res.json({ success: true, message: 'Status deleted' });
  } catch (err: any) {
    console.error('Delete status error:', err);
    res.status(500).json({ error: 'Database error deleting status.' });
  }
});

// STATUS COMMENTS (Independent per status)
app.get('/api/statuses/:id/comments', async (req, res) => {
  try {
    const statusId = req.params.id;
    const comments = await statusCommentRepo.getByStatusId(statusId);
    res.json(comments);
  } catch (err: any) {
    console.error('Get status comments error:', err);
    res.status(500).json({ error: 'Database error retrieving status comments.' });
  }
});

app.post('/api/statuses/:id/comments', async (req, res) => {
  try {
    const user = await resolveUser(req.headers['x-user-id'] as string);
    const statusId = req.params.id;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text cannot be empty' });
    }

    const status = await statusRepo.getById(statusId);
    if (!status) {
      return res.status(404).json({ error: 'Status not found' });
    }

    const commentId = `comm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newComment: StatusComment = {
      id: commentId,
      statusId,
      userId: user.id,
      userName: user.name,
      userUsername: user.username,
      userAvatar: user.avatar,
      userIsVerified: user.isVerified || false,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    const savedComment = await statusCommentRepo.create(newComment);

    broadcastToAll({
      type: 'status_comment_added',
      payload: {
        statusId,
        comment: savedComment,
      },
    });

    res.status(201).json({ success: true, comment: savedComment });
  } catch (err: any) {
    console.error('Add status comment error:', err);
    res.status(500).json({ error: 'Database error saving status comment.' });
  }
});

app.delete('/api/statuses/:id/comments/:commentId', async (req, res) => {
  try {
    const user = await resolveUser(req.headers['x-user-id'] as string);
    const { id: statusId, commentId } = req.params;

    const comment = await statusCommentRepo.getById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const status = await statusRepo.getById(statusId);

    // Allowed if user wrote comment, user owns status, or user is admin
    const canDelete =
      comment.userId === user.id ||
      (status && status.userId === user.id) ||
      user.role === 'admin';

    if (!canDelete) {
      return res.status(403).json({ error: 'Unauthorized: Cannot delete this comment' });
    }

    await statusCommentRepo.delete(commentId);

    broadcastToAll({
      type: 'status_comment_deleted',
      payload: {
        statusId,
        commentId,
      },
    });

    res.json({ success: true, message: 'Comment deleted' });
  } catch (err: any) {
    console.error('Delete status comment error:', err);
    res.status(500).json({ error: 'Database error deleting comment.' });
  }
});

// STATUS REACTIONS (Independent per status)
app.get('/api/statuses/:id/reactions', async (req, res) => {
  try {
    const statusId = req.params.id;
    const reactionsList = await statusReactionRepo.getByStatusId(statusId);
    res.json(reactionsList);
  } catch (err: any) {
    console.error('Get status reactions error:', err);
    res.status(500).json({ error: 'Database error retrieving status reactions.' });
  }
});

app.post('/api/statuses/:id/react', async (req, res) => {
  try {
    const user = await resolveUser(req.headers['x-user-id'] as string);
    const statusId = req.params.id;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ error: 'Emoji is required' });
    }

    const status = await statusRepo.getById(statusId);
    if (!status) {
      return res.status(404).json({ error: 'Status not found' });
    }

    const result = await statusReactionRepo.toggle(
      statusId,
      {
        id: user.id,
        name: user.name,
        username: user.username,
        avatar: user.avatar,
        isVerified: user.isVerified,
      },
      emoji
    );

    broadcastToAll({
      type: 'status_reaction',
      payload: {
        statusId,
        reactions: result.reactions,
        reactionsList: result.reactionsList,
        user: { id: user.id, name: user.name, avatar: user.avatar },
        emoji,
      },
    });

    res.json({
      success: true,
      statusId,
      reactions: result.reactions,
      reactionsList: result.reactionsList,
    });
  } catch (err: any) {
    console.error('React status error:', err);
    res.status(500).json({ error: 'Database error updating status reaction.' });
  }
});

// Chat Streaks API (SQLITE CALCULATED)
app.get('/api/streaks/:conversationId', async (req, res) => {
  try {
    const user = await resolveUser(req.headers['x-user-id'] as string);
    const convId = req.params.conversationId;

    const conv = await conversationRepo.getById(convId);
    if (!conv || conv.type !== 'private' || conv.memberIds.length !== 2) {
      return res.json({ streakCount: 0, isActiveToday: false });
    }

    const otherUserId = conv.memberIds.find((id) => id !== user.id) || conv.memberIds[0];
    const streak = await calculateStreak(user.id, otherUserId);

    res.json(streak);
  } catch (err: any) {
    console.error('Streak calculation error:', err);
    res.status(500).json({ error: 'Database error calculating streaks.' });
  }
});

// SCHEDULED MESSAGES API (SQLITE)
app.get('/api/scheduled-messages', async (req, res) => {
  try {
    const user = await resolveUser(req.headers['x-user-id'] as string);
    const userScheduled = await scheduledMessageRepo.getByUser(user.id);
    res.json(userScheduled);
  } catch (err: any) {
    console.error('Get scheduled messages error:', err);
    res.status(500).json({ error: 'Database error retrieving scheduled messages.' });
  }
});

app.post('/api/scheduled-messages', async (req, res) => {
  try {
    const sender = await resolveUser(req.headers['x-user-id'] as string);
    const { conversationId, type = 'text', content, mediaUrl, mediaName, scheduledAt, timezone } = req.body;

    if (!conversationId || !content || !scheduledAt) {
      return res.status(400).json({ error: 'conversationId, content, and scheduledAt are required' });
    }

    const scheduledTime = new Date(scheduledAt);
    if (isNaN(scheduledTime.getTime())) {
      return res.status(400).json({ error: 'Invalid scheduledAt date format' });
    }

    const conv = await conversationRepo.getById(conversationId);

    const newScheduled: ScheduledMessage = {
      id: `sched_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      senderId: sender.id,
      senderName: sender.name,
      senderAvatar: sender.avatar,
      conversationId,
      conversationName: conv ? conv.name || 'Chat' : 'Chat',
      type,
      content,
      mediaUrl,
      mediaName,
      scheduledAt: scheduledTime.toISOString(),
      timezone: timezone || 'UTC',
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    };

    const savedScheduled = await scheduledMessageRepo.create(newScheduled);
    sendToUser(sender.id, { type: 'scheduled_message_update', payload: savedScheduled });
    res.status(201).json(savedScheduled);
  } catch (err: any) {
    console.error('Create scheduled message error:', err);
    res.status(500).json({ error: 'Database error creating scheduled message.' });
  }
});

app.delete('/api/scheduled-messages/:id', async (req, res) => {
  try {
    const user = await resolveUser(req.headers['x-user-id'] as string);
    const item = await scheduledMessageRepo.getById(req.params.id);

    if (!item) return res.status(404).json({ error: 'Scheduled message not found' });

    if (item.senderId !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: "Unauthorized: Cannot cancel someone else's scheduled message" });
    }

    const updated = await scheduledMessageRepo.update(req.params.id, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    });

    sendToUser(user.id, { type: 'scheduled_message_update', payload: updated });
    res.json({ success: true, item: updated });
  } catch (err: any) {
    console.error('Cancel scheduled message error:', err);
    res.status(500).json({ error: 'Database error cancelling scheduled message.' });
  }
});

// RECURRING SCHEDULES API (SQLITE)
app.get('/api/recurring-schedules', async (req, res) => {
  try {
    const user = await resolveUser(req.headers['x-user-id'] as string);
    const userRecurring = await recurringScheduleRepo.getByUser(user.id);
    res.json(userRecurring);
  } catch (err: any) {
    console.error('Get recurring schedules error:', err);
    res.status(500).json({ error: 'Database error retrieving recurring schedules.' });
  }
});

app.post('/api/recurring-schedules', async (req, res) => {
  try {
    const sender = await resolveUser(req.headers['x-user-id'] as string);
    const {
      conversationId,
      content,
      frequency,
      time,
      startAt,
      endRule = 'never',
      endAt,
      maxOccurrences,
      timezone = 'UTC',
    } = req.body;

    if (!conversationId || !content || !frequency || !time || !startAt) {
      return res.status(400).json({ error: 'conversationId, content, frequency, time, and startAt are required' });
    }

    const conv = await conversationRepo.getById(conversationId);
    const nextRunAt = computeNextRunAt(startAt, time, frequency);

    const newSchedule: RecurringSchedule = {
      id: `recur_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      senderId: sender.id,
      senderName: sender.name,
      senderAvatar: sender.avatar,
      conversationId,
      conversationName: conv ? conv.name || 'Chat' : 'Chat',
      content,
      frequency,
      time,
      startAt,
      endRule,
      endAt,
      maxOccurrences: maxOccurrences ? Number(maxOccurrences) : undefined,
      occurrencesCount: 0,
      timezone,
      status: 'active',
      nextRunAt,
      createdAt: new Date().toISOString(),
    };

    const savedSchedule = await recurringScheduleRepo.create(newSchedule);
    sendToUser(sender.id, { type: 'recurring_message_update', payload: savedSchedule });
    res.status(201).json(savedSchedule);
  } catch (err: any) {
    console.error('Create recurring schedule error:', err);
    res.status(500).json({ error: 'Database error creating recurring schedule.' });
  }
});

app.put('/api/recurring-schedules/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const item = await recurringScheduleRepo.getById(req.params.id);

    if (!item) return res.status(404).json({ error: 'Recurring schedule not found' });

    if (item.senderId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { action } = req.body;
    let updates: Partial<RecurringSchedule> = {};

    if (action === 'pause') {
      updates = { status: 'paused' };
    } else if (action === 'resume') {
      updates = {
        status: 'active',
        nextRunAt: computeNextRunAt(new Date().toISOString(), item.time, item.frequency),
      };
    } else if (action === 'cancel') {
      updates = { status: 'cancelled' };
    }

    const updated = await recurringScheduleRepo.update(req.params.id, updates);
    sendToUser(userId, { type: 'recurring_message_update', payload: updated });
    res.json(updated);
  } catch (err: any) {
    console.error('Update recurring schedule error:', err);
    res.status(500).json({ error: 'Database error updating recurring schedule.' });
  }
});

app.delete('/api/recurring-schedules/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const item = await recurringScheduleRepo.getById(req.params.id);

    if (!item) return res.status(404).json({ error: 'Recurring schedule not found' });

    if (item.senderId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updated = await recurringScheduleRepo.update(req.params.id, { status: 'cancelled' });
    sendToUser(userId, { type: 'recurring_message_update', payload: updated });
    res.json({ success: true, item: updated });
  } catch (err: any) {
    console.error('Delete recurring schedule error:', err);
    res.status(500).json({ error: 'Database error deleting recurring schedule.' });
  }
});

// Background engine processing scheduled & recurring messages directly from SQLite
setInterval(async () => {
  const now = new Date();
  const nowISO = now.toISOString();

  try {
    // 1. Process Due Scheduled Messages from SQLite
    const dueScheduled = await scheduledMessageRepo.getPendingDue(nowISO);
    for (const sched of dueScheduled) {
      const conv = await conversationRepo.getById(sched.conversationId);
      if (conv) {
        const newMsg: Message = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          conversationId: sched.conversationId,
          senderId: sched.senderId,
          senderName: sched.senderName,
          senderAvatar: sched.senderAvatar,
          type: sched.type || 'text',
          text: sched.content,
          mediaUrl: sched.mediaUrl,
          mediaName: sched.mediaName,
          status: 'delivered',
          createdAt: nowISO,
        };

        await messageRepo.create(newMsg);
        await conversationRepo.incrementUnreadCounts(sched.conversationId, sched.senderId);

        const updatedSched = await scheduledMessageRepo.update(sched.id, {
          status: 'sent',
          sentAt: nowISO,
        });

        broadcastToConversation(sched.conversationId, { type: 'new_message', payload: newMsg });
        sendToUser(sched.senderId, { type: 'scheduled_message_sent', payload: sched });
        sendToUser(sched.senderId, { type: 'scheduled_message_update', payload: updatedSched || sched });
      } else {
        await scheduledMessageRepo.update(sched.id, { status: 'failed' });
      }
    }

    // 2. Process Due Recurring Schedules from SQLite
    const dueRecurring = await recurringScheduleRepo.getActiveDue(nowISO);
    for (const rec of dueRecurring) {
      if (rec.endRule === 'custom_date' && rec.endAt && now > new Date(rec.endAt)) {
        await recurringScheduleRepo.update(rec.id, { status: 'completed' });
        continue;
      }
      if (rec.endRule === 'occurrences' && rec.maxOccurrences && rec.occurrencesCount >= rec.maxOccurrences) {
        await recurringScheduleRepo.update(rec.id, { status: 'completed' });
        continue;
      }

      const conv = await conversationRepo.getById(rec.conversationId);
      if (conv) {
        const newMsg: Message = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          conversationId: rec.conversationId,
          senderId: rec.senderId,
          senderName: rec.senderName,
          senderAvatar: rec.senderAvatar,
          type: 'text',
          text: rec.content,
          status: 'delivered',
          createdAt: nowISO,
        };

        await messageRepo.create(newMsg);
        await conversationRepo.incrementUnreadCounts(rec.conversationId, rec.senderId);

        const newOccurrences = rec.occurrencesCount + 1;
        const nextRun = computeNextRunAt(nowISO, rec.time, rec.frequency, nowISO);

        let finalStatus = rec.status;
        if (rec.endRule === 'custom_date' && rec.endAt && new Date(nextRun) > new Date(rec.endAt)) {
          finalStatus = 'completed';
        } else if (rec.endRule === 'occurrences' && rec.maxOccurrences && newOccurrences >= rec.maxOccurrences) {
          finalStatus = 'completed';
        }

        const updatedRec = await recurringScheduleRepo.update(rec.id, {
          occurrencesCount: newOccurrences,
          lastRunAt: nowISO,
          nextRunAt: nextRun,
          status: finalStatus,
        });

        broadcastToConversation(rec.conversationId, { type: 'new_message', payload: newMsg });
        sendToUser(rec.senderId, { type: 'recurring_message_sent', payload: rec });
        sendToUser(rec.senderId, { type: 'recurring_message_update', payload: updatedRec || rec });
      } else {
        await recurringScheduleRepo.update(rec.id, { status: 'failed' });
      }
    }
  } catch (err) {
    console.error('Background message processor error:', err);
  }
}, 4000);

// Reports REST (SQLITE)
app.post('/api/reports', async (req, res) => {
  try {
    const reporterId = req.headers['x-user-id'] as string;
    const reporter = await userRepo.getById(reporterId);
    const { reportedUserId, reason, messageId, messageText } = req.body;

    if (!reportedUserId || !reason) {
      return res.status(400).json({ error: 'reportedUserId and reason are required' });
    }

    const reportedUser = await userRepo.getById(reportedUserId);
    const report: ReportedMessage = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      messageId,
      messageText: messageText || 'Reported user behavior',
      senderName: reportedUser?.name || 'User',
      conversationId: 'main',
      reportedBy: reporterId,
      reportedByName: reporter?.name || 'Anonymous User',
      reportedUserId,
      reportedUserName: reportedUser?.name || 'Reported User',
      reason,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const saved = await reportRepo.create(report);
    await activityLogRepo.create(
      'report_received',
      `🚨 New report: ${reporter?.name || 'User'} reported ${reportedUser?.name || 'User'} for ${reason}`,
      reportedUserId,
      reportedUser?.name
    );

    res.status(201).json({ success: true, report: saved });
  } catch (err: any) {
    console.error('Create report error:', err);
    res.status(500).json({ error: 'Database error creating report.' });
  }
});

// ADMIN DASHBOARD REST (SQLITE)
app.get('/api/admin/dashboard', requireAdminUser, async (req, res) => {
  try {
    const adminUser = req.user;
    const allUsers = (await userRepo.getAll()).filter((u) => u.role !== 'admin');
    const allReports = await reportRepo.getAll();
    const logs = await activityLogRepo.getAll(50);

    const totalUsers = allUsers.length;
    const activeUsers = allUsers.filter((u) => u.onlineStatus === 'online' || u.onlineStatus === 'away').length;
    const onlineUsers = allUsers.filter((u) => u.onlineStatus === 'online').length;
    const pendingReports = allReports.filter((r) => r.status === 'pending').length;
    const suspendedAccounts = allUsers.filter((u) => u.isSuspended || u.isBanned).length;
    const newUsersToday =
      allUsers.filter((u) => new Date(u.createdAt).toDateString() === new Date().toDateString()).length || 1;
    const systemAlerts = pendingReports;

    const categories = ['Spam', 'Harassment', 'Fake account', 'Hate/abusive content', 'Scam', 'Inappropriate content', 'Other'];
    const reportsCategoryDistribution = categories.map((cat) => ({
      category: cat,
      count: allReports.filter((r) => r.reason === cat).length,
    }));

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dauTrend = days.map((day, idx) => ({
      date: day,
      dau: Math.max(3, activeUsers + (idx % 3)),
      newUsers: Math.max(1, Math.floor(newUsersToday / 2)),
    }));

    const messageVolumeTrend = days.map((day, idx) => ({
      date: day,
      messages: 120 + idx * 45,
    }));

    res.json({
      overview: {
        totalUsers,
        activeUsers,
        onlineUsers,
        pendingReports,
        suspendedAccounts,
        newUsersToday,
        systemAlerts,
      },
      liveActivity: logs,
      analytics: {
        dau: activeUsers,
        mau: totalUsers,
        newRegistrationsToday: newUsersToday,
        avgSessionDuration: '24 mins',
        dauTrend,
        messageVolumeTrend,
        reportsCategoryDistribution,
      },
    });
  } catch (err: any) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ error: 'Database error fetching admin dashboard data.' });
  }
});

app.get('/api/admin/users', requireAdminUser, async (req, res) => {
  try {
    const adminUser = req.user;
    const allUsers = (await userRepo.getAll()).filter((u) => u.role !== 'admin');
    const enrichedUsers = await Promise.all(
      allUsers.map(async (u) => {
        const msgCount = await messageRepo.countByUser(u.id);
        const repCount = await reportRepo.countByTargetUser(u.id);
        return {
          ...u,
          messagesCount: msgCount,
          reportsCount: repCount,
        };
      })
    );
    res.json(enrichedUsers);
  } catch (err: any) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Database error fetching admin user list.' });
  }
});

app.post('/api/admin/users/:id/action', requireAdminUser, async (req, res) => {
  try {
    const adminUser = req.user;
    const user = await userRepo.getById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { action, newPassword } = req.body;

    if (action === 'suspend') {
      const nextState = !user.isSuspended;
      await userRepo.update(user.id, { isSuspended: nextState });
      user.isSuspended = nextState;
      const msgText = nextState
        ? 'Account-kaaga waxaa ku dhacay hakad KVM (Suspended) sababo la xiriira maamulka app-ka.'
        : 'Hakadii account-kaaga waa la ka qaaday (Un-suspended).';
      await sendAdminNotification(user.id, msgText, adminUser.id);
      await activityLogRepo.create('account_suspended', `🔒 Account ${user.name} status: ${nextState ? 'Suspended' : 'Active'}`, user.id, user.name);
    } else if (action === 'ban') {
      const nextState = !user.isBanned;
      await userRepo.update(user.id, { isBanned: nextState });
      user.isBanned = nextState;
      const msgText = nextState
        ? 'Account-kaaga waxaa si buuxda u mamnuucay (Banned) maamulka app-ka.'
        : 'Mamnuucidii account-kaaga waa la ka qaaday (Un-banned).';
      await sendAdminNotification(user.id, msgText, adminUser.id);
      await activityLogRepo.create('account_banned', `⛔ Account ${user.name} status: ${nextState ? 'Banned' : 'Active'}`, user.id, user.name);
    } else if (action === 'warn') {
      const nextWarnings = (user.warningsCount || 0) + 1;
      await userRepo.update(user.id, { warningsCount: nextWarnings });
      user.warningsCount = nextWarnings;
      const warningMsg = 'Baaritaan ayaa ku socoda account kaaga';
      await sendAdminNotification(user.id, warningMsg, adminUser.id);
      await activityLogRepo.create('account_warned', `⚠️ Warning sent to ${user.name}: "${warningMsg}"`, user.id, user.name);
    } else if (action === 'reset_password') {
      const pass = newPassword || 'Reset123!';
      await userRepo.update(user.id, { password: pass });
      user.password = pass;
      await sendAdminNotification(user.id, `Password-kaaga waxaa dib u dhigay admin-ka. Password-ka cusub waa: ${pass}`, adminUser.id);
      await activityLogRepo.create('account_warned', `🔑 Password reset for user ${user.name}`, user.id, user.name);
    } else if (action === 'force_logout') {
      await userRepo.setOnlineStatus(user.id, 'offline');
      user.onlineStatus = 'offline';
      await sendAdminNotification(user.id, 'Session-kaaga waa la tirtiray (Force Logout) sababo la xiriira maamulka app-ka.', adminUser.id);
      sendToUser(user.id, { type: 'presence_update', payload: { userId: user.id, status: 'offline', forceLogout: true } });
      await activityLogRepo.create('account_suspended', `🚪 Force logged out: ${user.name}`, user.id, user.name);
    } else if (action === 'verify') {
      const nextVerified = !user.isVerified;
      await userRepo.update(user.id, { isVerified: nextVerified });
      user.isVerified = nextVerified;
      const verifyMsg = nextVerified
        ? 'Hambalyo! Account-kaaga waa la xaqijiyay (Verified Tick Badge ✓).'
        : 'Xaqiijintii account-kaaga waa la ka saaray.';
      await sendAdminNotification(user.id, verifyMsg, adminUser.id);
      await activityLogRepo.create('account_verified', `✓ Account ${user.name} verified: ${nextVerified ? 'Yes' : 'No'}`, user.id, user.name);
    } else if (action === 'delete') {
      await userRepo.delete(req.params.id);
      await activityLogRepo.create('account_suspended', `🗑️ Account deleted: ${user.name}`, user.id, user.name);
      broadcastToAll({ type: 'user_updated', payload: { id: req.params.id, isDeleted: true } });
      return res.json({ success: true, message: 'User deleted' });
    }

    const updatedUser = await userRepo.getById(user.id);
    if (updatedUser) {
      broadcastToAll({ type: 'user_updated', payload: sanitizeUserForClient(updatedUser) });
    }

    res.json({ success: true, user: sanitizeUserForClient(updatedUser || user) });
  } catch (err: any) {
    console.error('Admin user action error:', err);
    res.status(500).json({ error: 'Database error executing admin action.' });
  }
});

// Admin Broadcast & Direct Messaging Endpoint
app.post('/api/admin/send-message', requireAdminUser, async (req, res) => {
  try {
    const adminUser = req.user;
    const { recipientId, isBroadcast, title, message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const noticeTitle = title?.trim() || 'Admin Team Message';
    const allUsers = await userRepo.getAll();

    if (isBroadcast) {
      const targets = allUsers.filter((u) => u.id !== adminUser.id);
      for (const target of targets) {
        await sendAdminNotification(target.id, message.trim(), adminUser.id, noticeTitle);
      }
      await activityLogRepo.create(
        'system_event',
        `📢 Admin Announcement by ${adminUser.name} broadcast to ${targets.length} users: "${noticeTitle}"`,
        adminUser.id,
        adminUser.name
      );
      return res.json({ success: true, count: targets.length, message: `Official announcement sent to ${targets.length} users.` });
    } else {
      if (!recipientId) {
        return res.status(400).json({ error: 'recipientId is required for direct admin message' });
      }
      const targetUser = await userRepo.getById(recipientId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Target user not found' });
      }
      await sendAdminNotification(targetUser.id, message.trim(), adminUser.id, noticeTitle);
      await activityLogRepo.create(
        'system_event',
        `💬 Official Admin Notice sent by ${adminUser.name} to ${targetUser.name}: "${noticeTitle}"`,
        adminUser.id,
        adminUser.name
      );
      return res.json({ success: true, message: `Message delivered to ${targetUser.name}.` });
    }
  } catch (err: any) {
    console.error('Admin send message error:', err);
    res.status(500).json({ error: 'Database error dispatching admin message.' });
  }
});

app.get('/api/admin/reports', requireAdminUser, async (req, res) => {
  try {
    const adminUser = req.user;
    const reports = await reportRepo.getAll();
    res.json(reports);
  } catch (err: any) {
    console.error('Admin reports error:', err);
    res.status(500).json({ error: 'Database error fetching reports.' });
  }
});

app.post('/api/admin/reports/:id/action', requireAdminUser, async (req, res) => {
  try {
    const adminUser = req.user;
    const report = await reportRepo.getById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const { action } = req.body; // 'review' | 'dismiss' | 'warn_user' | 'suspend' | 'ban' | 'escalate'
    let nextStatus = 'resolved';

    if (action === 'dismiss') {
      nextStatus = 'dismissed';
    } else if (action === 'review') {
      nextStatus = 'reviewed';
    } else if (action === 'escalate') {
      nextStatus = 'escalated';
    }

    const updatedReport = await reportRepo.update(req.params.id, {
      status: nextStatus as any,
      actionTaken: action,
    });

    const actionLabel = action.toUpperCase().replace('_', ' ');

    // 1. Notify reporter via SQLite
    if (report.reportedBy) {
      const reporterMsg = `Admin Action Update: Report-kaagii ku saabsanaa ${report.reportedUserName} [Sababta: ${report.reason}] waxaa lagu qaaday go'aan ah: ${actionLabel}.`;
      await sendAdminNotification(report.reportedBy, reporterMsg, adminUser.id);
    }

    // 2. Notify reported user via SQLite
    if (report.reportedUserId) {
      const targetMsg = `Maamulka App-ka (Admin) ayaa dib u eegay report lagu qaray [Sababta: ${report.reason}]. Go'aanka maamulka ee laguusoo diray wuxuu noqday: ${actionLabel}.`;
      await sendAdminNotification(report.reportedUserId, targetMsg, adminUser.id);

      if (action === 'warn_user') {
        const warnMsg = 'Baaritaan ayaa ku socoda account kaaga';
        await sendAdminNotification(report.reportedUserId, warnMsg, adminUser.id);
        const targetUser = await userRepo.getById(report.reportedUserId);
        if (targetUser) {
          await userRepo.update(targetUser.id, { warningsCount: (targetUser.warningsCount || 0) + 1 });
        }
      } else if (action === 'suspend') {
        await userRepo.update(report.reportedUserId, { isSuspended: true });
      } else if (action === 'ban') {
        await userRepo.update(report.reportedUserId, { isBanned: true });
      }
    }

    await activityLogRepo.create('report_action', `🚨 Admin processed report ${report.id} (${report.reason}): Action = ${actionLabel}`);

    res.json({ success: true, report: updatedReport });
  } catch (err: any) {
    console.error('Admin report action error:', err);
    res.status(500).json({ error: 'Database error executing report action.' });
  }
});

app.put('/api/admin/reports/:id', requireAdminUser, async (req, res) => {
  try {
    const adminUser = req.user;
    const report = await reportRepo.getById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const { status } = req.body;
    const updated = await reportRepo.update(req.params.id, { status });
    res.json(updated);
  } catch (err: any) {
    console.error('Update report error:', err);
    res.status(500).json({ error: 'Database error updating report.' });
  }
});

// LOST & FOUND API (SQLITE PERSISTENCE)
app.get('/api/lost-found', async (req, res) => {
  try {
    const type = req.query.type as 'lost' | 'found' | undefined;
    const status = req.query.status as string | undefined;
    const items = await lostFoundRepo.getAll(type, status);
    res.json(items);
  } catch (err: any) {
    console.error('Get lost-found error:', err);
    res.status(500).json({ error: 'Database error retrieving lost & found items.' });
  }
});

app.post('/api/lost-found', async (req, res) => {
  try {
    const user = await resolveUser(req.headers['x-user-id'] as string);
    const { title, description, category, location, itemDate, contactInfo, imageUrl, type } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    const newItem = await lostFoundRepo.create({
      title,
      description,
      category,
      location,
      itemDate,
      contactInfo,
      imageUrl,
      type: type || 'lost',
      userId: user.id,
    });

    res.status(201).json(newItem);
  } catch (err: any) {
    console.error('Create lost-found error:', err);
    res.status(500).json({ error: 'Database error creating lost/found record.' });
  }
});

app.put('/api/lost-found/:id', async (req, res) => {
  try {
    const updated = await lostFoundRepo.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Item not found' });
    res.json(updated);
  } catch (err: any) {
    console.error('Update lost-found error:', err);
    res.status(500).json({ error: 'Database error updating lost/found record.' });
  }
});

app.delete('/api/lost-found/:id', async (req, res) => {
  try {
    const deleted = await lostFoundRepo.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete lost-found error:', err);
    res.status(500).json({ error: 'Database error deleting lost/found record.' });
  }
});

// NOTIFICATIONS API (SQLITE)
app.get('/api/notifications', async (req, res) => {
  try {
    const user = await resolveUser(req.headers['x-user-id'] as string);
    const notifications = await notificationRepo.getByUser(user.id);
    res.json(notifications);
  } catch (err: any) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Database error fetching notifications.' });
  }
});

app.post('/api/notifications/:id/read', async (req, res) => {
  try {
    await notificationRepo.markAsRead(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Database error updating notification.' });
  }
});

// API fallback 404 handler - prevents returning HTML for non-existent API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

// Global API error handler ensuring JSON responses
app.use('/api', (err: any, req: any, res: any, next: any) => {
  console.error('Unhandled API error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error occurred',
  });
});

// ==========================================
// VITE MIDDLEWARE & SERVER STARTUP
// ==========================================

async function startServer() {
  try {
    console.log('[SQLite] Initializing SQLite tables & schema...');
    await initDatabase();
    console.log('[SQLite] SQLite database is fully initialized and operational.');
  } catch (err) {
    console.error('[SQLite] FATAL: Failed to initialize SQLite database:', err);
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, HOST, () => {
    console.log(`ChatSphere Server with SQLite running on ${BROWSER_ORIGIN} (bound to ${HOST}:${PORT})`);
  });
}

startServer();
