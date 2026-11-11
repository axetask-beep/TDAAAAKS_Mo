// Free substitute for real APNs push: since a free/personal-team iOS signing
// identity is never granted the Push Notifications entitlement, this app
// cannot receive true remote push. What it can do — with no entitlement and
// no Apple Developer Program membership — is have the OS wake it up every
// so often (iOS: BGTaskScheduler, opportunistic, not exact; Android:
// WorkManager, ~15 min) to poll the API and fire a *local* notification for
// anything new. It's not real-time and does nothing while the app is force-
// quit, but it covers "phone locked / app backgrounded" without any paid
// account.
//
// TaskManager.defineTask() must run at module scope, before the app ever
// renders, so it also fires on a headless background launch (the OS can
// invoke a registered task's JS callback without mounting <App/> at all).
// That's why this module is imported at the very top of index.ts, not from
// inside a component.
//
// Both native modules are lazy-`require()`d and guarded the same way as
// ../lib/localNotifications: background tasks aren't available in Expo Go,
// and a bare `import` would crash the whole app at startup there (the throw
// happens during module init, before any try/catch around a *call* could
// help — only a require() inside try/catch can be caught). Every export
// here is a no-op when either module failed to load.
import type * as ExpoTaskManager from 'expo-task-manager';
import type * as ExpoBackgroundTask from 'expo-background-task';
import { api, getStoredToken } from './api';
import { ensureNotificationHandler, presentLocalNotification } from './localNotifications';
import { loadAnnouncedIds, saveAnnouncedIds } from './notificationDedup';
import { isPushActive } from './pushToken';

export const BACKGROUND_NOTIFICATION_TASK = 'axetask-background-notification-poll';

interface Modules {
  tm: typeof ExpoTaskManager;
  bg: typeof ExpoBackgroundTask;
}

const modules: Modules | null = (() => {
  try {
    return { tm: require('expo-task-manager'), bg: require('expo-background-task') };
  } catch (err) {
    console.warn('expo-task-manager / expo-background-task unavailable (likely Expo Go — a dev build is needed for background notification polling):', err);
    return null;
  }
})();

if (modules) {
  const { tm, bg } = modules;
  tm.defineTask(BACKGROUND_NOTIFICATION_TASK, async () => {
    try {
      const token = await getStoredToken();
      if (!token) return bg.BackgroundTaskResult.Success; // logged out — nothing to poll
      if (await isPushActive()) return bg.BackgroundTaskResult.Success; // server pushes instead

      ensureNotificationHandler();

      const list = await api.getNotifications();
      const unread = list.filter(n => !n.is_read);

      const announcedIds = await loadAnnouncedIds();
      const newOnes = unread.filter(n => !announcedIds.has(n.id));

      for (const n of newOnes.slice(0, 3)) {
        await presentLocalNotification(n.title, n.message || undefined, {
          id: n.id,
          type: n.type,
          ...(n.task_id ? { task_id: n.task_id } : {}),
          ...(n.workspace_id ? { workspace_id: n.workspace_id } : {}),
        });
      }

      saveAnnouncedIds(new Set(list.map(n => n.id)));

      return bg.BackgroundTaskResult.Success;
    } catch (err) {
      console.warn('Background notification poll failed:', err);
      return bg.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerBackgroundNotificationTask() {
  if (!modules) return;
  const { tm, bg } = modules;
  try {
    const already = await tm.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
    if (already) return;
    await bg.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK, {
      minimumInterval: 15, // minutes — the platform floor; iOS treats this as a hint, not a guarantee
    });
  } catch (err) {
    console.warn('Failed to register background notification task:', err);
  }
}

export async function unregisterBackgroundNotificationTask() {
  if (!modules) return;
  const { tm, bg } = modules;
  try {
    const already = await tm.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
    if (!already) return;
    await bg.unregisterTaskAsync(BACKGROUND_NOTIFICATION_TASK);
  } catch (err) {
    console.warn('Failed to unregister background notification task:', err);
  }
}
