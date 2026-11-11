// npx tsx scripts/test-adts.ts
import assert from 'assert';
import { completeFramesLength, toBase64 } from '../src/lib/adts';

const frame = (len: number) => {
  const f = new Uint8Array(len);
  f.set([0xff, 0xf1, 0x50, 0x80 | ((len >> 11) & 3), (len >> 3) & 0xff, ((len & 7) << 5) | 0x1f, 0xfc]);
  return f;
};
const a = frame(100), b = frame(57);
const buf = new Uint8Array([...a, ...b, ...frame(80).slice(0, 30)]); // last frame still being written
assert.equal(completeFramesLength(buf), 157);
assert.equal(completeFramesLength(buf.slice(0, 50)), 0);
assert.equal(completeFramesLength(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])), 0);
for (const s of ['', 'a', 'ab', 'abc', 'hello world!']) {
  assert.equal(toBase64(new TextEncoder().encode(s)), Buffer.from(s).toString('base64'));
}
console.log('adts ok');
