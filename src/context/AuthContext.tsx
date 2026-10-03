import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserSettings } from '../types';
import { api, setCurrentUserId, getCurrentUserId, getTabSessionKey } from '../services/api';
import { wsClient } from '../services/websocket';

interface AuthContextType {
  currentUser: User | null;
  usersList: User[];
  settings: UserSettings;
  loading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  register: (name: string, username: string, email: string, password?: string) => Promise<void>;
  logout: () => void;
  switchUser: (userId: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  updateSettings: (updates: Partial<UserSettings>) => void;
  refreshUsers: () => Promise<void>;
}

const defaultSettings: UserSettings = {
  wallpaper: 'doodle',
  theme: 'light',
  fontSize: 'md',
  soundEnabled: true,
  enterToSend: true,
  mediaAutoDownload: true,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('chatsphere_settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  const loadInitialData = async (userId: string | null) => {
    if (!userId) {
      setCurrentUser(null);
      setCurrentUserId(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const user = await api.getUser(userId);
      if (!user || (user as any).error) {
        throw new Error('User session invalid or not found');
      }

      setCurrentUserId(userId);
      const allUsers = await api.getUsers();
      setCurrentUser(user);
      setUsersList(allUsers);
      wsClient.connect();
    } catch (err) {
      console.warn(`User session invalid or not found for ID "${userId}":`, err);
      setCurrentUserId(null);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Generate/retrieve tab's unique session key using window.crypto.randomUUID()
    const sessionKey = getTabSessionKey();
    // Retrieve authentication session associated with the current tab's unique identifier
    const savedUserId = getCurrentUserId();
    loadInitialData(savedUserId);
  }, []);

  // Sync dark theme class to document tag
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else if (settings.theme === 'light') {
      root.classList.remove('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [settings.theme]);

  const login = async (email: string, password?: string) => {
    const data = await api.login(email, password);
    setCurrentUser(data.user);
    await refreshUsers();
    wsClient.connect();
  };

  const register = async (name: string, username: string, email: string, password?: string) => {
    const data = await api.register(name, username, email, password);
    setCurrentUser(data.user);
    await refreshUsers();
    wsClient.connect();
  };

  const logout = () => {
    setCurrentUser(null);
    setCurrentUserId(null);
    wsClient.disconnect();
  };

  const switchUser = async (userId: string) => {
    await loadInitialData(userId);
  };

  const refreshUsers = async () => {
    const all = await api.getUsers();
    setUsersList(all);
  };

  // Real-time WebSocket listener for user profile updates, presence, and new registrations
  useEffect(() => {
    const unsubscribe = wsClient.subscribe((event) => {
      if (event.type === 'user_updated') {
        const updatedUser = event.payload;
        if (updatedUser.isDeleted) {
          setUsersList((prev) => prev.filter((u) => u.id !== updatedUser.id));
          if (currentUser?.id === updatedUser.id) {
            logout();
          }
        } else {
          setUsersList((prev) => {
            const exists = prev.some((u) => u.id === updatedUser.id);
            if (exists) {
              return prev.map((u) => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
            }
            return [...prev, updatedUser];
          });
          if (currentUser?.id === updatedUser.id) {
            setCurrentUser((prev) => (prev ? { ...prev, ...updatedUser } : updatedUser));
          }
        }
      } else if (event.type === 'user_registered') {
        const newUser = event.payload;
        setUsersList((prev) => {
          if (prev.some((u) => u.id === newUser.id)) return prev;
          return [...prev, newUser];
        });
      } else if (event.type === 'presence_update') {
        const { userId, status, lastSeen, forceLogout } = event.payload;
        if (forceLogout && currentUser?.id === userId) {
          logout();
          return;
        }
        setUsersList((prev) =>
          prev.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  onlineStatus: status || u.onlineStatus,
                  lastSeen: lastSeen || u.lastSeen || new Date().toISOString(),
                }
              : u
          )
        );
        if (currentUser?.id === userId) {
          setCurrentUser((prev) =>
            prev
              ? {
                  ...prev,
                  onlineStatus: status || prev.onlineStatus,
                  lastSeen: lastSeen || prev.lastSeen || new Date().toISOString(),
                }
              : null
          );
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser?.id]);

  const updateProfile = async (updates: Partial<User>) => {
    if (!currentUser) return;
    const updated = await api.updateUser(currentUser.id, updates);
    setCurrentUser(updated);
    await refreshUsers();
  };

  const updateSettings = (updates: Partial<UserSettings>) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    localStorage.setItem('chatsphere_settings', JSON.stringify(next));
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        usersList,
        settings,
        loading,
        login,
        register,
        logout,
        switchUser,
        updateProfile,
        updateSettings,
        refreshUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
