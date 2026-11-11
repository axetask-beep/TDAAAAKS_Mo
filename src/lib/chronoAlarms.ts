// Mobile version of the web chrono sound alerts (AXETASKS FloatingTimer): for
// each of my tasks in progress, a notification 5 min before the end (my sound),
// then the 3 s alarm at the end and every 15 min while it stays overdue.
// Scheduled ahead as local notifications, so they ring even with the app closed.
import { Platform } from 'react-native';
import { api } from './api';
import { getModule, channelIdFor } from './localNotifications';
import { getSoundSettingsSync } from './sound';
import { Task } from '../types';

const PREWARN_MS = 5 * 60 * 1000;
const REMIND_MS = 15 * 60 * 1000;
// ponytail: reminders stop after 2 h overdue; the next refresh (app open or background task) schedules more.
const MAX_REMINDERS = 8;
export const ALARM_CHANNEL = 'chrono_alarm';

let lastKey = '';
let nextRefreshAt = Infinity;

export async function ensureAlarmChannel() {
  const n = getModule();
  if (!n || Platform.OS !== 'android') return;
  await n.setNotificationChannelAsync(ALARM_CHANNEL, {
    name: 'Alarme du chrono',
    importance: n.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 200, 500],
    lightColor: '#F43F5E',
    sound: 'alarm',
    audioAttributes: { usage: n.AndroidAudioUsage.ALARM, contentType: n.AndroidAudioContentType.SONIFICATION },
  }).catch(() => {});
}

export async function refreshChronoAlarms(userId: string) {
  const n = getModule();
  if (!n) return;
  try {
    const tasks = (await api.getDashboardTasks()).filter(
      (t: Task) => t.status === 'en_cours' && t.assignee_id === userId && t.end_at && !t.completed_at && !t.stopped_at,
    );
    const { enabled, type } = getSoundSettingsSync();
    const key = JSON.stringify([enabled, type, tasks.map(t => [t.id, t.end_at])]);
    const now = Date.now();
    // Same tasks and settings: the alarms already scheduled are still right (unless the reminders ran out).
    if (key === lastKey && now < nextRefreshAt) return;
    lastKey = key;
    nextRefreshAt = Infinity;

    const scheduled = await n.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.filter(s => s.content.data?.chrono).map(s => n.cancelScheduledNotificationAsync(s.identifier)));

    for (const t of tasks) {
      const end = new Date(t.end_at!).getTime();
      const alerts: { at: number; title: string; alarm: boolean }[] = [
        { at: end - PREWARN_MS, title: `⏳ Plus que 5 min : ${t.title}`, alarm: false },
        { at: end, title: `⏰ Temps écoulé : ${t.title}`, alarm: true },
      ];
      for (let i = 1; i <= MAX_REMINDERS; i++) alerts.push({ at: end + i * REMIND_MS, title: `⏰ Toujours en retard (${i * 15} min) : ${t.title}`, alarm: true });
      const upcoming = alerts.filter(a => a.at > now);
      if (upcoming.length) nextRefreshAt = Math.min(nextRefreshAt, upcoming[upcoming.length - 1].at);
      for (const a of upcoming) {
        const channel = Platform.OS === 'android' ? { channelId: !enabled ? 'silent' : a.alarm ? ALARM_CHANNEL : channelIdFor(type) } : {};
        await n.scheduleNotificationAsync({
          content: {
            title: a.title,
            body: 'Touchez pour ouvrir la tâche.',
            data: { chrono: '1', task_id: t.id },
            sound: !enabled ? false : a.alarm ? 'alarm.wav' : `${type}.wav`,
            ...channel,
          },
          trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: a.at, ...channel },
        });
      }
    }
  } catch (err) {
    lastKey = ''; // retry on the next refresh
    console.warn('[chrono] scheduling alarms failed:', err);
  }
}

export async function cancelChronoAlarms() {
  lastKey = '';
  const n = getModule();
  if (!n) return;
  const scheduled = await n.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(scheduled.filter(s => s.content.data?.chrono).map(s => n.cancelScheduledNotificationAsync(s.identifier)));
}
