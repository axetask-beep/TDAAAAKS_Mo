# AxeTask Mobile

React Native (Expo, TypeScript) client for the AxeTask API — the same backend
that powers the AXETASKS web app (`../AXETASKS`). This app was **not** built
by copying the web UI responsively; it's a separate mobile-native UX (bottom
tabs, native pickers, push-navigation task detail, swipe-friendly lists)
talking to the exact same REST API and auth scheme.

## How this maps to the web app

The web app (`AXETASKS/src`) was analyzed, not modified. What's reused:

| Web app source | Mobile equivalent | Notes |
|---|---|---|
| `src/types.ts` | `src/types/index.ts` | Copied field-for-field — same API, same shapes. Keep both in sync by hand if the backend changes. |
| `src/lib/api.ts` | `src/lib/api.ts` | Same endpoints/methods/payloads. Only the token storage differs (`expo-secure-store` instead of `localStorage`). |
| `src/context/AuthContext.tsx` | `src/context/AuthContext.tsx` | Same JWT flow: `POST /api/auth/login|signup` → store token → `GET /api/auth/me` on boot to validate it. |
| `src/context/WorkspaceContext.tsx` | `src/context/WorkspaceContext.tsx` | Same "current workspace/project" + live timer model, `AsyncStorage` instead of `localStorage`. |
| Sidebar/Navbar navigation | `src/navigation/*` (bottom tabs + native stack) | Kanban drag-and-drop became status **filter chips** + tap-to-change-status — not viable as a gesture on a phone screen. |
| `TaskDetailDrawer.tsx` (side drawer) | `TaskDetailScreen.tsx` (pushed screen) | Same fields (status, priority, assignee, due date, subtasks, comments, time entries) as a full screen instead of a drawer. |
| French status/priority labels (`a_faire`/`en_cours`/…) | `src/theme/index.ts` (`STATUS_CONFIG`, `PRIORITY_CONFIG`) | Copied verbatim from `ProjectView.tsx` / `TaskDetailDrawer.tsx` so labels stay identical across platforms. |
| Brand palette (`#090D16`, `#2563EB`, …) | `src/theme/index.ts` (`colors`) | Same hex values as `index.html` / `Sidebar.tsx`. |
| `NotificationsBell.tsx` (navbar dropdown) | `src/context/NotificationsContext.tsx` + `NotificationsScreen.tsx` | Same polling model and same "announce an id only once, ever" dedup (`localStorage` there, `AsyncStorage` here) — see the Notifications section below for what differs. |
| Web's browser `Notification` API + Web Audio tone | `expo-notifications` local notification | Not a literal port — a phone has no Web Audio/Notification API, so this uses Expo's local-notification API instead, which shows a real OS notification (system tray) and plays the platform's own default notification sound, rather than a synthesized tone. |

Backend architecture (for reference, unchanged): Express app (`AXETASKS/src/server/app.ts`)
behind a hand-rolled HMAC-SHA256 JWT (`Authorization: Bearer <token>`, 30-day
expiry, no refresh flow), Postgres via `pg`/Drizzle, deployed to Vercel as a
single serverless function with CORS scoped to `/api/*`. Nothing here needed
changing for mobile — a React Native `fetch` doesn't send an `Origin` header,
so the CORS layer is a non-issue for this client.

## What's implemented

- **Auth**: login, signup, session restore, logout.
- **Dashboard**: cross-workspace "my tasks" (`/api/tasks/dashboard`) with
  quick filters (overdue, due today, in progress, blocked).
- **Workspaces → Projects → Tasks**: browse, create workspace/project/task.
- **Task detail**: edit title/description/status/priority/assignee/due date,
  subtasks checklist, comments, time entries, delete.
- **Time tracking**: start/pause/stop a live timer from a task (persisted
  across app restarts via `AsyncStorage`), log time manually, "my time" list
  with weekly/total totals.
- **Messaging**: conversation list, start a new DM, thread view (polls every
  4s while open — the backend has no websocket/push channel). Unread count
  badge on the Messages tab, polled every 15s app-wide (not just while the
  screen is open), with a device notification + sound on a genuinely new
  message.
- **Notifications** (`/api/notifications`): task assigned, task status
  changed, new comment, due today/overdue, added to or removed from a
  workspace, workspace role changed. Badge on the Profile tab (mirrors the
  web navbar bell), a full list screen (mark one/all read, delete one/clear
  all, tap through to the task or workspace) reachable from Profile, and —
  the part that's genuinely mobile-only — a real device notification (system
  tray, default OS sound) the moment a poll (every 20s) finds something new.
  Permission is requested right after login. **Native push** (Android):
  the app registers its FCM device token (`src/lib/pushToken.ts` →
  `POST /api/push/mobile/register`) and the server pushes every
  notification and every new message through Firebase Cloud Messaging, so
  alerts arrive even when the app is closed. Tapping one opens the right
  screen. Requires `google-services.json` at the project root (picked up by
  `app.config.js`) and `FIREBASE_SERVICE_ACCOUNT` on the server; without
  them the app falls back to polling (20s foreground, ~15 min background
  task).
- **Profile**: update name, logout; **admin-only** team management (list,
  invite, change role, remove).

## What's intentionally not implemented (backend doesn't support it, or is
out of scope for a first mobile pass)

- File **uploads** for attachments — `POST /api/tasks/:id/attachments` only
  accepts an already-hosted `file_url`; there's no upload endpoint on the
  backend for either client to call.
- Workspace member management UI (add/remove members, workspace tags) and
  workspace settings (rename/delete) — present in the API client but not
  wired to a screen yet.
- Kanban drag-and-drop reordering (`POST /api/tasks/reorder` exists in the
  API client, unused) — replaced by status filter chips, a better fit for
  touch.

## Setup

```bash
npm install
npx expo start
```

Defaults to the production API (`https://axe-task.vercel.app`). To point at
a local backend instead, copy `.env.example` to `.env` and set
`EXPO_PUBLIC_API_URL` to your machine's **LAN IP** (not `localhost` —
a physical device or emulator can't resolve your computer's loopback
address), e.g. `http://192.168.1.42:3000`.

```bash
npm run typecheck   # tsc --noEmit
```
# TDAAAKS_M
# TDAAAAKS_Mo
