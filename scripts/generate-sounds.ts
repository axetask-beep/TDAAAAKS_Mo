// Bakes the 6 web notification presets (AXETASKS/src/lib/sound.ts, which
// synthesizes them live via the Web Audio API) into static 16-bit PCM WAV
// files, since a native background notification can only play a real audio
// file, not run a synthesizer. Each preset here reproduces the same
// oscillator frequencies, stagger timings and gain envelopes as the web
// version as closely as plain sample-by-sample math allows.
// Run with: npx tsx scripts/generate-sounds.ts
import { writeFileSync } from 'fs';
import { join } from 'path';

const SAMPLE_RATE = 44100;

type EnvPoint = { t: number; v: number; ramp?: 'linear' | 'exp' };
interface Osc {
  start: number;
  freq: number | { from: number; to: number; rampEnd: number }; // exponential freq ramp when object
  type: 'sine' | 'triangle';
  gain: EnvPoint[]; // envelope breakpoints, first point is the "setValueAtTime" anchor
  stop: number;
}

function triangleWave(phase: number): number {
  // phase in [0,1)
  return 4 * Math.abs(phase - Math.floor(phase + 0.5)) - 1;
}

function envelopeAt(points: EnvPoint[], t: number): number {
  if (t <= points[0].t) return points[0].v;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (t <= b.t) {
      const frac = (t - a.t) / (b.t - a.t || 1e-9);
      if (b.ramp === 'exp') {
        const av = Math.max(a.v, 1e-6);
        const bv = Math.max(b.v, 1e-6);
        return av * Math.pow(bv / av, frac);
      }
      return a.v + (b.v - a.v) * frac;
    }
  }
  return points[points.length - 1].v;
}

function freqAt(osc: Osc, tRel: number): number {
  if (typeof osc.freq === 'number') return osc.freq;
  const { from, to, rampEnd } = osc.freq;
  if (tRel >= rampEnd) return to;
  const frac = tRel / rampEnd;
  return from * Math.pow(to / from, frac);
}

function renderOscillators(oscs: Osc[], totalDuration: number): Float64Array {
  const numSamples = Math.ceil(totalDuration * SAMPLE_RATE);
  const buffer = new Float64Array(numSamples);

  for (const osc of oscs) {
    let phase = 0;
    const startSample = Math.floor(osc.start * SAMPLE_RATE);
    const stopSample = Math.min(numSamples, Math.floor(osc.stop * SAMPLE_RATE));
    for (let i = startSample; i < stopSample; i++) {
      const t = i / SAMPLE_RATE;
      const tRel = t - osc.start;
      const f = freqAt(osc, tRel);
      phase += f / SAMPLE_RATE;
      const raw = osc.type === 'sine' ? Math.sin(2 * Math.PI * phase) : triangleWave(phase);
      const g = envelopeAt(osc.gain, t);
      buffer[i] += raw * g;
    }
  }
  return buffer;
}

function toWav(samples: Float64Array): Buffer {
  // Normalize to full scale (max volume, no clipping), then encode 16-bit PCM mono.
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const scale = peak > 0 ? 0.98 / peak : 1;

  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i] * scale));
    buffer.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buffer;
}

// ---- Presets, mirroring AXETASKS/src/lib/sound.ts ----

function crystalBell(): Float64Array {
  const freqs = [1046.5, 1318.5, 2093];
  const oscs: Osc[] = freqs.map((freq, idx) => {
    const start = idx * 0.04;
    return {
      start,
      freq,
      type: 'sine',
      gain: [
        { t: start, v: 0.001 },
        { t: start + 0.02, v: 0.3 / (idx + 1), ramp: 'exp' },
        { t: start + 0.5, v: 0.0001, ramp: 'exp' },
      ],
      stop: start + 0.55,
    };
  });
  return renderOscillators(oscs, 0.08 + 0.55);
}

function marimbaPop(): Float64Array {
  const base = 523.25;
  const oscs: Osc[] = [
    {
      start: 0,
      freq: { from: base, to: base * 1.5, rampEnd: 0.08 },
      type: 'triangle',
      gain: [
        { t: 0, v: 0.001 },
        { t: 0.015, v: 0.4 },
        { t: 0.28, v: 0.0001, ramp: 'exp' },
      ],
      stop: 0.3,
    },
    {
      start: 0,
      freq: base * 2,
      type: 'sine',
      gain: [
        { t: 0, v: 0.001 },
        { t: 0.015, v: 0.4 },
        { t: 0.28, v: 0.0001, ramp: 'exp' },
      ],
      stop: 0.3,
    },
  ];
  return renderOscillators(oscs, 0.3);
}

function digitalPing(): Float64Array {
  const freqs = [1396.91, 1760.0];
  const oscs: Osc[] = freqs.map((freq, i) => {
    const start = i * 0.06;
    return {
      start,
      freq,
      type: 'sine',
      gain: [
        { t: start, v: 0.001 },
        { t: start + 0.01, v: 0.28 },
        { t: start + 0.35, v: 0.0001, ramp: 'exp' },
      ],
      stop: start + 0.4,
    };
  });
  return renderOscillators(oscs, 0.06 + 0.4);
}

function harmonicSuccess(): Float64Array {
  const notes = [659.25, 830.61, 987.77];
  const oscs: Osc[] = notes.map((freq, idx) => {
    const start = idx * 0.05;
    return {
      start,
      freq,
      type: 'sine',
      gain: [
        { t: start, v: 0.001 },
        { t: start + 0.02, v: 0.35 },
        { t: start + 0.6, v: 0.0001, ramp: 'exp' },
      ],
      stop: start + 0.65,
    };
  });
  return renderOscillators(oscs, 0.1 + 0.65);
}

function harpChime(): Float64Array {
  const notes = [587.33, 880, 1174.66];
  const oscs: Osc[] = notes.map((freq, idx) => {
    const start = idx * 0.045;
    return {
      start,
      freq,
      type: 'sine',
      gain: [
        { t: start, v: 0.001 },
        { t: start + 0.01, v: 0.25 },
        { t: start + 0.45, v: 0.0001, ramp: 'exp' },
      ],
      stop: start + 0.5,
    };
  });
  return renderOscillators(oscs, 0.09 + 0.5);
}

function subtleTap(): Float64Array {
  const oscs: Osc[] = [
    {
      start: 0,
      freq: { from: 800, to: 300, rampEnd: 0.04 },
      type: 'sine',
      gain: [
        { t: 0, v: 0.2 },
        { t: 0.05, v: 0.0001, ramp: 'exp' },
      ],
      stop: 0.06,
    },
  ];
  return renderOscillators(oscs, 0.06);
}

// Overtime alarm (web: playAlarmSound): 15 beeps of 0.12 s every 0.2 s = 3 s, high/low.
function alarm(): Float64Array {
  const oscs: Osc[] = Array.from({ length: 15 }, (_, i) => {
    const t = i * 0.2;
    return {
      start: t, freq: i % 2 ? 1320 : 990, type: 'triangle' as const,
      gain: [{ t, v: 0.0001 }, { t: t + 0.01, v: 0.5 }, { t: t + 0.11, v: 0.5 }, { t: t + 0.12, v: 0.0001 }],
      stop: t + 0.13,
    };
  });
  return renderOscillators(oscs, 3);
}

const PRESETS: Record<string, () => Float64Array> = {
  alarm,
  crystal_bell: crystalBell,
  marimba_pop: marimbaPop,
  digital_ping: digitalPing,
  harmonic_success: harmonicSuccess,
  harp_chime: harpChime,
  subtle_tap: subtleTap,
};

const outDir = join(__dirname, '..', 'assets', 'sounds');
for (const [name, render] of Object.entries(PRESETS)) {
  const samples = render();
  const wav = toWav(samples);
  const path = join(outDir, `${name}.wav`);
  writeFileSync(path, wav);
  console.log(`wrote ${path} (${(wav.length / 1024).toFixed(1)} KB)`);
}
