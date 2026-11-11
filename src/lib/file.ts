// Mobile equivalent of AXETASKS/src/lib/file.ts. There is no binary upload
// endpoint or object storage in this app — a data URL stored directly in a
// text column is the pragmatic choice given that constraint. Uses
// expo-file-system's built-in File.pickFileAsync() so no extra native
// dependency (like expo-document-picker) is needed just to pick a file.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Uploads go through Vercel (4.5 Mo per request, base64 adds a third): 3 Mo per file.
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

// Same as AXETASKS/src/lib/file.ts (keep in sync).
const EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'application/vnd.oasis.opendocument.presentation': 'odp',
  'application/zip': 'zip',
  'text/plain': 'txt', 'text/csv': 'csv',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/heic': 'heic',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/webm': 'webm', 'video/mp4': 'mp4',
};

// A name any OS can save: Android pickers can return "document:1001085109"
// (no extension, ':' is forbidden on Windows), so the file couldn't be opened.
export function safeFileName(name: string, mime?: string | null) {
  let n = (name || 'fichier').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').trim() || 'fichier';
  const ext = mime && EXT[mime.split(';')[0]];
  if (ext && !/\.[a-z0-9]{2,5}$/i.test(n)) n += `.${ext}`;
  return n;
}


export interface PickedFile {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}

// Opens the native file picker and reads the selection as a data URL.
// Returns null if the user cancels the picker.
export async function pickFileAsDataUrl(maxBytes = MAX_UPLOAD_BYTES): Promise<PickedFile | null> {
  const picked = await File.pickFileAsync();
  if (picked.canceled || !picked.result) return null;

  const file = picked.result;
  if (file.size > maxBytes) {
    throw new Error(`Fichier trop volumineux (max ${Math.round(maxBytes / (1024 * 1024))} Mo).`);
  }

  const base64 = await file.base64();
  const mime = file.type || 'application/octet-stream';
  return {
    name: safeFileName(file.name, mime),
    size: file.size,
    type: mime,
    dataUrl: `data:${mime};base64,${base64}`,
  };
}

// A phone has no download folder, and Linking can't open a data: URL: save the
// file to the cache, then open the share sheet (open in Word, save to Files...).
export async function openDataUrl(dataUrl: string, fileName: string) {
  const [header, base64] = dataUrl.split(',', 2);
  const mimeType = header.slice(5).split(';')[0] || undefined;
  const name = safeFileName(fileName, mimeType);
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}
