// Physics config + glitch toggles, with localStorage persistence.

export interface PhysicsConfig {
  gravity: number; // base gravity per frame^2
  jumpPower: number; // initial jump velocity
  runSpeed: number; // max run speed (px/frame)
  accel: number; // ground acceleration
  friction: number; // ground decel when no input
  bounceFactor: number; // stomp bounce multiplier
  enemySpeed: number; // enemy speed multiplier
  timeScale: number; // global time scale
}

export const DEFAULT_PHYSICS: PhysicsConfig = {
  gravity: 0.52,
  jumpPower: 10,
  runSpeed: 3.1,
  accel: 0.14,
  friction: 0.28,
  bounceFactor: 1.0,
  enemySpeed: 1.0,
  timeScale: 1.0,
};

export interface SliderMeta {
  key: keyof PhysicsConfig;
  label: string;
  min: number;
  max: number;
  step: number;
}

export const PHYSICS_SLIDERS: SliderMeta[] = [
  { key: 'gravity', label: 'Gravity', min: 0.05, max: 1.5, step: 0.01 },
  { key: 'jumpPower', label: 'Jump Power', min: 4, max: 20, step: 0.1 },
  { key: 'runSpeed', label: 'Run Speed', min: 1, max: 8, step: 0.1 },
  { key: 'accel', label: 'Acceleration', min: 0.05, max: 1, step: 0.01 },
  { key: 'friction', label: 'Friction', min: 0.01, max: 1, step: 0.01 },
  { key: 'bounceFactor', label: 'Bounce Factor', min: 0.2, max: 3, step: 0.05 },
  { key: 'enemySpeed', label: 'Enemy Speed', min: 0.1, max: 3, step: 0.05 },
  { key: 'timeScale', label: 'Time Scale', min: 0.2, max: 2, step: 0.05 },
];

export interface GlitchFlags {
  moonGravity: boolean;
  infiniteJump: boolean;
  doubleJump: boolean;
  wallJump: boolean;
  superBounce: boolean;
  icePhysics: boolean;
  trampolineGround: boolean;
  ghostWalk: boolean;
  invincible: boolean;
  tinyPlayer: boolean;
  giantPlayer: boolean;
  bigHead: boolean;
  rainbowTrail: boolean;
  slowMo: boolean;
  reversedControls: boolean;
  enemyConfetti: boolean;
  springyShells: boolean;
}

export const DEFAULT_GLITCHES: GlitchFlags = {
  moonGravity: false,
  infiniteJump: false,
  doubleJump: false,
  wallJump: false,
  superBounce: false,
  icePhysics: false,
  trampolineGround: false,
  ghostWalk: false,
  invincible: false,
  tinyPlayer: false,
  giantPlayer: false,
  bigHead: false,
  rainbowTrail: false,
  slowMo: false,
  reversedControls: false,
  enemyConfetti: false,
  springyShells: false,
};

export const GLITCH_META: { key: keyof GlitchFlags; label: string; desc: string }[] = [
  { key: 'moonGravity', label: 'Moon Gravity', desc: 'Floaty low-gravity jumps' },
  { key: 'infiniteJump', label: 'Infinite Jump', desc: 'Jump again any time, even mid-air' },
  { key: 'doubleJump', label: 'Double Jump', desc: 'One extra jump in mid-air' },
  { key: 'wallJump', label: 'Wall Jump', desc: 'Leap off walls you are sliding against' },
  { key: 'superBounce', label: 'Super Bounce', desc: 'Stomps launch you sky-high' },
  { key: 'icePhysics', label: 'Ice Physics', desc: 'Almost no friction — slippery!' },
  { key: 'trampolineGround', label: 'Trampoline Ground', desc: 'Every floor bounces you back up' },
  { key: 'ghostWalk', label: 'Ghost Walk', desc: 'Clip through solid tiles (pits still kill)' },
  { key: 'invincible', label: 'Invincible', desc: 'Nothing can hurt you' },
  { key: 'tinyPlayer', label: 'Tiny Player', desc: 'Shrink to pocket size' },
  { key: 'giantPlayer', label: 'Giant Player', desc: 'Become a towering explorer' },
  { key: 'bigHead', label: 'Big Head Mode', desc: 'Purely cosmetic. Glorious.' },
  { key: 'rainbowTrail', label: 'Rainbow Trail', desc: 'Leave a sparkling particle trail' },
  { key: 'slowMo', label: 'Slow-Mo', desc: 'World runs at 40% speed' },
  { key: 'reversedControls', label: 'Reversed Controls', desc: 'Left is right, right is left' },
  { key: 'enemyConfetti', label: 'Enemy Confetti', desc: 'Stomped enemies burst into particles' },
  { key: 'springyShells', label: 'Springy Shells', desc: 'Kicked shells never stop moving' },
];

const PHYS_KEY = 'rq_physics_v1';
const GLITCH_KEY = 'rq_glitches_v1';

export function loadPhysics(): PhysicsConfig {
  try {
    const raw = localStorage.getItem(PHYS_KEY);
    if (raw) return { ...DEFAULT_PHYSICS, ...(JSON.parse(raw) as Partial<PhysicsConfig>) };
  } catch { /* ignore */ }
  return { ...DEFAULT_PHYSICS };
}

export function savePhysics(p: PhysicsConfig): void {
  try { localStorage.setItem(PHYS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function loadGlitches(): GlitchFlags {
  try {
    const raw = localStorage.getItem(GLITCH_KEY);
    if (raw) return { ...DEFAULT_GLITCHES, ...(JSON.parse(raw) as Partial<GlitchFlags>) };
  } catch { /* ignore */ }
  return { ...DEFAULT_GLITCHES };
}

export function saveGlitches(g: GlitchFlags): void {
  try { localStorage.setItem(GLITCH_KEY, JSON.stringify(g)); } catch { /* ignore */ }
}

export function anyGlitchActive(g: GlitchFlags): boolean {
  return Object.values(g).some(Boolean);
}
