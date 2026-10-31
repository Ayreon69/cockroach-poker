// Petits sons synthétisés (Web Audio) : papier, tampon, boîte à musique et clavecin, aucun fichier à charger.
import { useStore } from '../store';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!useStore.getState().prefs.sound) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; delay?: number; slide?: number; attack?: number } = {}): void {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + (opts.delay ?? 0);
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opts.slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.12, t0 + (opts.attack ?? 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur: number, opts: { gain?: number; delay?: number; freq?: number; type?: BiquadFilterType; sweep?: number; q?: number } = {}): void {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + (opts.delay ?? 0);
  const buffer = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 1.5;
  const src = a.createBufferSource();
  src.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = opts.type ?? 'bandpass';
  filter.frequency.setValueAtTime(opts.freq ?? 2400, t0);
  if (opts.sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(60, (opts.freq ?? 2400) * opts.sweep), t0 + dur);
  if (opts.q) filter.Q.value = opts.q;
  const g = a.createGain();
  g.gain.value = opts.gain ?? 0.25;
  src.connect(filter).connect(g).connect(a.destination);
  src.start(t0);
}

/** Une corde de clavecin : attaque sèche, harmoniques brillantes qui s'éteignent vite. */
function pluck(freq: number, gain = 0.09, delay = 0): void {
  tone(freq, 0.5, { type: 'sawtooth', gain: gain * 0.35, delay });
  tone(freq, 0.6, { type: 'triangle', gain, delay });
  tone(freq * 2, 0.3, { type: 'sine', gain: gain * 0.4, delay });
  noise(0.01, { gain: gain * 0.8, freq: 5000, delay });
}

/** Une lame de boîte à musique. */
function chime(freq: number, delay = 0, gain = 0.08): void {
  tone(freq, 0.9, { type: 'sine', gain, delay });
  tone(freq * 4, 0.25, { type: 'sine', gain: gain * 0.25, delay });
}

export const sfx = {
  /** Une carte qui glisse sur le feutre. */
  slide: () => noise(0.32, { gain: 0.22, freq: 900, sweep: 3.2, q: 0.8 }),
  /** On soulève un coin de la carte pour la regarder. */
  peek: () => {
    noise(0.08, { gain: 0.18, freq: 3200, q: 1.2 });
    noise(0.12, { gain: 0.14, freq: 1600, delay: 0.1, sweep: 0.5 });
  },
  pick: () => tone(1320, 0.07, { gain: 0.05, slide: 1.3 }),
  turn: () => [1047, 1319, 1568].forEach((f, i) => chime(f, i * 0.11)),
  /** Le coup de tampon sur la planche. */
  stamp: () => {
    noise(0.16, { gain: 0.9, freq: 160, type: 'lowpass' });
    tone(80, 0.18, { gain: 0.3, slide: 0.6 });
    noise(0.04, { gain: 0.3, freq: 2600, delay: 0.01 });
  },
  flip: () => noise(0.14, { gain: 0.2, freq: 2400, sweep: 0.4, q: 0.9 }),
  good: () => [523, 659, 784, 1047].forEach((f, i) => pluck(f, 0.08, i * 0.07)),
  bad: () => {
    // Un basson qui se dégonfle.
    tone(196, 0.32, { type: 'sawtooth', gain: 0.07, slide: 0.94, attack: 0.03 });
    tone(185, 0.32, { type: 'sawtooth', gain: 0.07, slide: 0.94, delay: 0.3, attack: 0.03 });
    tone(175, 0.7, { type: 'sawtooth', gain: 0.08, slide: 0.82, delay: 0.6, attack: 0.03 });
  },
  /** Des petites pattes sur le parquet. */
  scuttle: () => {
    for (let t = 0; t < 0.5; t += 0.035 + Math.random() * 0.03) noise(0.012, { gain: 0.08 + Math.random() * 0.06, freq: 3500 + Math.random() * 2500, delay: t });
  },
  lose: () => {
    [392, 370, 349, 330].forEach((f, i) => tone(f, i === 3 ? 1.1 : 0.42, { type: 'sawtooth', gain: 0.07, delay: i * 0.38, slide: i === 3 ? 0.9 : 1, attack: 0.04 }));
  },
  win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => pluck(f, 0.08, i * 0.11)),
};
