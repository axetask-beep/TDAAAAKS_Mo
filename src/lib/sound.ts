// Mobile equivalent of AXETASKS/src/lib/sound.ts. The web app synthesizes
// its 6 notification presets live via the Web Audio API; there's no such
// API in React Native, so scripts/generate-sounds.ts baked the same presets
// into static WAV files under assets/sounds/, registered with the
// expo-notifications config plugin (see app.json) so they're available both
// as real OS notification sounds (via localNotifications.ts) and for
// in-app preview here (via expo-audio).
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SoundEffectType =
  | 'crystal_bell'
  | 'marimba_pop'
  | 'digital_ping'
  | 'harmonic_success'
  | 'harp_chime'
  | 'subtle_tap';

export const SOUND_TYPES: SoundEffectType[] = [
  'crystal_bell', 'marimba_pop', 'digital_ping', 'harmonic_success', 'harp_chime', 'subtle_tap',
];

export const SOUND_ASSETS: Record<SoundEffectType, number> = {
  crystal_bell: require('../../assets/sounds/crystal_bell.wav'),
  marimba_pop: require('../../assets/sounds/marimba_pop.wav'),
  digital_ping: require('../../assets/sounds/digital_ping.wav'),
  harmonic_success: require('../../assets/sounds/harmonic_success.wav'),
  harp_chime: require('../../assets/sounds/harp_chime.wav'),
  subtle_tap: require('../../assets/sounds/subtle_tap.wav'),
};

// Same signature default as the web app.
export const UNIFIED_NOTIFICATION_SOUND: SoundEffectType = 'harmonic_success';

export interface SoundConfig {
  enabled: boolean;
  type: SoundEffectType;
}

const STORAGE_KEY_ENABLED = 'axetask_sound_enabled';
const STORAGE_KEY_TYPE = 'axetask_sound_type';

let cached: SoundConfig = { enabled: true, type: UNIFIED_NOTIFICATION_SOUND };
let loaded = false;
const listeners = new Set<(cfg: SoundConfig) => void>();

async function load(): Promise<SoundConfig> {
  if (loaded) return cached;
  try {
    const [enabledStr, typeStr] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY_ENABLED),
      AsyncStorage.getItem(STORAGE_KEY_TYPE),
    ]);
    cached = {
      enabled: enabledStr !== null ? enabledStr === 'true' : true,
      type: typeStr && SOUND_TYPES.includes(typeStr as SoundEffectType) ? (typeStr as SoundEffectType) : UNIFIED_NOTIFICATION_SOUND,
    };
  } catch {
    // keep defaults
  }
  loaded = true;
  return cached;
}

// Synchronous read of the last-loaded settings (safe to call from render —
// call ensureSoundSettingsLoaded() once at app startup first).
export function getSoundSettingsSync(): SoundConfig {
  return cached;
}

export async function getSoundSettings(): Promise<SoundConfig> {
  return load();
}

export async function setSoundSettings(settings: Partial<SoundConfig>): Promise<void> {
  await load();
  cached = { ...cached, ...settings };
  listeners.forEach(l => l(cached));
  const writes: Promise<void>[] = [];
  if (settings.enabled !== undefined) writes.push(AsyncStorage.setItem(STORAGE_KEY_ENABLED, String(settings.enabled)));
  if (settings.type !== undefined) writes.push(AsyncStorage.setItem(STORAGE_KEY_TYPE, settings.type));
  await Promise.all(writes);
}

export function onSoundSettingsChange(listener: (cfg: SoundConfig) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Called once at app startup (see App.tsx) so getSoundSettingsSync() is
// populated before anything tries to read it.
export async function ensureSoundSettingsLoaded(): Promise<void> {
  await load();
}

export function pickRandomSoundType(): SoundEffectType {
  return SOUND_TYPES[Math.floor(Math.random() * SOUND_TYPES.length)];
}

// Plays a preset in-app (for the "preview" button in settings) using
// expo-audio — separate from the real OS notification sound path in
// localNotifications.ts, so previewing never requires notification
// permission.
export async function previewSound(type: SoundEffectType): Promise<void> {
  try {
    const { createAudioPlayer } = require('expo-audio');
    const player = createAudioPlayer(SOUND_ASSETS[type]);
    player.addListener('playbackStatusUpdate', (status: any) => {
      if (status.didJustFinish) player.remove();
    });
    player.play();
  } catch (err) {
    console.warn('[sound] preview failed:', err);
  }
}

export const SOUND_LABELS: Record<SoundEffectType, string> = {
  crystal_bell: 'Cloche cristal',
  marimba_pop: 'Marimba',
  digital_ping: 'Ping',
  harmonic_success: 'Accord',
  harp_chime: 'Harpe',
  subtle_tap: 'Tap discret',
};
