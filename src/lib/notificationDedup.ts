// Shared "only ever announce a given notification id once" bookkeeping,
// used by both the foreground poll (NotificationsContext) and the
// background task (backgroundNotificationTask) so they share one
// AsyncStorage-backed set and never double-announce the same id between
// the two code paths.
import AsyncStorage from '@react-native-async-storage/async-storage';

const ANNOUNCED_IDS_KEY = 'axetask_announced_notification_ids';

export async function loadAnnouncedIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(ANNOUNCED_IDS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveAnnouncedIds(ids: Set<string>) {
  AsyncStorage.setItem(ANNOUNCED_IDS_KEY, JSON.stringify([...ids])).catch(() => {});
}

export async function clearAnnouncedIds() {
  await AsyncStorage.removeItem(ANNOUNCED_IDS_KEY).catch(() => {});
}
