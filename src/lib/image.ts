// Mobile equivalent of AXETASKS/src/lib/image.ts. There is no binary upload
// endpoint or object storage in this app — small data URLs stored directly
// in a text column (users.avatar_url, workspaces.photo_url) is the
// pragmatic choice given that constraint, same as the web app's canvas
// resize. Here the native file picker + expo-image-manipulator take the
// place of an <input type="file"> and a <canvas>.
import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

// Opens the native image picker, resizes/compresses the selection and
// returns a JPEG data URL. Returns null if the user cancels the picker.
export async function pickAndResizeImageAsDataUrl(maxDim = 400, quality = 0.82): Promise<string | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['image/*'] });
  if (picked.canceled || !picked.result) return null;
  const uri = picked.result.uri;

  const { width, height } = await getImageSize(uri);
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const actions = scale < 1
    ? [{ resize: { width: Math.round(width * scale), height: Math.round(height * scale) } }]
    : [];

  const manipulated = await manipulateAsync(uri, actions, { base64: true, compress: quality, format: SaveFormat.JPEG });
  if (!manipulated.base64) throw new Error("Impossible de traiter l'image.");
  return `data:image/jpeg;base64,${manipulated.base64}`;
}
