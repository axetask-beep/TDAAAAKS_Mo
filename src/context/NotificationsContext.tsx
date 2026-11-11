// Mirrors AXETASKS/src/components/notifications/NotificationsBell.tsx — same
// polling model, same "only ever announce a given id once" guarantee (here
// via AsyncStorage instead of the web's localStorage), but "signal on the
// device" means something more literal on a phone: a real OS notification
// via expo-notifications (system tray, plays the platform's default
// notification sound) rather than the browser's Notification API. All
// contact with that package goes through ../lib/localNotifications, which
// degrades to a no-op if the native module isn't available (see that file).
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { api } from '../lib/api';
import { ensureNotificationHandler, ensureAndroidChannel, ensurePermission, askPermissionOnLogin, presentLocalNotification } from '../lib/localNotifications';
import { ensureSoundSettingsLoaded } from '../lib/sound';
import { registerBackgroundNotificationTask, unregisterBackgroundNotificationTask } from '../lib/backgroundNotificationTask';
import { loadAnnouncedIds, saveAnnouncedIds, clearAnnouncedIds } from '../lib/notificationDedup';
import { registerPushToken, isPushActive } from '../lib/pushToken';
import { ensureAlarmChannel, refreshChronoAlarms, cancelChronoAlarms } from '../lib/chronoAlarms';
import { AppNotification } from '../types';
import { useAuth } from './AuthContext';

const POLL_INTERVAL_MS = 20000;

interface NotificationsContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteOne: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const announcedIdsRef = useRef<Set<string> | null>(null);
  const isFirstPollRef = useRef(true);
  const permissionAskedRef = useRef(false);

  useEffect(() => {
    ensureNotificationHandler();
    ensureSoundSettingsLoaded().then(ensureAndroidChannel).then(ensureAlarmChannel);
  }, []);

  const askPermissionOnce = useCallback(async () => {
    if (permissionAskedRef.current) return;
    permissionAskedRef.current = true;
    await ensurePermission();
  }, []);

  const poll = useCallback(async () => {
    if (!user) return;
    try {
      if (!announcedIdsRef.current) {
        announcedIdsRef.current = await loadAnnouncedIds();
      }

      const list = await api.getNotifications();
      const unread = list.filter(n => !n.is_read);

      if (!isFirstPollRef.current) {
        const newOnes = unread.filter(n => !announcedIdsRef.current!.has(n.id));
        // With native push active the server already delivered these.
        if (newOnes.length > 0 && !(await isPushActive())) {
          await askPermissionOnce();
          for (const n of newOnes.slice(0, 3)) {
            presentLocalNotification(n.title, n.message || undefined, notificationData(n));
          }
        }
      }
      isFirstPollRef.current = false;

      announcedIdsRef.current = new Set(list.map(n => n.id));
      saveAnnouncedIds(announcedIdsRef.current);

      setNotifications(list);
      setUnreadCount(unread.length);
    } catch (err) {
      console.error('Failed to poll notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user, askPermissionOnce]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      isFirstPollRef.current = true;
      announcedIdsRef.current = null;
      permissionAskedRef.current = false; // ask again on the next login
      unregisterBackgroundNotificationTask();
      cancelChronoAlarms();
      return;
    }
    // Ask right away (not on the first alert): the background task and
    // native push can only show anything once permission is granted.
    permissionAskedRef.current = true;
    askPermissionOnLogin().then(registerPushToken);
    poll();
    registerBackgroundNotificationTask();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    // Chrono alarms: rescheduled when my tasks in progress (or their end) change.
    const chrono = () => refreshChronoAlarms(user.id);
    chrono();
    const chronoInterval = setInterval(chrono, 60_000);
    // Also when leaving the app, so a task just finished doesn't ring later.
    const appState = AppState.addEventListener('change', chrono);
    return () => { clearInterval(interval); clearInterval(chronoInterval); appState.remove(); };
  }, [user, poll]);

  const markRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteOne = async (id: string) => {
    try {
      await api.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const clearAll = async () => {
    try {
      await api.clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
      announcedIdsRef.current = new Set();
      await clearAnnouncedIds();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, loading, refresh: poll, markRead, markAllRead, deleteOne, clearAll }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export function notificationData(n: AppNotification): Record<string, string> {
  const data: Record<string, string> = { id: n.id, type: n.type };
  if (n.task_id) data.task_id = n.task_id;
  if (n.workspace_id) data.workspace_id = n.workspace_id;
  return data;
}

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};
