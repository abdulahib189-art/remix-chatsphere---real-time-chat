import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  X,
  Users,
  UserCheck,
  Radio,
  AlertTriangle,
  UserX,
  TrendingUp,
  Bell,
  Search,
  CheckCircle2,
  Lock,
  Ban,
  AlertCircle,
  Key,
  LogOut,
  BadgeCheck,
  Trash2,
  Eye,
  Activity,
  BarChart3,
  Check,
  Shield,
  FileText,
  Clock,
  Sparkles,
  Megaphone,
  Send,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import {
  User,
  ReportedMessage,
  AdminDashboardOverview,
  SystemActivityLog,
  UserAnalyticsData,
} from '../types';
import { api } from '../services/api';

type DashboardTab = 'overview' | 'users' | 'reports' | 'messages' | 'analytics';

export const AdminModal: React.FC = () => {
  const { currentUser } = useAuth();
  const { adminModalOpen, setAdminModalOpen } = useChat();

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [loading, setLoading] = useState(true);

  // Data states
  const [overview, setOverview] = useState<AdminDashboardOverview>({
    totalUsers: 0,
    activeUsers: 0,
    onlineUsers: 0,
    pendingReports: 0,
    suspendedAccounts: 0,
    newUsersToday: 0,
    systemAlerts: 0,
  });
  const [liveActivity, setLiveActivity] = useState<SystemActivityLog[]>([]);
  const [analytics, setAnalytics] = useState<UserAnalyticsData>({
    dau: 0,
    mau: 0,
    newRegistrationsToday: 0,
    avgSessionDuration: '0 min',
    dauTrend: [],
    messageVolumeTrend: [],
    reportsCategoryDistribution: [],
  });

  const [usersList, setUsersList] = useState<(User & { messagesCount: number; reportsCount: number })[]>([]);
  const [reportsList, setReportsList] = useState<ReportedMessage[]>([]);

  // User Management State
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<(User & { messagesCount: number; reportsCount: number }) | null>(null);
  const [resetPassModalOpen, setResetPassModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  // Report Filter State
  const [reportFilter, setReportFilter] = useState<string>('all');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Admin Direct Message & Announcement State
  const [msgTargetType, setMsgTargetType] = useState<'broadcast' | 'user'>('broadcast');
  const [msgRecipientId, setMsgRecipientId] = useState<string>('');
  const [msgTitle, setMsgTitle] = useState<string>('Official Announcement');
  const [msgContent, setMsgContent] = useState<string>('');
  const [sendingNotice, setSendingNotice] = useState<boolean>(false);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminDashboardData();
      setOverview(data.overview);
      setLiveActivity(data.liveActivity || []);
      setAnalytics(data.analytics);

      const usersData = await api.getAdminUsers();
      setUsersList(usersData);

      const reportsData = await api.getAdminReports();
      setReportsList(reportsData);
    } catch (err) {
      console.error('Failed to load admin dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminModalOpen) {
      loadDashboardData();
    }
  }, [adminModalOpen]);

  if (!adminModalOpen || !currentUser || currentUser.role !== 'admin') return null;

  const showSuccessNotice = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => {
      setActionSuccessMsg(null);
    }, 4500);
  };

  const handleUserAction = async (userId: string, action: string, extra?: { newPassword?: string }) => {
    try {
      await api.performAdminUserAction(userId, action, extra);
      showSuccessNotice(`User action '${action.toUpperCase()}' applied successfully. User was notified!`);
      await loadDashboardData();
      if (selectedUser && selectedUser.id === userId) {
        // refresh selected user
        const updatedUsers = await api.getAdminUsers();
        const updated = updatedUsers.find((u) => u.id === userId);
        if (updated) setSelectedUser(updated);
      }
    } catch (err) {
      console.error('Failed to perform user action:', err);
    }
  };

  const handleReportAction = async (reportId: string, action: string) => {
    try {
      await api.performAdminReportAction(reportId, action);
      showSuccessNotice(`Report action '${action.toUpperCase()}' executed! Both reporter & target user were notified.`);
      await loadDashboardData();
    } catch (err) {
      console.error('Failed to execute report action:', err);
    }
  };

  const handleSendAdminNotice = async () => {
    if (!msgContent.trim()) {
      alert('Please enter a message to send.');
      return;
    }
    if (msgTargetType === 'user' && !msgRecipientId) {
      alert('Please select a recipient user.');
      return;
    }

    try {
      setSendingNotice(true);
      await api.sendAdminMessage({
        isBroadcast: msgTargetType === 'broadcast',
        recipientId: msgTargetType === 'user' ? msgRecipientId : undefined,
        title: msgTitle.trim() || 'Official Announcement',
        message: msgContent.trim(),
      });

      showSuccessNotice(
        msgTargetType === 'broadcast'
          ? '📢 Official announcement successfully broadcast to all users!'
          : '💬 Official admin message delivered directly to user.'
      );
      setMsgContent('');
      await loadDashboardData();
    } catch (err: any) {
      console.error('Failed to send admin message:', err);
      alert(err.message || 'Failed to dispatch admin communication.');
    } finally {
      setSendingNotice(false);
    }
  };

  const filteredUsers = usersList.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredReports = reportsList.filter((r) => {
    if (reportFilter === 'all') return true;
    return r.status === reportFilter;
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 z-50 select-none animate-fade-in">
      <div className="bg-slate-900 text-slate-100 w-full max-w-6xl h-[92vh] rounded-3xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold shadow-lg shadow-amber-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-lg sm:text-xl text-white tracking-tight">
                  Admin Dashboard
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  SYSTEM SUPERVISOR
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Logged in as <span className="text-amber-300 font-medium">{currentUser.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => loadDashboardData()}
              className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800 transition text-xs flex items-center gap-1.5"
              title="Refresh Data"
            >
              <Activity className="w-4 h-4 text-emerald-400 animate-spin-slow" />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => setAdminModalOpen(false)}
              className="p-2 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Success Toast Notification */}
        {actionSuccessMsg && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/40 p-3 px-5 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{actionSuccessMsg}</span>
            </div>
            <button onClick={() => setActionSuccessMsg(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Dashboard Navigation Tabs */}
        <div className="bg-slate-950/80 border-b border-slate-800 px-4 flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            🖥️ Overview
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            👥 User Management
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
              {usersList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`py-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'reports'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            🚨 Reports
            {overview.pendingReports > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-[10px] font-black text-white animate-pulse">
                {overview.pendingReports}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('messages')}
            className={`py-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'messages'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            📢 Admin Notices & Broadcasts
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            📊 Analytics
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900/60 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-slate-400 font-medium">Loading admin dashboard intelligence...</p>
            </div>
          ) : activeTab === 'overview' ? (
            /* TAB 1: MAIN DASHBOARD OVERVIEW */
            <div className="space-y-6">
              {/* Overview Metric Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>👥 Total Users</span>
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-black text-white">{overview.totalUsers}</p>
                    <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Registered accounts
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>🟢 Active Users</span>
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-black text-emerald-400">{overview.activeUsers}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Online & recently active</p>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>🟡 Users Online Now</span>
                    <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-black text-amber-400">{overview.onlineUsers}</p>
                    <p className="text-[10px] text-amber-400/80 mt-1">Connected in WebSocket session</p>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>🚨 Pending Reports</span>
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-black text-red-400">{overview.pendingReports}</p>
                    <p className="text-[10px] text-red-400/80 mt-1">Requires admin review</p>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>🔒 Suspended Accounts</span>
                    <UserX className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-black text-purple-300">{overview.suspendedAccounts}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Suspended or banned users</p>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>📈 New Users Today</span>
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-black text-cyan-300">{overview.newUsersToday}</p>
                    <p className="text-[10px] text-cyan-400/80 mt-1">Joined in last 24h</p>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col justify-between col-span-2 sm:col-span-2">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>⚠️ System Alerts</span>
                    <Bell className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-xl font-bold text-amber-300">
                        {overview.systemAlerts === 0 ? 'All Systems Clear' : `${overview.systemAlerts} Action Items`}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {overview.systemAlerts === 0
                          ? 'No pending flag security risks.'
                          : 'Pending reports & moderation items requiring attention.'}
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('reports')}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition shadow"
                    >
                      Review Reports
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Activity Feed */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Live Activity Stream
                  </h3>
                  <span className="text-[11px] text-slate-400 bg-slate-900 px-2.5 py-1 rounded-full border border-slate-800">
                    Real-time updates
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {liveActivity.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">No recent live activity recorded.</p>
                  ) : (
                    liveActivity.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 bg-slate-900/80 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs hover:border-slate-700 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm">
                            {log.type === 'user_registered'
                              ? '👤'
                              : log.type === 'report_received'
                              ? '🚨'
                              : log.type === 'account_suspended'
                              ? '🔒'
                              : log.type === 'account_verified'
                              ? '✓'
                              : '⚠️'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-200">{log.description}</p>
                            {log.userName && (
                              <p className="text-[10px] text-slate-400">Target User: {log.userName}</p>
                            )}
                          </div>
                        </div>

                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'users' ? (
            /* TAB 2: USER MANAGEMENT */
            <div className="space-y-5">
              {/* Search & Filter Header */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/80 border border-slate-800 p-4 rounded-2xl">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search name, username, email..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                  />
                </div>

                <div className="text-xs text-slate-400 font-medium">
                  Showing <span className="text-amber-400 font-bold">{filteredUsers.length}</span> registered accounts
                </div>
              </div>

              {/* User Accounts Table */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3.5 pl-4">User</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5">Last Seen</th>
                        <th className="p-3.5">Messages</th>
                        <th className="p-3.5">Reports</th>
                        <th className="p-3.5 pr-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500">
                            No users matched search criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => {
                          const isOnline = u.onlineStatus === 'online';
                          const isAway = u.onlineStatus === 'away';

                          return (
                            <tr key={u.id} className="hover:bg-slate-900/50 transition">
                              <td className="p-3.5 pl-4">
                                <div className="flex items-center gap-3">
                                  <div className="relative">
                                    <img
                                      src={u.avatar}
                                      alt={u.name}
                                      className="w-9 h-9 rounded-full object-cover border border-slate-700"
                                    />
                                    <span
                                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
                                        isOnline ? 'bg-emerald-500' : isAway ? 'bg-amber-500' : 'bg-slate-500'
                                      }`}
                                    />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                                      <span>{u.name}</span>
                                      {u.isVerified && (
                                        <BadgeCheck className="w-4 h-4 text-blue-400 fill-blue-500/20" aria-label="Verified User" />
                                      )}
                                      {u.role === 'admin' && (
                                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold">
                                          ADMIN
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-400">@{u.username} • {u.email}</p>
                                  </div>
                                </div>
                              </td>

                              <td className="p-3.5 font-medium">
                                {u.isBanned ? (
                                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold">
                                    ⛔ Banned
                                  </span>
                                ) : u.isSuspended ? (
                                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] font-bold">
                                    🔒 Suspended
                                  </span>
                                ) : isOnline ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                                    🟢 Active
                                  </span>
                                ) : isAway ? (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                                    🟡 Away
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">
                                    🔴 Offline
                                  </span>
                                )}
                              </td>

                              <td className="p-3.5 text-slate-400 text-[11px]">
                                {isOnline ? 'Just now' : new Date(u.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>

                              <td className="p-3.5 font-bold text-slate-300">{u.messagesCount}</td>

                              <td className="p-3.5">
                                {u.reportsCount > 0 ? (
                                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold text-[10px]">
                                    {u.reportsCount} reports
                                  </span>
                                ) : (
                                  <span className="text-slate-500">0</span>
                                )}
                              </td>

                              <td className="p-3.5 pr-4 text-right">
                                <button
                                  onClick={() => setSelectedUser(u)}
                                  className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs rounded-xl border border-amber-500/30 transition flex items-center gap-1 ml-auto"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Manage
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* User Detail & Actions Modal */}
              {selectedUser && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="bg-slate-900 border border-slate-800 text-slate-100 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-amber-400" />
                        <h3 className="font-extrabold text-base text-white">User Profile & Admin Control</h3>
                      </div>
                      <button
                        onClick={() => setSelectedUser(null)}
                        className="p-1 text-slate-400 hover:text-white rounded-lg"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Profile Summary Card */}
                    <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-start gap-4">
                      <img
                        src={selectedUser.avatar}
                        alt={selectedUser.name}
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-800 shadow-md"
                      />
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-base text-white">{selectedUser.name}</h4>
                          {selectedUser.isVerified && (
                            <BadgeCheck className="w-4 h-4 text-blue-400" aria-label="Verified User" />
                          )}
                        </div>
                        <p className="text-xs text-amber-400 font-medium">@{selectedUser.username}</p>
                        <p className="text-xs text-slate-400">{selectedUser.email}</p>
                        {selectedUser.phone && <p className="text-xs text-slate-400">📞 {selectedUser.phone}</p>}
                      </div>
                    </div>

                    {/* User Metadata Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950 p-3 rounded-2xl border border-slate-800">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Registration Date:</span>
                        <span className="font-semibold text-slate-300">
                          {new Date(selectedUser.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Last Login / Active:</span>
                        <span className="font-semibold text-slate-300">
                          {new Date(selectedUser.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Account Status:</span>
                        <span className="font-bold text-amber-400">
                          {selectedUser.isBanned
                            ? '⛔ Banned'
                            : selectedUser.isSuspended
                            ? '🔒 Suspended'
                            : selectedUser.onlineStatus.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Warnings Received:</span>
                        <span className="font-bold text-amber-400">{selectedUser.warningsCount || 0}</span>
                      </div>
                    </div>

                    {/* Admin Action Buttons (Notifies User) */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        ⚡ Take Admin Action (User will be notified)
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Suspend Toggle */}
                        <button
                          onClick={() => handleUserAction(selectedUser.id, 'suspend')}
                          className={`p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border ${
                            selectedUser.isSuspended
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                              : 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30'
                          }`}
                        >
                          <Lock className="w-3.5 h-3.5" />
                          {selectedUser.isSuspended ? 'Un-Suspend' : 'Suspend'}
                        </button>

                        {/* Ban Toggle */}
                        <button
                          onClick={() => handleUserAction(selectedUser.id, 'ban')}
                          className={`p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border ${
                            selectedUser.isBanned
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                              : 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30'
                          }`}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          {selectedUser.isBanned ? 'Un-Ban' : 'Ban Account'}
                        </button>

                        {/* Warn User with MANDATORY message "Baaritaan ayaa ku socoda account kaaga" */}
                        <button
                          onClick={() => handleUserAction(selectedUser.id, 'warn')}
                          className="p-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40 rounded-xl text-xs transition flex items-center justify-center gap-2"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Warn User
                        </button>

                        {/* Verify Badge Toggle */}
                        <button
                          onClick={() => handleUserAction(selectedUser.id, 'verify')}
                          className={`p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border ${
                            selectedUser.isVerified
                              ? 'bg-slate-800 text-slate-400 border-slate-700'
                              : 'bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30'
                          }`}
                        >
                          <BadgeCheck className="w-3.5 h-3.5" />
                          {selectedUser.isVerified ? 'Remove Verified' : 'Verify Badge ✓'}
                        </button>

                        {/* Reset Password */}
                        <button
                          onClick={() => setResetPassModalOpen(true)}
                          className="p-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold border border-cyan-500/40 rounded-xl text-xs transition flex items-center justify-center gap-2"
                        >
                          <Key className="w-3.5 h-3.5" />
                          Reset Password
                        </button>

                        {/* Force Logout */}
                        <button
                          onClick={() => handleUserAction(selectedUser.id, 'force_logout')}
                          className="p-2.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 font-bold border border-orange-500/40 rounded-xl text-xs transition flex items-center justify-center gap-2"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Force Logout
                        </button>

                        {/* Delete User */}
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to permanently delete user ${selectedUser.name}?`)) {
                              handleUserAction(selectedUser.id, 'delete');
                              setSelectedUser(null);
                            }
                          }}
                          className="col-span-2 p-2.5 bg-red-600/30 hover:bg-red-600/40 text-red-200 font-bold border border-red-500/50 rounded-xl text-xs transition flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete User Account
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Reset Password Modal */}
              {resetPassModalOpen && selectedUser && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
                  <div className="bg-slate-900 border border-slate-800 text-slate-100 w-full max-w-md rounded-2xl p-5 space-y-4 shadow-2xl">
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      <Key className="w-4 h-4 text-cyan-400" />
                      Reset Password for {selectedUser.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Enter a new password for this user. The user will receive an automated support message with their updated credentials.
                    </p>
                    <input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (e.g. Reset2026!)"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => setResetPassModalOpen(false)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          handleUserAction(selectedUser.id, 'reset_password', { newPassword });
                          setResetPassModalOpen(false);
                          setNewPassword('');
                        }}
                        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs rounded-xl"
                      >
                        Apply New Password
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'reports' ? (
            /* TAB 3: REPORTS MANAGEMENT */
            <div className="space-y-5">
              {/* Filter Tabs Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950/80 border border-slate-800 p-4 rounded-2xl">
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none w-full sm:w-auto">
                  {['all', 'pending', 'reviewed', 'resolved', 'dismissed', 'escalated'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setReportFilter(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition ${
                        reportFilter === st
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <p className="text-xs text-amber-300/80 font-medium">
                  📢 Action on any report notifies BOTH the reporter and target user automatically.
                </p>
              </div>

              {/* Reports List */}
              <div className="space-y-3">
                {filteredReports.length === 0 ? (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-12 text-center space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                    <h4 className="font-bold text-white text-sm">No Pending Reports</h4>
                    <p className="text-xs text-slate-500">
                      All content moderation flags in this category have been addressed.
                    </p>
                  </div>
                ) : (
                  filteredReports.map((rep) => (
                    <div
                      key={rep.id}
                      className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 hover:border-slate-700 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 font-extrabold text-[11px] border border-red-500/30">
                            Reason: {rep.reason}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              rep.status === 'pending'
                                ? 'bg-amber-500/20 text-amber-400'
                                : rep.status === 'resolved'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            Status: {rep.status}
                          </span>
                        </div>

                        <span className="text-[11px] text-slate-500">
                          📅 {new Date(rep.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                        <div>
                          <p className="text-slate-500 text-[10px]">Reported User (Target):</p>
                          <p className="font-bold text-white text-sm">{rep.reportedUserName}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[10px]">Reported By (Reporter):</p>
                          <p className="font-bold text-slate-300">{rep.reportedByName}</p>
                        </div>
                      </div>

                      {rep.messageText && (
                        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 italic">
                          "{rep.messageText}"
                        </div>
                      )}

                      {/* Admin Decision Actions */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                        <span className="text-[11px] text-slate-400 font-bold mr-1">Admin Decisions:</span>

                        <button
                          onClick={() => handleReportAction(rep.id, 'review')}
                          className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-bold text-xs rounded-xl border border-blue-500/30 transition"
                        >
                          🔍 Review
                        </button>

                        <button
                          onClick={() => handleReportAction(rep.id, 'dismiss')}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
                        >
                          ❌ Dismiss
                        </button>

                        <button
                          onClick={() => handleReportAction(rep.id, 'warn_user')}
                          className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs rounded-xl border border-amber-500/30 transition"
                          title="Sends warning: Baaritaan ayaa ku socoda account kaaga"
                        >
                          ⚠️ Warn User
                        </button>

                        <button
                          onClick={() => handleReportAction(rep.id, 'suspend')}
                          className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-bold text-xs rounded-xl border border-purple-500/30 transition"
                        >
                          🔒 Suspend
                        </button>

                        <button
                          onClick={() => handleReportAction(rep.id, 'ban')}
                          className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs rounded-xl border border-red-500/30 transition"
                        >
                          ⛔ Ban
                        </button>

                        <button
                          onClick={() => handleReportAction(rep.id, 'escalate')}
                          className="px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 font-bold text-xs rounded-xl border border-orange-500/30 transition"
                        >
                          🚀 Escalate
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : activeTab === 'messages' ? (
            /* TAB 4: OFFICIAL ADMIN NOTICES & DIRECT MESSAGING */
            <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
              <div className="p-5 bg-slate-950/90 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-amber-400" />
                    <div>
                      <h3 className="font-extrabold text-base text-white">Dispatch Official Admin Communications</h3>
                      <p className="text-xs text-slate-400">
                        Messages are dispatched directly from your authenticated Admin account ({currentUser.name}) and permanently persisted in the database.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Target Audience Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    1. Recipient Scope
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setMsgTargetType('broadcast')}
                      className={`p-3.5 rounded-2xl text-xs font-bold border transition flex items-center justify-center gap-2 ${
                        msgTargetType === 'broadcast'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-850'
                      }`}
                    >
                      <Radio className="w-4 h-4 text-amber-400" />
                      Broadcast to All Registered Users ({usersList.filter((u) => u.id !== currentUser.id).length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setMsgTargetType('user')}
                      className={`p-3.5 rounded-2xl text-xs font-bold border transition flex items-center justify-center gap-2 ${
                        msgTargetType === 'user'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-850'
                      }`}
                    >
                      <Users className="w-4 h-4 text-amber-400" />
                      Direct Message Specific User
                    </button>
                  </div>
                </div>

                {/* If Single User: Select User */}
                {msgTargetType === 'user' && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                      Target User Account
                    </label>
                    <select
                      value={msgRecipientId}
                      onChange={(e) => setMsgRecipientId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="">-- Choose registered user to message --</option>
                      {usersList
                        .filter((u) => u.id !== currentUser.id)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} (@{u.username}) • {u.email}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Notice Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    2. Notice / Announcement Title
                  </label>
                  <input
                    type="text"
                    value={msgTitle}
                    onChange={(e) => setMsgTitle(e.target.value)}
                    placeholder="e.g. System Security Update, Community Guidelines Notice"
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Notice Content */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    3. Official Message Content
                  </label>
                  <textarea
                    rows={4}
                    value={msgContent}
                    onChange={(e) => setMsgContent(e.target.value)}
                    placeholder="Enter the official notification or announcement message here. It will immediately show up in the user's chat and notification stream in real-time."
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>

                {/* Dispatch Button */}
                <div className="flex items-center justify-between pt-2">
                  <p className="text-[11px] text-slate-400">
                    🔒 Sent securely with sender identity: <span className="text-amber-400 font-bold">{currentUser.name} (Admin)</span>
                  </p>

                  <button
                    type="button"
                    disabled={sendingNotice || !msgContent.trim() || (msgTargetType === 'user' && !msgRecipientId)}
                    onClick={handleSendAdminNotice}
                    className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 text-slate-950 font-black text-xs rounded-2xl shadow-lg shadow-amber-500/20 transition flex items-center gap-2"
                  >
                    {sendingNotice ? (
                      <>
                        <Activity className="w-4 h-4 animate-spin" />
                        Dispatching...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        {msgTargetType === 'broadcast' ? 'Broadcast Official Notice' : 'Send Admin Message'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 5: ANALYTICS VISUALIZATION */
            <div className="space-y-6">
              {/* Analytics Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl">
                  <p className="text-xs text-slate-400">DAU (Daily Active Users)</p>
                  <p className="text-2xl font-black text-amber-400 mt-1">{analytics.dau}</p>
                  <p className="text-[10px] text-emerald-400 mt-1">Active within 24h</p>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl">
                  <p className="text-xs text-slate-400">MAU (Monthly Active Users)</p>
                  <p className="text-2xl font-black text-blue-400 mt-1">{analytics.mau}</p>
                  <p className="text-[10px] text-blue-400/80 mt-1">30-day active pool</p>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl">
                  <p className="text-xs text-slate-400">New Registrations Today</p>
                  <p className="text-2xl font-black text-emerald-400 mt-1">{analytics.newRegistrationsToday}</p>
                  <p className="text-[10px] text-emerald-400/80 mt-1">+100% vs yesterday</p>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl">
                  <p className="text-xs text-slate-400">Avg. Session Duration</p>
                  <p className="text-2xl font-black text-purple-300 mt-1">{analytics.avgSessionDuration}</p>
                  <p className="text-[10px] text-purple-400/80 mt-1">High engagement rate</p>
                </div>
              </div>

              {/* Recharts Graphs */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Graph 1: DAU & New Users Line Chart */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    Daily Active Users & Registrations Trend
                  </h4>

                  <div className="h-60 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.dauTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                        />
                        <Line type="monotone" dataKey="dau" stroke="#f59e0b" strokeWidth={3} name="DAU" />
                        <Line type="monotone" dataKey="newUsers" stroke="#10b981" strokeWidth={2} name="New Users" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Graph 2: Message Volume Area Chart */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    Message Volume Trend (Weekly)
                  </h4>

                  <div className="h-60 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.messageVolumeTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                        />
                        <Area type="monotone" dataKey="messages" stroke="#3b82f6" fill="#3b82f620" name="Messages" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Graph 3: Report Category Distribution Bar Chart */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 lg:col-span-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    Reported Reasons Category Breakdown
                  </h4>

                  <div className="h-64 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.reportsCategoryDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="category" stroke="#94a3b8" fontSize={10} />
                        <YAxis stroke="#94a3b8" fontSize={11} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                        />
                        <Bar dataKey="count" fill="#ef4444" radius={[6, 6, 0, 0]} name="Reports" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
