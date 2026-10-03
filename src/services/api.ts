import {
  User,
  Conversation,
  Message,
  ReportedMessage,
  LinkPreview,
  UserStatus,
  StatusComment,
  StatusReaction,
  ChatStreak,
  ScheduledMessage,
  RecurringSchedule,
  AdminDashboardOverview,
  SystemActivityLog,
  UserAnalyticsData,
} from '../types';

export function getTabSessionKey(): string {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return 'default_session_key';
  }
  let sessionKey = sessionStorage.getItem('chatsphere_session_key');
  if (!sessionKey) {
    sessionKey = typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('chatsphere_session_key', sessionKey);
  }
  return sessionKey;
}

let currentUserId: string | null = null;

export function getCurrentUserId(): string | null {
  if (currentUserId) return currentUserId;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const tabKey = getTabSessionKey();
    const saved = sessionStorage.getItem(`chatsphere_session_${tabKey}`);
    if (saved) {
      currentUserId = saved;
      return saved;
    }
  }
  return null;
}

export function setCurrentUserId(userId: string | null) {
  currentUserId = userId;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const tabKey = getTabSessionKey();
    if (userId) {
      sessionStorage.setItem(`chatsphere_session_${tabKey}`, userId);
    } else {
      sessionStorage.removeItem(`chatsphere_session_${tabKey}`);
    }
  }
  // Clear any legacy shared localStorage key to prevent cross-tab account leakage
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('chatsphere_user_id');
  }
}

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'x-user-id': getCurrentUserId() || '',
  'x-tab-id': getTabSessionKey(),
});

// Helper for robust, error-safe JSON fetching
async function safeFetch<T>(url: string, options?: RequestInit, fallback?: T): Promise<T> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    
    if (!res.ok) {
      let errMsg = `Request failed with status ${res.status}`;
      if (contentType.includes('application/json')) {
        try {
          const errData = await res.json();
          errMsg = errData.error || errData.message || errMsg;
        } catch {
          // ignore json parse error on error responses
        }
      } else {
        try {
          const text = await res.text();
          if (text && text.length < 200 && !text.includes('<!DOCTYPE')) {
            errMsg = text;
          }
        } catch {
          // ignore
        }
      }
      throw new Error(errMsg);
    }

    if (contentType.includes('application/json')) {
      return (await res.json()) as T;
    }
    return (await res.text()) as unknown as T;
  } catch (err: any) {
    if (fallback !== undefined) {
      console.warn(`[API] safeFetch warning on ${url}:`, err?.message || err);
      return fallback;
    }
    throw err;
  }
}

export const api = {
  // Auth
  async login(email: string, password?: string) {
    const cleanEmail = email.trim().toLowerCase();
    const data = await safeFetch<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password }),
    });
    if (data && data.user) {
      setCurrentUserId(data.user.id);
    }
    return data;
  },

  async register(name: string, username: string, email: string, password?: string) {
    const data = await safeFetch<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, email, password }),
    });
    if (data && data.user) {
      setCurrentUserId(data.user.id);
    }
    return data;
  },

  async changePassword() {
    return safeFetch('/api/auth/password', {
      method: 'POST',
      headers: getHeaders(),
    }, { success: true });
  },

  async sendForgotPasswordOtp(email: string): Promise<{ success: boolean; message: string }> {
    return safeFetch<{ success: boolean; message: string }>('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  },

  async resetPasswordWithOtp(email: string, otp: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return safeFetch<{ success: boolean; message: string }>('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, newPassword }),
    });
  },

  // Users
  async getUsers(): Promise<User[]> {
    return safeFetch<User[]>('/api/users', { headers: getHeaders() }, []);
  },

  async getUser(id: string): Promise<User | null> {
    return safeFetch<User | null>(`/api/users/${id}`, { headers: getHeaders() }, null);
  },

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    return safeFetch<User>(`/api/users/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
  },

  async toggleBlockUser(targetUserId: string) {
    const userId = getCurrentUserId();
    return safeFetch(`/api/users/${userId}/block`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ targetUserId }),
    }, { blockedUserIds: [] });
  },

  async manageContact(contactUserId: string, action: 'add' | 'remove') {
    const userId = getCurrentUserId();
    return safeFetch(`/api/users/${userId}/contacts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ contactUserId, action }),
    }, { contacts: [] });
  },

  async addContact(contactData: { name: string; phone?: string; username?: string; email?: string; bio?: string }): Promise<{ user: User; isNew: boolean; contacts: string[] }> {
    return safeFetch('/api/contacts/add', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(contactData),
    });
  },

  // Friend Requests API
  async getFriendRequests(): Promise<{ incoming: any[]; outgoing: any[] }> {
    return safeFetch<{ incoming: any[]; outgoing: any[] }>(
      '/api/friend-requests',
      { headers: getHeaders() },
      { incoming: [], outgoing: [] }
    );
  },

  async sendFriendRequest(receiverId: string): Promise<{ request: any }> {
    return safeFetch('/api/friend-requests/send', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ receiverId }),
    });
  },

  async respondFriendRequest(requestId: string, action: 'accept' | 'deny'): Promise<{ request: any; contacts?: string[] }> {
    return safeFetch(`/api/friend-requests/${requestId}/respond`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action }),
    });
  },

  // Conversations
  async getConversations(): Promise<Conversation[]> {
    return safeFetch<Conversation[]>('/api/conversations', { headers: getHeaders() }, []);
  },

  async createPrivateConversation(targetUserId: string): Promise<Conversation> {
    return safeFetch<Conversation>('/api/conversations', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ type: 'private', targetUserId }),
    });
  },

  async createGroupConversation(
    name: string,
    memberIds: string[],
    description?: string,
    avatar?: string
  ): Promise<Conversation> {
    return safeFetch<Conversation>('/api/conversations', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ type: 'group', name, memberIds, description, avatar }),
    });
  },

  async updateConversation(
    id: string,
    payload: {
      name?: string;
      avatar?: string;
      description?: string;
      permissions?: any;
      action?: 'pin' | 'unpin' | 'archive' | 'unarchive' | 'mute' | 'unmute' | 'add_member' | 'remove_member' | 'promote' | 'demote';
      targetUserId?: string;
    }
  ): Promise<Conversation> {
    return safeFetch<Conversation>(`/api/conversations/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
  },

  // Messages
  async getMessages(conversationId: string): Promise<Message[]> {
    return safeFetch<Message[]>(`/api/conversations/${conversationId}/messages`, {
      headers: getHeaders(),
    }, []);
  },

  async sendMessage(
    conversationId: string,
    messageData: {
      type?: string;
      text?: string;
      mediaUrl?: string;
      mediaName?: string;
      mediaSize?: number;
      mediaMime?: string;
      duration?: number;
      replyToMessageId?: string;
      linkPreview?: LinkPreview;
    }
  ): Promise<Message> {
    return safeFetch<Message>(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(messageData),
    });
  },

  async toggleReaction(messageId: string, emoji: string) {
    return safeFetch(`/api/messages/${messageId}/reaction`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ emoji }),
    }, { reactions: {} });
  },

  async toggleStar(messageId: string) {
    return safeFetch(`/api/messages/${messageId}/star`, {
      method: 'POST',
      headers: getHeaders(),
    }, { starredBy: [] });
  },

  async deleteMessage(messageId: string, mode: 'for_me' | 'for_everyone') {
    return safeFetch(`/api/messages/${messageId}?mode=${mode}`, {
      method: 'DELETE',
      headers: getHeaders(),
    }, { success: true });
  },

  async reportMessage(messageId: string, reason: string) {
    return safeFetch(`/api/messages/${messageId}/report`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason }),
    });
  },

  async fetchLinkPreview(url: string): Promise<LinkPreview> {
    return safeFetch<LinkPreview>('/api/messages/link-preview', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ url }),
    }, {
      url,
      title: 'Web Link',
      description: url,
      domain: new URL(url).hostname || '',
    });
  },

  // Upload
  async uploadFile(file: File): Promise<{ url: string; name: string; size: number; mime: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'x-user-id': getCurrentUserId() || '',
          'x-tab-id': getTabSessionKey(),
        },
        body: formData,
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok) {
        if (contentType.includes('application/json')) {
          try {
            const data = await res.json();
            if (data && data.url) {
              return data;
            }
          } catch (jsonErr) {
            console.warn('Could not parse upload json response:', jsonErr);
          }
        }
      } else {
        let errMsg = `Upload failed with status ${res.status}`;
        if (contentType.includes('application/json')) {
          try {
            const errData = await res.json();
            errMsg = errData.error || errData.message || errMsg;
          } catch {
            // ignore
          }
        }
        console.warn('Multipart upload failed:', errMsg);
      }

      // If network response was not successful JSON, fallback to base64 Data-URL or /api/upload-base64
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file as data URL'));
        reader.readAsDataURL(file);
      });

      try {
        const base64Res = await fetch('/api/upload-base64', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': getCurrentUserId() || '',
            'x-tab-id': getTabSessionKey(),
          },
          body: JSON.stringify({
            dataUrl,
            filename: file.name,
            mime: file.type,
          }),
        });

        const bContentType = base64Res.headers.get('content-type') || '';
        if (base64Res.ok && bContentType.includes('application/json')) {
          const bData = await base64Res.json();
          if (bData && bData.url) {
            return bData;
          }
        }
      } catch {
        // Fall back directly to the client data URL
      }

      return {
        url: dataUrl,
        name: file.name,
        size: file.size,
        mime: file.type || 'application/octet-stream',
      };
    } catch (err: any) {
      console.error('File upload error, attempting direct dataUrl fallback:', err);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
        return {
          url: dataUrl,
          name: file.name,
          size: file.size,
          mime: file.type || 'application/octet-stream',
        };
      } catch {
        throw new Error(err.message || 'File upload failed');
      }
    }
  },

  // Admin API Endpoints
  async getAdminDashboardData(): Promise<{
    overview: AdminDashboardOverview;
    liveActivity: SystemActivityLog[];
    analytics: UserAnalyticsData;
  }> {
    return safeFetch('/api/admin/dashboard', { headers: getHeaders() });
  },

  async getAdminUsers(): Promise<(User & { messagesCount: number; reportsCount: number })[]> {
    return safeFetch('/api/admin/users', { headers: getHeaders() }, []);
  },

  async performAdminUserAction(userId: string, action: string, extra?: { newPassword?: string }) {
    return safeFetch(`/api/admin/users/${userId}/action`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action, ...extra }),
    });
  },

  async sendAdminMessage(data: {
    recipientId?: string;
    isBroadcast?: boolean;
    title?: string;
    message: string;
  }) {
    return safeFetch('/api/admin/send-message', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
  },

  async submitUserReport(data: {
    reportedUserId: string;
    reason: string;
    messageId?: string;
    messageText?: string;
  }) {
    return safeFetch('/api/reports', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
  },

  async getAdminReports(): Promise<ReportedMessage[]> {
    return safeFetch<ReportedMessage[]>('/api/admin/reports', { headers: getHeaders() }, []);
  },

  async performAdminReportAction(reportId: string, action: string) {
    return safeFetch(`/api/admin/reports/${reportId}/action`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action }),
    });
  },

  async updateAdminReport(reportId: string, status: string) {
    return safeFetch(`/api/admin/reports/${reportId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
  },

  // Statuses / Stories API
  async getStatuses(): Promise<UserStatus[]> {
    return safeFetch<UserStatus[]>('/api/statuses', { headers: getHeaders() }, []);
  },

  async getStatus(statusId: string): Promise<UserStatus | null> {
    return safeFetch<UserStatus | null>(`/api/statuses/${statusId}`, { headers: getHeaders() }, null);
  },

  async createStatus(statusData: {
    type: 'text' | 'image' | 'video' | 'audio';
    content: string;
    caption?: string;
    bgColor?: string;
    duration?: number;
  }): Promise<UserStatus> {
    return safeFetch<UserStatus>('/api/statuses', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(statusData),
    });
  },

  async deleteStatus(statusId: string) {
    return safeFetch(`/api/statuses/${statusId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
  },

  async getStatusComments(statusId: string): Promise<StatusComment[]> {
    return safeFetch<StatusComment[]>(`/api/statuses/${statusId}/comments`, { headers: getHeaders() }, []);
  },

  async addStatusComment(statusId: string, text: string): Promise<{ success: boolean; comment: StatusComment }> {
    return safeFetch(`/api/statuses/${statusId}/comments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ text }),
    });
  },

  async deleteStatusComment(statusId: string, commentId: string): Promise<{ success: boolean }> {
    return safeFetch(`/api/statuses/${statusId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
  },

  async getStatusReactions(statusId: string): Promise<StatusReaction[]> {
    return safeFetch<StatusReaction[]>(`/api/statuses/${statusId}/reactions`, { headers: getHeaders() }, []);
  },

  async reactToStatus(
    statusId: string,
    emoji: string
  ): Promise<{ success: boolean; statusId: string; reactions: Record<string, string[]>; reactionsList: StatusReaction[] }> {
    return safeFetch(`/api/statuses/${statusId}/react`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ emoji }),
    });
  },

  // Chat Streaks
  async getStreak(conversationId: string): Promise<ChatStreak | null> {
    return safeFetch<ChatStreak | null>(`/api/streaks/${conversationId}`, { headers: getHeaders() }, null);
  },

  // Scheduled Messages
  async getScheduledMessages(): Promise<ScheduledMessage[]> {
    return safeFetch<ScheduledMessage[]>('/api/scheduled-messages', { headers: getHeaders() }, []);
  },

  async createScheduledMessage(data: {
    conversationId: string;
    type?: string;
    content: string;
    mediaUrl?: string;
    mediaName?: string;
    scheduledAt: string;
    timezone?: string;
  }): Promise<ScheduledMessage> {
    return safeFetch<ScheduledMessage>('/api/scheduled-messages', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
  },

  async cancelScheduledMessage(id: string) {
    return safeFetch(`/api/scheduled-messages/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
  },

  // Recurring Schedules
  async getRecurringSchedules(): Promise<RecurringSchedule[]> {
    return safeFetch<RecurringSchedule[]>('/api/recurring-schedules', { headers: getHeaders() }, []);
  },

  async createRecurringSchedule(data: {
    conversationId: string;
    content: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
    startAt: string;
    endRule?: 'never' | 'custom_date' | 'occurrences';
    endAt?: string;
    maxOccurrences?: number;
    timezone?: string;
  }): Promise<RecurringSchedule> {
    return safeFetch<RecurringSchedule>('/api/recurring-schedules', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
  },

  async updateRecurringScheduleStatus(id: string, action: 'pause' | 'resume' | 'cancel') {
    return safeFetch(`/api/recurring-schedules/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ action }),
    });
  },

  async deleteRecurringSchedule(id: string) {
    return safeFetch(`/api/recurring-schedules/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
  },
};
