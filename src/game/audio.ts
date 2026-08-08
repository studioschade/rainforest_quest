// Procedural Web Audio engine — chiptune music + SFX, no external files.
// Headless-safe: every public method no-ops when AudioContext is unavailable
// (Node smoke tests) or not yet unlocked by a user gesture.

export type MusicTrack = 'title' | 'overworld' | 'underworld' | 'canopy' | 'lagoon' | 'boss';
export type SfxName =
  | 'jump' | 'swim' | 'stomp' | 'kick' | 'coin' | 'powerup' | 'grow' | 'shrink'
  | 'hurt' | 'death' | '1up' | 'checkpoint' | 'goal' | 'bossRoar' | 'fanfare'
  | 'key' | 'locked' | 'warp' | 'static' | 'ember' | 'pound';

const MUTE_KEY = 'rq_audio_muted';
const VOL_KEY = 'rq_audio_volume';

/** midi note -> frequency Hz */
function freq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

interface TrackDef {
  bpm: number; // quarter-note tempo; sequencer steps are 8th notes
  lead: (number | null)[]; // midi notes, one per 8th step (loop)
  bass: (number | null)[];
  hatEvery?: number; // noise tick every N steps (0 = off)
}

// Step-sequencer loops — square lead, triangle bass, noise hats. Short & quiet.
const TRACKS: Record<MusicTrack, TrackDef> = {
  title: {
    bpm: 96,
    lead: [72, 76, 79, 83, 84, 79, 76, 79, 72, null, 76, null, 79, 76, 74, null],
    bass: [48, null, null, null, 43, null, null, null, 48, null, null, null, 43, null, 47, null],
    hatEvery: 4,
  },
  overworld: {
    bpm: 132,
    lead: [72, 76, 79, 81, 79, 76, 74, 72, 76, 79, 81, 84, 81, 79, 76, 74],
    bass: [48, null, 43, null, 48, null, 43, null, 48, null, 45, null, 41, null, 43, null],
    hatEvery: 2,
  },
  underworld: {
    bpm: 84,
    lead: [57, null, 60, null, 64, null, 60, 59, 57, null, 53, null, 55, null, 59, null],
    bass: [45, null, null, 45, null, null, 41, null, 45, null, null, 45, 43, null, 47, null],
    hatEvery: 4,
  },
  canopy: {
    bpm: 112,
    lead: [76, 80, 83, 88, 83, 80, 76, 73, 76, 80, 83, 80, 78, 80, 76, null],
    bass: [52, null, 49, null, 45, null, 49, null, 52, null, 49, null, 47, null, 49, null],
    hatEvery: 2,
  },
  lagoon: {
    // waltz-ish 12-step (3/4 feel) arpeggio in F
    bpm: 138,
    lead: [65, 69, 72, 77, 72, 69, 65, 69, 72, 77, 81, 84],
    bass: [41, null, null, 46, null, null, 48, null, null, 46, null, null],
    hatEvery: 3,
  },
  boss: {
    bpm: 152, // driving D minor
    lead: [74, 74, 77, 74, 72, 74, 69, 67, 74, 74, 77, 79, 81, 77, 74, 72],
    bass: [38, 38, null, 38, 38, null, 34, null, 38, 38, null, 38, 36, null, 38, null],
    hatEvery: 2,
  },
};

type AC = typeof AudioContext;

export class AudioEngine {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private track: MusicTrack | null = null;
  private step = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  muted = false;
  volume = 1;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
      const v = parseFloat(localStorage.getItem(VOL_KEY) ?? '1');
      this.volume = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
    } catch { /* headless / blocked */ }
  }

  /** Lazily create the AudioContext. Returns null when unavailable (headless). */
  private ensure(): AudioContext | null {
    if (this.ac) return this.ac;
    try {
      const Ctor: AC | undefined =
        typeof AudioContext !== 'undefined'
          ? AudioContext
          : (globalThis as { webkitAudioContext?: AC }).webkitAudioContext;
      if (!Ctor) return null;
      this.ac = new Ctor();
      this.master = this.ac.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ac.destination);
      // shared white-noise buffer for hats / percussion
      const len = this.ac.sampleRate;
      this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch { this.ac = null; this.master = null; }
    return this.ac;
  }

  /** Call from any user gesture (keydown / click) so browsers unlock audio. */
  resume(): void {
    const ac = this.ensure();
    if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ignore */ }
    if (this.master && this.ac) this.master.gain.setValueAtTime(m ? 0 : this.volume, this.ac.currentTime);
  }

  /** Set game volume 0..1 (persisted; independent of the system volume). */
  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    try { localStorage.setItem(VOL_KEY, String(this.volume)); } catch { /* ignore */ }
    if (this.master && this.ac && !this.muted) this.master.gain.setValueAtTime(this.volume, this.ac.currentTime);
  }

  /** Cycle 100% → 75% → 50% → 25% → 0% → 100%. Returns the new volume. */
  cycleVolume(): number {
    const steps = [1, 0.75, 0.5, 0.25, 0];
    const idx = steps.findIndex((s) => Math.abs(s - this.volume) < 0.01);
    this.setVolume(steps[(idx + 1) % steps.length]);
    return this.volume;
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // ---------------- SFX ----------------

  /** One oscillator blip with a frequency sweep + simple envelope. */
  private blip(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
    const ac = this.ensure();
    if (!ac || !this.master || this.muted) return;
    try {
      const t0 = ac.currentTime + delay;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(30, f0), t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(this.master);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch { /* ignore */ }
  }

  /** Short filtered noise burst. */
  private noise(dur: number, vol: number, delay = 0, playbackRate = 1): void {
    const ac = this.ensure();
    if (!ac || !this.master || !this.noiseBuf || this.muted) return;
    try {
      const t0 = ac.currentTime + delay;
      const src = ac.createBufferSource();
      src.buffer = this.noiseBuf;
      src.playbackRate.value = playbackRate;
      const g = ac.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(g); g.connect(this.master);
      src.start(t0, Math.random() * 0.5, dur + 0.05);
    } catch { /* ignore */ }
  }

  /** Fire a named sound effect. Every recipe is < 0.4s. */
  sfx(name: SfxName): void {
    if (!this.ensure() || this.muted) return;
    switch (name) {
      case 'jump': this.blip('square', 300, 620, 0.12, 0.05); break;
      case 'swim': this.blip('sine', 380, 720, 0.09, 0.05); break;
      case 'stomp': this.blip('square', 520, 140, 0.1, 0.07); this.noise(0.06, 0.03); break;
      case 'kick': this.blip('square', 380, 940, 0.08, 0.06); break;
      case 'coin': this.blip('square', 988, 988, 0.06, 0.05); this.blip('square', 1319, 1319, 0.14, 0.05, 0.06); break;
      case 'powerup': this.blip('square', 523, 523, 0.06, 0.05); this.blip('square', 659, 659, 0.06, 0.05, 0.06); this.blip('square', 784, 784, 0.12, 0.05, 0.12); break;
      case 'grow': this.blip('triangle', 220, 820, 0.22, 0.06); break;
      case 'shrink': this.blip('triangle', 820, 220, 0.22, 0.06); break;
      case 'hurt': this.blip('sawtooth', 300, 90, 0.2, 0.07); break;
      case 'death':
        this.blip('square', 392, 392, 0.1, 0.06); this.blip('square', 330, 330, 0.1, 0.06, 0.1);
        this.blip('square', 262, 262, 0.1, 0.06, 0.2); this.blip('square', 196, 180, 0.18, 0.06, 0.3);
        break;
      case '1up':
        for (let i = 0; i < 4; i++) this.blip('square', [660, 830, 990, 1320][i], [660, 830, 990, 1320][i], 0.07, 0.05, i * 0.07);
        break;
      case 'checkpoint': this.blip('square', 784, 784, 0.08, 0.05); this.blip('square', 1047, 1047, 0.16, 0.05, 0.08); break;
      case 'goal':
        for (let i = 0; i < 4; i++) this.blip('square', [523, 659, 784, 1047][i], [523, 659, 784, 1047][i], 0.09, 0.055, i * 0.09);
        break;
      case 'bossRoar': this.blip('sawtooth', 150, 55, 0.35, 0.09); this.noise(0.25, 0.04, 0, 0.4); break;
      case 'fanfare':
        for (let i = 0; i < 4; i++) this.blip('square', [523, 659, 784, 1047][i], [523, 659, 784, 1047][i], 0.08, 0.06, i * 0.08);
        this.blip('triangle', 262, 262, 0.32, 0.05);
        break;
      case 'key': this.blip('square', 1175, 1175, 0.06, 0.05); this.blip('square', 1568, 1568, 0.14, 0.05, 0.06); break;
      case 'locked': this.blip('square', 130, 75, 0.14, 0.07); this.noise(0.08, 0.04, 0, 0.5); break;
      case 'warp': this.blip('sine', 900, 180, 0.3, 0.06); break;
      case 'static': this.noise(0.18, 0.06, 0, 1.6); this.blip('square', 1800, 300, 0.15, 0.03); break;
      case 'ember': this.blip('square', 820, 400, 0.07, 0.05); break;
      case 'pound': this.blip('sine', 120, 50, 0.14, 0.09); this.noise(0.1, 0.05, 0, 0.4); break;
      default: break;
    }
  }

  // ---------------- music ----------------

  /** Switch the looping track. null stops the music. No-op if unchanged. */
  setMusic(track: MusicTrack | null): void {
    if (track === this.track) return;
    this.track = track;
    this.step = 0;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (!track || !this.ensure()) return;
    const def = TRACKS[track];
    const stepMs = (60 / def.bpm / 2) * 1000;
    this.timer = setInterval(() => this.playStep(), stepMs);
  }

  private playStep(): void {
    const ac = this.ac;
    const def = this.track ? TRACKS[this.track] : null;
    if (!ac || !this.master || !def || this.muted) { this.step++; return; }
    try {
      const len = Math.max(def.lead.length, def.bass.length);
      const i = this.step % len;
      const stepDur = 60 / def.bpm / 2;
      const lead = def.lead[i % def.lead.length];
      if (lead !== null) this.note('square', lead, stepDur * 0.9, 0.028);
      const bass = def.bass[i % def.bass.length];
      if (bass !== null) this.note('triangle', bass, stepDur * 0.95, 0.05);
      if (def.hatEvery && this.step % def.hatEvery === 1) this.noise(0.03, 0.012, 0, 2.2);
      this.step++;
    } catch { this.step++; }
  }

  private note(type: OscillatorType, midi: number, dur: number, vol: number): void {
    const ac = this.ac;
    if (!ac || !this.master) return;
    const t0 = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq(midi);
    g.gain.setValueAtTime(vol, t0);
    g.gain.setValueAtTime(vol, t0 + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
}

/** Shared singleton (safe to construct headless). */
export const audio = new AudioEngine();
