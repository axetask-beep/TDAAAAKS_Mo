// AAC "ADTS" audio is a plain run of frames, each with its own header, so a
// file still being recorded can be cut after any complete frame and each piece
// is valid audio on its own. Used to send a meeting to the AI piece by piece.

// Length of the complete frames at the start of `b` (0 if none / not ADTS).
export function completeFramesLength(b: Uint8Array): number {
  let i = 0;
  while (i + 7 <= b.length && b[i] === 0xff && (b[i + 1] & 0xf0) === 0xf0) {
    const len = ((b[i + 3] & 0x03) << 11) | (b[i + 4] << 3) | (b[i + 5] >> 5);
    if (len < 7 || i + len > b.length) break;
    i += len;
  }
  return i;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function toBase64(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[n >> 18] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '=');
  }
  return out;
}
