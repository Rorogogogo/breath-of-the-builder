/**
 * audio.ts — tiny WebAudio synth chimes; no audio assets needed.
 */

let ctx: AudioContext | null = null;

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, gainPeak: number, type: OscillatorType = 'sine'): void {
  const a = ac();
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** Zelda-ish "secret found" arpeggio on first discovery of a shrine. */
export function playDiscover(): void {
  const notes = [523.25, 587.33, 659.25, 783.99, 1046.5]; // C5 D5 E5 G5 C6
  notes.forEach((n, i) => tone(n, i * 0.09, 0.5, 0.12, 'triangle'));
}

/**
 * Original triumphant fanfare for 100% completion — a rising C–E–G–A–G
 * figure layered in diatonic thirds over a warm root chord. Deliberately
 * NOT the Zelda "item get" (different contour, rhythm, and harmony).
 */
export function playFanfare(): void {
  const m2f = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
  const seq: Array<[number, number, number]> = [
    // [melody midi, third-below midi, start time]
    [72, 69, 0], // C5 + A4
    [76, 72, 0.24], // E5 + C5
    [79, 76, 0.48], // G5 + E5
    [81, 77, 0.78], // A5 + F5
    [79, 76, 1.18], // G5 + E5 (held)
  ];
  for (const [mel, third, at] of seq) {
    const last = at === 1.18;
    tone(m2f(mel), at, last ? 1.8 : 0.55, 0.09, 'triangle');
    tone(m2f(third), at, last ? 1.8 : 0.55, 0.05, 'triangle');
  }
  // warm C-major bed underneath
  for (const m of [48, 55, 60, 64]) tone(m2f(m), 0, 3.2, 0.035, 'sine');
}

/** soft low horn swell for entering a new region — a single original tone */
export function playHorn(): void {
  const a = ac();
  const t0 = a.currentTime;
  for (const [f, peak] of [[98, 0.045], [196, 0.06], [294.66, 0.018]] as const) {
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = 'triangle';
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.1);
    osc.connect(g).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + 2.3);
  }
}

/** tiny upward glitter when the fairy companion starts guiding */
export function playSparkle(): void {
  const notes = [1318.5, 1760, 2349.3]; // E6 A6 D7
  notes.forEach((n, i) => tone(n, i * 0.06, 0.28, 0.04, 'sine'));
}

/** soft click when opening/closing panels */
export function playClick(): void {
  tone(880, 0, 0.08, 0.05, 'sine');
}

/** bright two-note blip when a skill orb is gathered */
export function playCollect(): void {
  tone(987.77, 0, 0.18, 0.055, 'triangle'); // B5
  tone(1318.51, 0.07, 0.32, 0.055, 'triangle'); // E6
}

/* shared noise buffer for footsteps / splashes */
let noiseBuf: AudioBuffer | null = null;
function noiseBuffer(): AudioBuffer {
  const a = ac();
  if (!noiseBuf) {
    const len = Math.floor(a.sampleRate * 0.3);
    noiseBuf = a.createBuffer(1, len, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

let stepFlip = false;
/** soft filtered-noise footstep; pitch alternates left/right */
export function playFootstep(vol: number): void {
  const a = ac();
  const src = a.createBufferSource();
  src.buffer = noiseBuffer();
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  stepFlip = !stepFlip;
  f.frequency.value = stepFlip ? 640 : 470;
  f.Q.value = 1.2;
  const g = a.createGain();
  const t0 = a.currentTime;
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t0, Math.random() * 0.15, 0.09);
}

/** low whoosh of water when the hero starts swimming */
export function playSplash(): void {
  const a = ac();
  const src = a.createBufferSource();
  src.buffer = noiseBuffer();
  src.loop = true;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  const t0 = a.currentTime;
  f.frequency.setValueAtTime(1100, t0);
  f.frequency.exponentialRampToValueAtTime(240, t0 + 0.5);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.11, t0 + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t0);
  src.stop(t0 + 0.6);
}

/** gentle start swell */
export function playStart(): void {
  tone(261.63, 0, 1.4, 0.07, 'sine');
  tone(392.0, 0.15, 1.4, 0.07, 'sine');
  tone(523.25, 0.3, 1.6, 0.08, 'triangle');
}

/* ================= Hyrule-flavoured soundtrack =================
 * No audio files, and no Nintendo melodies (those are copyrighted) —
 * an original, endlessly-generated piece in the style of an adventure
 * game overworld:
 *  - harp arpeggios rippling through a gently descending progression
 *  - an ocarina-like lead (sine + vibrato, slight portamento) improvising
 *    original pentatonic phrases
 *  - warm string pad + soft "sea breeze" underneath
 */

const midi = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

// descending bass line C → B → A → F: adventurous, wistful, ours
const CHORDS: number[][] = [
  [48, 52, 55, 62], // Cadd9
  [47, 50, 55, 62], // G6/B
  [45, 48, 52, 60], // Am(add b3 octave)
  [41, 45, 48, 57], // Fmaj add9
];
// C major pentatonic across two octaves for the ocarina
const SCALE = [60, 62, 64, 67, 69, 72, 74, 76, 79];

const CHORD_LEN = 6.4; // seconds per chord
const ARP_STEP = 0.4; // harp eighth-notes

let musicMaster: GainNode | null = null;
let delaySend: GainNode | null = null;
let noiseSrc: AudioBufferSourceNode | null = null;
let chordTimer = 0;
let leadTimer = 0;
let chordIdx = 0;
let musicPlaying = false;

/** warm string-ish pad under everything */
function padChord(notes: number[], when: number): void {
  const a = ac();
  for (const m of notes) {
    for (const det of [-5, 4]) {
      const osc = a.createOscillator();
      const g = a.createGain();
      osc.type = det < 0 ? 'sine' : 'triangle';
      osc.frequency.value = midi(m);
      osc.detune.value = det;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(0.02, when + 2.4);
      g.gain.setValueAtTime(0.02, when + CHORD_LEN - 1.8);
      g.gain.exponentialRampToValueAtTime(0.0001, when + CHORD_LEN + 1.2);
      osc.connect(g).connect(musicMaster!);
      osc.start(when);
      osc.stop(when + CHORD_LEN + 1.5);
    }
  }
}

/** fairy-fountain-style texture: harp plucks climbing through the chord */
function harpArpeggio(chord: number[], when: number): void {
  const a = ac();
  const steps = Math.round(CHORD_LEN / ARP_STEP);
  for (let i = 0; i < steps; i++) {
    const octave = 12 + 12 * (Math.floor(i / chord.length) % 2);
    const note = chord[i % chord.length] + octave;
    const t0 = when + i * ARP_STEP;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = 'triangle';
    osc.frequency.value = midi(note);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.03, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.85);
    osc.connect(g);
    g.connect(musicMaster!);
    g.connect(delaySend!);
    osc.start(t0);
    osc.stop(t0 + 1);
  }
}

/** ocarina lead: one legato oscillator with vibrato, original phrases */
function ocarinaPhrase(): void {
  if (!musicPlaying) return;
  const a = ac();
  const t0 = a.currentTime + 0.1;

  const osc = a.createOscillator();
  osc.type = 'sine';
  const g = a.createGain();
  // gentle 5.2 Hz vibrato that eases in, like a held breath
  const vib = a.createOscillator();
  vib.frequency.value = 5.2;
  const vibG = a.createGain();
  vibG.gain.setValueAtTime(0, t0);
  vibG.gain.linearRampToValueAtTime(9, t0 + 0.8);
  vib.connect(vibG).connect(osc.detune);

  // build an original phrase: mostly stepwise walk, long final note
  const durs = [0.4, 0.4, 0.8, 0.4, 1.2];
  let idx = 2 + Math.floor(Math.random() * 4);
  const count = 4 + Math.floor(Math.random() * 3);
  let t = t0;
  osc.frequency.setValueAtTime(midi(SCALE[idx]), t);
  for (let n = 0; n < count; n++) {
    const dur = n === count - 1 ? 1.8 : durs[Math.floor(Math.random() * durs.length)];
    // slight portamento between notes = breathy flute feel
    osc.frequency.exponentialRampToValueAtTime(midi(SCALE[idx]), t + 0.04);
    t += dur;
    idx = Math.min(SCALE.length - 1, Math.max(0, idx + (Math.floor(Math.random() * 5) - 2)));
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.18);
  g.gain.setValueAtTime(0.05, t - 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);

  osc.connect(g);
  g.connect(musicMaster!);
  g.connect(delaySend!);
  osc.start(t0);
  vib.start(t0);
  osc.stop(t + 1);
  vib.stop(t + 1);

  // breathe, then play the next phrase
  leadTimer = window.setTimeout(ocarinaPhrase, (t - t0) * 1000 + 2500 + Math.random() * 3500);
}

export function startMusic(): void {
  if (musicPlaying) return;
  musicPlaying = true;
  const a = ac();

  musicMaster = a.createGain();
  musicMaster.gain.setValueAtTime(0.0001, a.currentTime);
  musicMaster.gain.exponentialRampToValueAtTime(1, a.currentTime + 4);
  const warm = a.createBiquadFilter();
  warm.type = 'lowpass';
  warm.frequency.value = 2400;
  musicMaster.connect(warm).connect(a.destination);

  // feedback delay: cathedral-ish echo for harp + ocarina
  const delay = a.createDelay(1.5);
  delay.delayTime.value = ARP_STEP * 1.5;
  const fb = a.createGain();
  fb.gain.value = 0.34;
  delaySend = a.createGain();
  delaySend.gain.value = 0.4;
  delaySend.connect(delay);
  delay.connect(fb).connect(delay);
  delay.connect(musicMaster);

  // sea-breeze noise bed with a slow swell
  const len = a.sampleRate * 2;
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noiseSrc = a.createBufferSource();
  noiseSrc.buffer = buf;
  noiseSrc.loop = true;
  const nf = a.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 380;
  const ng = a.createGain();
  ng.gain.value = 0.014;
  const lfo = a.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoG = a.createGain();
  lfoG.gain.value = 0.007;
  lfo.connect(lfoG).connect(ng.gain);
  noiseSrc.connect(nf).connect(ng).connect(musicMaster);
  noiseSrc.start();
  lfo.start();

  // chord progression loop: pad + harp together
  const playNext = (): void => {
    if (!musicPlaying) return;
    const chord = CHORDS[chordIdx % CHORDS.length];
    const when = ac().currentTime + 0.1;
    padChord(chord, when);
    harpArpeggio(chord, when);
    chordIdx++;
    chordTimer = window.setTimeout(playNext, CHORD_LEN * 1000);
  };
  playNext();
  leadTimer = window.setTimeout(ocarinaPhrase, 4000);
}

export function stopMusic(): void {
  if (!musicPlaying) return;
  musicPlaying = false;
  clearTimeout(chordTimer);
  clearTimeout(leadTimer);
  const a = ac();
  musicMaster?.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.8);
  const m = musicMaster;
  const n = noiseSrc;
  setTimeout(() => {
    n?.stop();
    m?.disconnect();
  }, 1000);
  musicMaster = null;
  noiseSrc = null;
}

/** returns the new state: true = playing */
export function toggleMusic(): boolean {
  if (musicPlaying) stopMusic();
  else startMusic();
  return musicPlaying;
}
