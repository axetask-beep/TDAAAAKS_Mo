// Real push (works with the app closed / phone locked): registers this
// device's FCM token with the backend, which then sends every notification
// through Firebase Cloud Messaging. Needs a build that includes
// google-services.json (see app.config.js) and FIREBASE_SERVICE_ACCOUNT on
// the server; until both exist, register() just fails quietly and the app
// keeps relying on polling + the background task.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { api } from './api';
import { getModule, ensurePermission, channelIdFor } from './localNotifications';
import { getSoundSettingsSync, onSoundSettingsChange } from './sound';

const PUSH_ACTIVE_KEY = 'axetask_push_active';
const PUSH_TOKEN_KEY = 'axetask_push_token';

// When true the server pushes every notification, so the polling paths
// must not also present a local one (it would show twice).
export async function isPushActive(): Promise<boolean> {
  return (await AsyncStorage.getItem(PUSH_ACTIVE_KEY).catch(() => null)) === '1';
}

function currentChannel(): string {
  const { enabled, type } = getSoundSettingsSync();
  return enabled ? channelIdFor(type) : 'silent';
}

export async function registerPushToken(): Promise<void> {
  const notifications = getModule();
  // iOS: a free signing team has no APNs entitlement — polling only.
  if (!notifications || Platform.OS !== 'android') return;
  try {
    if (!(await ensurePermission())) return;
    const { data: token } = await notifications.getDevicePushTokenAsync();
    const res = await api.registerPushToken(token, currentChannel());
    await AsyncStorage.multiSet([[PUSH_TOKEN_KEY, token], [PUSH_ACTIVE_KEY, res.enabled ? '1' : '0']]);
  } catch (err) {
    await AsyncStorage.setItem(PUSH_ACTIVE_KEY, '0').catch(() => {});
    console.warn('Native push unavailable, falling back to polling:', err);
  }
}

export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (token) await api.unregisterPushToken(token);
  } catch {
    // logged out anyway; the server drops dead tokens on its own
  }
  await AsyncStorage.multiRemove([PUSH_TOKEN_KEY, PUSH_ACTIVE_KEY]).catch(() => {});
}

// The Android channel carries the user's chosen sound, so re-register when it changes.
onSoundSettingsChange(() => {
  AsyncStorage.getItem(PUSH_TOKEN_KEY).then(token => {
    if (token) api.registerPushToken(token, currentChannel()).catch(() => {});
  }).catch(() => {});
});
