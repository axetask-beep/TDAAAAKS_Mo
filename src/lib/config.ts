// API base URL, resolved once at bundle time via Expo's EXPO_PUBLIC_ env
// convention (see .env.example). Defaults to the deployed production API so
// the app works out of the box; override with EXPO_PUBLIC_API_URL to point
// at a local dev server (use your machine's LAN IP, not localhost — a
// physical device or emulator can't resolve your computer's localhost).
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://axe-task.vercel.app').replace(/\/$/, '');
