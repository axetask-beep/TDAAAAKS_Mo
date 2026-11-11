// Thin, defensive wrapper around expo-notifications. In Expo Go on recent
// SDKs, this package throws as soon as its native side initializes (a
// deliberate crash Expo added to push people to a dev build for remote
// push — see "Android Push notifications (remote notifications) ... was
// removed from Expo Go"), and that throw happens before a `try/catch`
// around a *call* can help, because it happens during module *import*.
// A static `import * as Notifications from 'expo-notifications'` can't be
// guarded — the `require()` below can, since it's an ordinary function call.
// Every export here is a no-op when the module failed to load, so the rest
// of the app (polling, badges, the in-app notification list) keeps working
// with just the device-level signal silently missing.
import type * as ExpoNotifications from 'expo-notifications';
import { Alert, Linking, Platform } from 'react-native';
import { SOUND_TYPES, getSoundSettingsSync } from './sound';

let mod: typeof ExpoNotifications | null = null;
let loadAttempted = false;

export function getModule(): typeof ExpoNotifications | null {
  if (!loadAttempted) {
    loadAttempted = true;
    try {
      mod = require('expo-notifications');
    } catch (err) {
      console.warn('expo-notifications unavailable (likely Expo Go on a recent SDK — a dev build is needed for real device notifications):', err);
      mod = null;
    }
  }
  return mod;
}

let handlerReady = false;
export function ensureNotificationHandler() {
  const notifications = getModule();
  if (!notifications || handlerReady) return;
  try {
    notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    handlerReady = true;
  } catch (err) {
    console.warn('expo-notifications handler setup failed:', err);
  }
}

// One Android channel per sound preset (a channel's sound is fixed for its
// lifetime, so each preset — see lib/sound.ts — needs its own channel) plus
// the original generic "default" channel. presentLocalNotification() then
// routes each notification through the channel matching the user's choice.
export async function ensureAndroidChannel() {
  const notifications = getModule();
  if (!notifications || Platform.OS !== 'android') return;
  try {
    await notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
    });
    // Android 8+ ignores content.sound and always plays whatever the
    // target channel says — so "sound disabled" needs its own channel
    // with an explicit null sound, not just omitting one at schedule time.
    await notifications.setNotificationChannelAsync('silent', {
      name: 'silent',
      importance: notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
      sound: null,
    });
    for (const type of SOUND_TYPES) {
      // Old per-sound channels played on the (often quiet) notification
      // stream; a channel can't be changed once created, so drop them.
      await notifications.deleteNotificationChannelAsync(type).catch(() => {});
      await notifications.setNotificationChannelAsync(channelIdFor(type), {
        name: type.replace(/_/g, ' '),
        importance: notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
        sound: type,
        // Alarm stream = loud, even when the notification volume is low.
        audioAttributes: {
          usage: notifications.AndroidAudioUsage.ALARM,
          contentType: notifications.AndroidAudioContentType.SONIFICATION,
        },
      });
    }
  } catch (err) {
    console.warn('expo-notifications Android channel setup failed:', err);
  }
}

// Android channel id for a sound preset (also sent to the server for FCM).
export function channelIdFor(type: string): string {
  return `${type}_loud`;
}

// Called on every login: asks again if notifications are off, and when the
// OS won't show its prompt anymore, offers to open the app settings.
export async function askPermissionOnLogin(): Promise<boolean> {
  const notifications = getModule();
  if (!notifications) return false;
  try {
    const current = await notifications.getPermissionsAsync();
    if (current.status === 'granted') return true;
    if (current.canAskAgain) {
      const requested = await notifications.requestPermissionsAsync();
      if (requested.status === 'granted') return true;
    }
    Alert.alert(
      'Notifications désactivées',
      "Active les notifications pour être prévenu des nouvelles tâches et messages, même quand l'application est fermée.",
      [
        { text: 'Plus tard', style: 'cancel' },
        { text: 'Ouvrir les réglages', onPress: () => Linking.openSettings().catch(() => {}) },
      ],
    );
    return false;
  } catch (err) {
    console.warn('expo-notifications permission request failed:', err);
    return false;
  }
}

export async function ensurePermission(): Promise<boolean> {
  const notifications = getModule();
  if (!notifications) return false;
  try {
    const current = await notifications.getPermissionsAsync();
    if (current.status === 'granted') return true;
    const requested = await notifications.requestPermissionsAsync();
    return requested.status === 'granted';
  } catch (err) {
    console.warn('expo-notifications permission request failed:', err);
    return false;
  }
}

// `data` rides along so tapping the notification can open the right screen
// (see useNotificationTapNavigation).
export async function presentLocalNotification(title: string, body?: string, data?: Record<string, any>) {
  const notifications = getModule();
  if (!notifications) return;
  const { enabled, type } = getSoundSettingsSync();
  try {
    await notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: enabled ? `${type}.wav` : false,
        ...(Platform.OS === 'android' ? { channelId: enabled ? channelIdFor(type) : 'silent' } : {}),
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('expo-notifications schedule failed:', err);
  }
}
