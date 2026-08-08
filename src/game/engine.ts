// Rainforest Quest engine — fixed-timestep platformer core rendering to canvas.
import { TILE, SOLID_TILES, ONEWAY_TILES, tileAt, TIMED_EFFECTS, KEY_INFO } from './types';
import type { LevelData, EntitySpawn, FormType, TimedKey, KeyColor } from './types';
import type { TexAtlas } from './textures';
import { PHYSICS_SLIDERS } from './config';
import type { PhysicsConfig, GlitchFlags } from './config';

export const TS = 16; // tile size in game px
export const VIEW_W = 512; // view width in game px (canvas is 2x)
export const VIEW_H = 288;

const GRAV_FALL_MULT = 1.55;
const COYOTE_FRAMES = 6;
const BUFFER_FRAMES = 6;

export interface SessionState {
  score: number;
  coins: number;
  lives: number;
  levelName: string;
  keys?: KeyColor[]; // session-level key inventory (normalized by startLevel)
}

export interface InputState {
  left: boolean; right: boolean; up: boolean; down: boolean;
  jump: boolean; jumpPressed: boolean; run: boolean; firePressed: boolean;
}

interface Body {
  x: number; y: number; w: number; h: number; vx: number; vy: number;
  onGround: boolean;
}

interface Ent extends Body {
  kind: string;
  dir: 1 | -1;
  frame: number;
  state: string;
  t: number;
  dead: boolean;
  remove: boolean;
  hp: number;
  baseY: number;
  homeTx: number;
  variant: string;
  target: string; // warpJar destination (level name or "world:<name>")
  extreme: boolean; // EXTREME variant: bigger, faster, tougher
  stun: number; // frames of post-crack stun (extreme first stomp)
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number; grav: number;
}

interface Player extends Body {
  big: boolean;
  facing: 1 | -1;
  coyote: number;
  buffer: number;
  airJumps: number;
  invuln: number;
  dead: boolean;
  deadTimer: number;
  anim: number;
  wallSlide: number; // -1 left wall, 1 right wall, 0 none
  form: FormType;
  timers: Record<TimedKey, number>;
  pound: boolean; // kapok anvil ground pound in progress
  cling: number; // tree frog wall cling direction (-1/1/0)
  swimming: boolean; // inside SwimWater
  swimCd: number; // frames until next stroke allowed
}

/** Active Static Starfruit chaos effect (surge OR scramble, never stacked). */
interface GlitchFx {
  kind: 'surge' | 'scramble';
  t: number; // frames remaining
  elapsed: number;
  glitchKey?: keyof GlitchFlags;
  prevValue?: boolean;
  prevPhysics?: PhysicsConfig;
}

/** Deterministic question-block content. hash of position -> spread of contents. */
export function questionContent(tx: number, ty: number, small: boolean): string {
  const h = (((tx * 73856093) ^ (ty * 19349663)) >>> 0) % 100;
  // [threshold, content] cumulative table
  const table: [number, string][] = small
    ? [ // small players: heavy bias toward Spirit Bloom
      [30, 'coin'], [70, 'bloom'], [75, 'emberChili'], [80, 'frogSuit'], [85, 'macawWings'],
      [87, 'kapokAnvil'], [89, 'jaguarPelt'], [91, 'rainbowOrchid'], [93, 'grasshopperLegs'],
      [95, 'shrinkberry'], [97, 'coinCapuchin'], [98, 'goldenBanana'], [99, 'thunderMango'],
      [100, 'staticStarfruit'],
    ]
    : [ // big players: full spread
      [53, 'coin'], [68, 'bloom'], [73, 'emberChili'], [78, 'frogSuit'], [83, 'macawWings'],
      [85, 'kapokAnvil'], [87, 'jaguarPelt'], [89, 'rainbowOrchid'], [91, 'grasshopperLegs'],
      [93, 'shrinkberry'], [95, 'coinCapuchin'], [97, 'goldenBanana'], [99, 'thunderMango'],
      [100, 'staticStarfruit'],
    ];
  for (const [lim, kind] of table) if (h < lim) return kind;
  return 'coin';
}

/** Powerup kinds that walk after emerging from a block. */
const WALKER_ITEMS = new Set(['bloom', 'emberChili', 'frogSuit', 'kapokAnvil', 'jaguarPelt', 'grasshopperLegs', 'shrinkberry', 'coinCapuchin']);
/** Powerup kinds that gently drift/float. */
const FLOATER_ITEMS = new Set(['macawWings', 'rainbowOrchid']);
/** All pickupable powerup entity kinds (excludes coin/checkpoint/goal/gong). */
const POWERUP_KINDS = new Set([...WALKER_ITEMS, ...FLOATER_ITEMS, 'goldenBanana', 'thunderMango', 'staticStarfruit']);
/** Kinds that count as enemies for instant effects (excludes boss, shells excluded from banana). */
const INSTANT_KILLABLE = new Set(['beetle', 'tortoise', 'armadillo', 'durian', 'durianDrop', 'monkey', 'eagle', 'flytrap', 'piranha', 'shell', 'swimfish', 'jaguarWarrior', 'serpent', 'sentinel']);
/** Colored key pickups. */
const KEY_KINDS = new Set(['keyJade', 'keyGold', 'keyObsidian']);
/** Stompable enemy kinds — EXTREME variants of these get +1 stomp HP. */
const STOMPABLE_KINDS = new Set(['beetle', 'tortoise', 'armadillo', 'monkey', 'eagle', 'swimfish', 'jaguarWarrior', 'serpent', 'sentinel']);
/** Editor entity brushes that accept the EXTREME checkbox (uses spawn types). */
const ENEMY_BRUSHES = new Set(['beetle', 'tortoiseGreen', 'tortoiseRed', 'flytrap', 'monkey', 'eagle', 'durian', 'armadillo', 'piranha', 'swimfish', 'jaguarWarrior', 'serpent', 'sentinel', 'boss']);

export type EditorSel =
  | { kind: 'tile'; tile: number }
  | { kind: 'entity'; entity: string }
  | { kind: 'erase' };

export class Engine {
  private ctx: CanvasRenderingContext2D;
  private tex: TexAtlas;
  physics!: PhysicsConfig;
  glitches!: GlitchFlags;

  level: LevelData | null = null;
  editorMode = false;
  paused = false;

  private player: Player | null = null;
  private ents: Ent[] = [];
  private particles: Particle[] = [];
  private bumpAnims: { tx: number; ty: number; t: number }[] = [];
  private crumble: Map<string, number> = new Map();
  private camX = 0;
  private camY = 0;
  private maxCamX = 0;
  private tick = 0;
  private session: SessionState | null = null;
  private phase: 'play' | 'dying' | 'complete' | 'bossfall' | 'warp' = 'play';
  private phaseTimer = 0;
  private checkpoint: { x: number; y: number } | null = null;
  private rainbowHue = 0;
  private bossDefeated = false;
  shakeT = 0; // camera shake frames remaining
  flashT = 0; // screen flash frames remaining
  glitchFx: GlitchFx | null = null; // active Static Starfruit effect
  private sliceTick = 0;
  private sliceShift: number[] = [0, 0, 0, 0, 0];
  private warpAnim: { t: number; jar: Ent } | null = null;
  private texts: { x: number; y: number; t: number; text: string; color: string }[] = [];
  editorWarpTarget = ''; // destination chosen in the editor for the next placed jar
  editorGoalLock: '' | KeyColor = ''; // seal color chosen in the editor for the next placed goal
  editorExtreme = false; // EXTREME flag for the next placed enemy

  // callbacks wired by the controller
  onStats: () => void = () => {};
  onLevelComplete: () => void = () => {};
  onGameOver: () => void = () => {};
  onDied: (livesLeft: number) => void = () => {};
  onWarpRequest: (target: string, jarX: number, jarY: number) => void = () => {};
  onSfx: (name: string) => void = () => {};

  editorSel: EditorSel = { kind: 'tile', tile: TILE.Ground };
  editorHover: { x: number; y: number } | null = null;
  editorDirty = false;

  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, tex: TexAtlas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.tex = tex;
    this.ctx.imageSmoothingEnabled = false;
  }

  // ================= level lifecycle =================

  startLevel(level: LevelData, session: SessionState, useCheckpoint = false): void {
    this.restoreGlitchFx(); // starfruit chaos never carries across levels/deaths
    this.warpAnim = null;
    this.texts = [];
    this.level = level;
    this.session = session;
    this.session.levelName = level.name;
    this.session.keys ??= [];
    this.ents = [];
    this.particles = [];
    this.bumpAnims = [];
    this.crumble = new Map();
    this.phase = 'play';
    this.phaseTimer = 0;
    this.bossDefeated = false;
    if (!useCheckpoint) this.checkpoint = null;

    let spawn: EntitySpawn = { type: 'playerStart', x: 2, y: 2 };
    for (const e of level.entities) if (e.type === 'playerStart') spawn = e;
    if (useCheckpoint && this.checkpoint) spawn = { type: 'playerStart', x: this.checkpoint.x, y: this.checkpoint.y };

    this.player = {
      x: spawn.x * TS + 2, y: spawn.y * TS, w: 12, h: 14, vx: 0, vy: 0,
      big: false, facing: 1, onGround: false, coyote: 0, buffer: 0, airJumps: 0,
      invuln: 0, dead: false, deadTimer: 0, anim: 0, wallSlide: 0,
      form: 'none', timers: { wings: 0, jaguar: 0, orchid: 0, legs: 0, shrink: 0, capuchin: 0 },
      pound: false, cling: 0, swimming: false, swimCd: 0,
    };

    for (const e of level.entities) {
      if (e.type === 'playerStart') continue;
      this.spawnEntity(e);
    }

    this.camX = Math.max(0, Math.min(this.player.x - VIEW_W * 0.35, level.width * TS - VIEW_W));
    this.camY = Math.max(0, Math.min(this.player.y - VIEW_H * 0.55, level.height * TS - VIEW_H));
    this.maxCamX = this.camX;
    this.onStats();
  }

  /** Instantly move the player (used when returning from a warp round-trip). */
  teleportPlayer(x: number, y: number): void {
    if (!this.player || !this.level) return;
    this.player.x = x;
    this.player.y = y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.camX = Math.max(0, Math.min(x - VIEW_W * 0.35, this.level.width * TS - VIEW_W));
    this.camY = Math.max(0, Math.min(y - VIEW_H * 0.55, this.level.height * TS - VIEW_H));
    this.maxCamX = Math.max(this.maxCamX, this.camX);
  }

  private spawnEntity(e: EntitySpawn): void {
    const mk = (kind: string, x: number, y: number, w: number, h: number, extra?: Partial<Ent>): void => {
      this.ents.push(Object.assign({
        kind, x, y, w, h, vx: 0, vy: 0, onGround: false,
        dir: -1 as 1 | -1, frame: 0, state: 'init', t: 0, dead: false, remove: false,
        hp: 1, baseY: y, homeTx: Math.floor(x / TS), variant: '', target: '',
        extreme: false, stun: 0,
      }, extra));
    };

    const ex = e.x * TS, ey = e.y * TS;
    const before = this.ents.length;
    switch (e.type) {
      case 'beetle': mk('beetle', ex + 2, ey + 3, 12, 13); break;
      case 'tortoiseGreen': mk('tortoise', ex + 1, ey - 8, 14, 22, { variant: 'green' }); break;
      case 'tortoiseRed': mk('tortoise', ex + 1, ey - 8, 14, 22, { variant: 'red' }); break;
      case 'armadillo': mk('armadillo', ex + 1, ey + 3, 14, 13); break;
      case 'durian': mk('durian', ex + 1, ey + 2, 14, 14); break;
      case 'flytrap': mk('flytrap', ex + 2, ey + 4, 12, 20, { state: 'hidden' }); break;
      case 'monkey': mk('monkey', ex + 1, ey - 8, 14, 22, { dir: -1 }); break;
      case 'eagle': mk('eagle', ex - 4, ey, 24, 14, { state: 'fly' }); break;
      case 'piranha': mk('piranha', ex + 1, ey, 14, 14, { state: 'wait', t: 60 + Math.floor(Math.random() * 90) }); break;
      case 'bloom': mk('bloom', ex + 2, ey + 2, 12, 14, { state: 'still' }); break;
      // 11 new powerups — placed items sit gently bobbing in place
      case 'emberChili': case 'frogSuit': case 'kapokAnvil':
      case 'macawWings': case 'jaguarPelt': case 'rainbowOrchid':
      case 'grasshopperLegs': case 'shrinkberry': case 'coinCapuchin':
      case 'goldenBanana': case 'thunderMango':
      case 'staticStarfruit':
        mk(e.type, ex + 2, ey + 2, 12, 14, { state: 'still' });
        break;
      // colored keys — session inventory pickups
      case 'keyJade': case 'keyGold': case 'keyObsidian':
        mk(e.type, ex + 2, ey + 2, 12, 14, { state: 'still' });
        break;
      // Aztec enemies
      case 'jaguarWarrior': mk('jaguarWarrior', ex + 1, ey - 8, 14, 22, { state: 'walk', vx: -0.5 }); break;
      case 'serpent': mk('serpent', ex - 2, ey, 20, 12, { state: 'fly', vx: 0.8, dir: 1 }); break;
      case 'sentinel': mk('sentinel', ex - 4, ey + TS - 24, 24, 24, { state: 'idle', t: 60 }); break;
      case 'swimfish': mk('swimfish', ex + 1, ey + 4, 14, 10, { state: 'swim', vx: -0.5 }); break;
      case 'warpJar': mk('warpJar', ex - 2, ey + TS - 26, 20, 26, { state: 'idle', target: e.target ?? '' }); break;
      case 'coin': mk('coin', ex + 2, ey + 2, 12, 12); break;
      case 'checkpoint': mk('checkpoint', ex + 1, ey - 16, 14, 30, { state: 'off' }); break;
      case 'goal': mk('goal', ex - 8, ey - 32, 32, 46, { variant: e.lockColor ?? '' }); break;
      case 'gong': mk('gong', ex - 4, ey - 8, 24, 24); break;
      case 'axe': mk('axe', ex, ey - 6, 16, 22); break;
      case 'boss': mk('boss', ex - 16, ey - 34, 56, 60, { state: 'pause', t: 90, hp: 3, dir: -1 }); break;
      default: break;
    }

    // EXTREME variant: ~1.6x size (collision box too), +1 stomp HP where sensible
    if (e.extreme) {
      for (let i = before; i < this.ents.length; i++) {
        const en = this.ents[i];
        en.extreme = true;
        const nw = en.w * 1.6, nh = en.h * 1.6;
        en.x -= (nw - en.w) / 2;
        en.y -= nh - en.h; // keep feet planted
        en.w = nw; en.h = nh;
        if (en.kind === 'boss') en.hp = 5;
        else if (STOMPABLE_KINDS.has(en.kind)) en.hp = 2;
      }
    }
  }

  // ================= tile helpers =================

  private tileAtPx(x: number, y: number): number {
    if (!this.level) return 0;
    return tileAt(this.level, Math.floor(x / TS), Math.floor(y / TS));
  }

  // Move a body on X with tile collision. Returns hit wall (-1/1/0).
  private moveX(b: Body, dx: number, ghost: boolean, oneWay = false): number {
    void oneWay;
    if (!this.level) return 0;
    let hit = 0;
    let remaining = dx;
    while (Math.abs(remaining) > 0.001) {
      const step = Math.max(-8, Math.min(8, remaining));
      remaining -= step;
      b.x += step;
      if (ghost) continue;
      const dir = Math.sign(step);
      if (dir === 0) continue;
      const edge = dir > 0 ? b.x + b.w : b.x;
      const tx = Math.floor(edge / TS);
      const y0 = Math.floor((b.y + 1) / TS), y1 = Math.floor((b.y + b.h - 1) / TS);
      for (let ty = y0; ty <= y1; ty++) {
        if (SOLID_TILES.has(tileAt(this.level, tx, ty))) {
          b.x = dir > 0 ? tx * TS - b.w - 0.01 : (tx + 1) * TS + 0.01;
          hit = dir;
          break;
        }
      }
      if (hit !== 0) break;
    }
    return hit;
  }

  // Move on Y. Returns 1 = landed, -1 = bumped head, 0 = nothing.
  private moveY(b: Body, dy: number, ghost: boolean, useOneWay: boolean, prevBottom?: number): number {
    if (!this.level) return 0;
    let result = 0;
    let remaining = dy;
    while (Math.abs(remaining) > 0.001) {
      const step = Math.max(-8, Math.min(8, remaining));
      remaining -= step;
      const before = b.y;
      b.y += step;
      if (ghost) continue;
      const dir = Math.sign(step);
      if (dir === 0) continue;
      const x0 = Math.floor((b.x + 1) / TS), x1 = Math.floor((b.x + b.w - 1) / TS);
      if (dir > 0) {
        const ty = Math.floor((b.y + b.h) / TS);
        const pb = prevBottom !== undefined ? prevBottom : before + b.h;
        for (let tx = x0; tx <= x1; tx++) {
          const t = tileAt(this.level, tx, ty);
          const oneWayHit = useOneWay && ONEWAY_TILES.has(t) && pb <= ty * TS + 0.5;
          if (SOLID_TILES.has(t) || oneWayHit) {
            b.y = ty * TS - b.h - 0.01;
            result = 1;
            break;
          }
        }
      } else {
        const ty = Math.floor(b.y / TS);
        for (let tx = x0; tx <= x1; tx++) {
          if (SOLID_TILES.has(tileAt(this.level, tx, ty))) {
            b.y = (ty + 1) * TS + 0.01;
            result = -1;
            this.bumpTile(tx, ty);
            break;
          }
        }
      }
      if (result !== 0) break;
    }
    return result;
  }

  // ================= block interaction =================

  private bumpTile(tx: number, ty: number): void {
    if (!this.level || !this.player) return;
    const t = tileAt(this.level, tx, ty);
    if (t === TILE.Question) {
      this.level.tiles[ty][tx] = TILE.QuestionUsed;
      this.bumpAnims.push({ tx, ty, t: 0 });
      const content = questionContent(tx, ty, !this.player.big);
      if (content === 'coin') {
        this.addCoin(tx * TS + 8, ty * TS - 10);
      } else {
        this.spawnItemFromBlock(content, tx, ty);
      }
      this.editorDirty = true;
    } else if (t === TILE.Brick) {
      if (this.player.big || this.glitches.giantPlayer) {
        this.level.tiles[ty][tx] = TILE.Empty;
        for (let i = 0; i < 10; i++) {
          this.particles.push({
            x: tx * TS + 8, y: ty * TS + 8,
            vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 5 - 1,
            life: 40, maxLife: 40, color: i % 2 ? '#8a9a8b' : '#5f7060', size: 3, grav: 0.3,
          });
        }
        this.addScore(50);
        this.editorDirty = true;
      } else {
        this.bumpAnims.push({ tx, ty, t: 0 });
      }
    } else if (SOLID_TILES.has(t)) {
      this.bumpAnims.push({ tx, ty, t: 0 });
    }
    // bump-from-below kills enemies standing on that tile
    for (const e of this.ents) {
      if (e.dead || e.remove) continue;
      if (!['beetle', 'tortoise', 'armadillo', 'durian', 'monkey'].includes(e.kind)) continue;
      const feetTy = Math.floor((e.y + e.h + 2) / TS);
      const eTx = Math.floor((e.x + e.w / 2) / TS);
      if (feetTy === ty && eTx === tx) {
        if (e.kind === 'armadillo') { e.vy = -4; } // immune: just hops
        else this.killEnemyFlip(e);
      }
    }
  }

  /** Spawn a powerup item rising out of a question block. */
  private spawnItemFromBlock(kind: string, tx: number, ty: number): void {
    this.ents.push({
      kind, x: tx * TS + 2, y: ty * TS - 14, w: 12, h: 14, vx: 0, vy: -1.5,
      onGround: false, dir: 1, frame: 0, state: 'emerge', t: 0, dead: false, remove: false,
      hp: 1, baseY: ty * TS - 14, homeTx: tx, variant: '', target: '', extreme: false, stun: 0,
    });
  }

  /** Apply a picked-up powerup to the player. */
  private applyPowerup(kind: string): void {
    const p = this.player;
    if (!p) return;
    switch (kind) {
      case 'bloom':
        if (!p.big) { p.big = true; this.sfx('grow'); } else this.sfx('powerup');
        this.addScore(1000);
        break;
      case 'emberChili': p.form = 'ember'; p.big = true; this.addScore(1000); this.sfx('powerup'); break;
      case 'frogSuit': p.form = 'frog'; p.big = true; this.addScore(1000); this.sfx('powerup'); break;
      case 'kapokAnvil': p.form = 'anvil'; p.big = true; this.addScore(1000); this.sfx('powerup'); break;
      case 'macawWings': p.timers.wings = TIMED_EFFECTS.wings.duration; this.addScore(800); this.sfx('powerup'); break;
      case 'jaguarPelt': p.timers.jaguar = TIMED_EFFECTS.jaguar.duration; this.addScore(800); this.sfx('powerup'); break;
      case 'rainbowOrchid': p.timers.orchid = TIMED_EFFECTS.orchid.duration; this.addScore(800); this.sfx('powerup'); break;
      case 'grasshopperLegs': p.timers.legs = TIMED_EFFECTS.legs.duration; this.addScore(800); this.sfx('powerup'); break;
      case 'shrinkberry': p.timers.shrink = TIMED_EFFECTS.shrink.duration; this.addScore(800); this.sfx('shrink'); break;
      case 'coinCapuchin': p.timers.capuchin = TIMED_EFFECTS.capuchin.duration; this.addScore(800); this.sfx('powerup'); break;
      case 'goldenBanana': this.addScore(500); this.effectGoldenBanana(); this.sfx('powerup'); break;
      case 'thunderMango': this.addScore(500); this.effectThunderMango(); this.sfx('powerup'); break;
      case 'staticStarfruit': this.addScore(500); this.rollStarfruit(); this.sfx('static'); break;
      default: break;
    }
    // pickup sparkle
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x: p.x + p.w / 2, y: p.y + p.h / 2, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 4,
        life: 30, maxLife: 30, color: '#f0e8a0', size: 2, grav: 0.05,
      });
    }
  }

  /** Golden Banana: every non-boss enemy in view becomes a coin. */
  private effectGoldenBanana(): void {
    this.flashT = Math.max(this.flashT, 10);
    for (const e of this.ents) {
      if (e.dead || e.remove || e.kind === 'boss') continue;
      if (!INSTANT_KILLABLE.has(e.kind)) continue;
      if (e.x + e.w < this.camX || e.x > this.camX + VIEW_W) continue;
      e.kind = 'coin';
      e.state = 'still';
      e.vx = 0; e.vy = 0;
      e.w = 12; e.h = 12;
      this.killScore(e, 100);
      for (let i = 0; i < 5; i++) {
        this.particles.push({
          x: e.x + 6, y: e.y + 6, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3 - 1,
          life: 25, maxLife: 25, color: '#ffe07a', size: 2, grav: 0.1,
        });
      }
    }
  }

  /** Thunder Mango: kill all on-screen enemies, break nearby bricks, flash + rumble. */
  private effectThunderMango(): void {
    if (!this.level) return;
    this.flashT = Math.max(this.flashT, 16);
    this.shakeT = Math.max(this.shakeT, 18);
    const killed: { x: number; y: number }[] = [];
    for (const e of this.ents) {
      if (e.dead || e.remove) continue;
      if (e.x + e.w < this.camX || e.x > this.camX + VIEW_W) continue;
      if (e.kind === 'boss') {
        e.hp--;
        this.flashBoss(e);
        if (e.hp <= 0) this.defeatBoss(e);
        continue;
      }
      if (!INSTANT_KILLABLE.has(e.kind)) continue;
      killed.push({ x: e.x, y: e.y });
      this.killEnemyFlip(e);
      this.killScore(e, 200);
    }
    // break bricks within ~3 tiles of each killed enemy
    for (const k of killed) {
      const cx = Math.floor(k.x / TS), cy = Math.floor(k.y / TS);
      for (let ty = cy - 3; ty <= cy + 3; ty++) {
        for (let tx = cx - 3; tx <= cx + 3; tx++) {
          if (tx * tx + ty * ty - (cx * cx + cy * cy) > 99) continue; // cheap radius gate
          if (tx < 0 || ty < 0 || tx >= this.level.width || ty >= this.level.height) continue;
          if (this.level.tiles[ty][tx] === TILE.Brick) {
            this.level.tiles[ty][tx] = TILE.Empty;
            for (let i = 0; i < 4; i++) {
              this.particles.push({
                x: tx * TS + 8, y: ty * TS + 8, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3,
                life: 30, maxLife: 30, color: '#8a9a8b', size: 2.5, grav: 0.3,
              });
            }
          }
        }
      }
    }
  }

  // ---------- Static Starfruit chaos effects ----------

  /** Roll a new starfruit effect. Restores any active effect first (no stacking). */
  rollStarfruit(force?: 'surge' | 'scramble'): void {
    if (this.glitchFx) this.restoreGlitchFx();
    const pick = force ?? (Math.random() < 0.5 ? 'surge' : 'scramble');
    if (pick === 'surge') {
      // Glitch Surge (10s): force one random toggle ON, restore it later (in-memory only)
      const keys = (Object.keys(this.glitches) as (keyof GlitchFlags)[]).filter((k) => k !== 'slowMo');
      const key = keys[Math.floor(Math.random() * keys.length)];
      this.glitchFx = { kind: 'surge', glitchKey: key, prevValue: this.glitches[key], t: 600, elapsed: 0 };
      this.glitches[key] = true;
    } else {
      // Physics Scramble (5s): randomize all sliders, restore the snapshot later
      const snap = { ...this.physics };
      for (const s of PHYSICS_SLIDERS) {
        this.physics[s.key] = s.min + Math.random() * (s.max - s.min);
      }
      this.physics.gravity = Math.max(0.15, this.physics.gravity);
      this.physics.jumpPower = Math.max(6, this.physics.jumpPower);
      this.glitchFx = { kind: 'scramble', prevPhysics: snap, t: 300, elapsed: 0 };
    }
    this.flashT = Math.max(this.flashT, 8);
    this.shakeT = Math.max(this.shakeT, 10);
  }

  /** Restore whatever a starfruit corrupted. In-memory only — localStorage untouched. */
  restoreGlitchFx(): void {
    const fx = this.glitchFx;
    if (!fx) return;
    if (fx.kind === 'surge' && fx.glitchKey !== undefined && fx.prevValue !== undefined) {
      this.glitches[fx.glitchKey] = fx.prevValue;
    } else if (fx.kind === 'scramble' && fx.prevPhysics) {
      Object.assign(this.physics, fx.prevPhysics);
    }
    this.glitchFx = null;
  }

  /** Warp target could not be resolved — sealed-jar feedback, stay in play. */
  warpFailed(): void {
    this.phase = 'play';
    this.shakeT = Math.max(this.shakeT, 8);
    const jar = this.warpAnim?.jar;
    if (jar) { jar.state = 'shake'; jar.t = 0; }
    this.warpAnim = null;
  }

  /** Fire an ember seed (Ember form). Max 2 alive. Fizzles underwater. */
  private fireEmber(): void {
    const p = this.player;
    if (!p) return;
    if (p.swimming) {
      // embers fizzle instantly underwater
      for (let i = 0; i < 6; i++) {
        this.particles.push({
          x: p.x + p.w / 2, y: p.y + p.h / 2, vx: (Math.random() - 0.5) * 2, vy: -Math.random(),
          life: 15, maxLife: 15, color: '#9adfe8', size: 2, grav: -0.05,
        });
      }
      return;
    }
    const alive = this.ents.filter((e) => e.kind === 'ember' && !e.remove).length;
    if (alive >= 2) return;
    this.sfx('ember');
    this.ents.push({
      kind: 'ember', x: p.x + p.w / 2 + p.facing * 8, y: p.y + p.h * 0.4, w: 8, h: 8,
      vx: p.facing * 4, vy: -2, onGround: false, dir: p.facing, frame: 0, state: 'fly',
      t: 180, dead: false, remove: false, hp: 1, baseY: 0, homeTx: 0, variant: '', target: '', extreme: false, stun: 0,
    });
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x: p.x + p.w / 2 + p.facing * 8, y: p.y + p.h * 0.4, vx: p.facing * Math.random() * 2, vy: -Math.random(),
        life: 12, maxLife: 12, color: '#ffb02e', size: 1.5, grav: 0.05,
      });
    }
  }

  /** Turn a tortoise/armadillo into its shell state (shared by stomp & ember). */
  private shellify(e: Ent): void {
    const shellKind = e.kind === 'armadillo' ? 'armadillo' : (e.variant === 'red' ? 'red' : 'green');
    e.kind = 'shell';
    e.state = 'still';
    e.variant = shellKind;
    e.h = 13; e.w = 14;
    e.y += 9;
    e.vx = 0; e.vy = 0;
  }

  /** Kapok Anvil ground-pound landing effects. */
  private poundLand(): void {
    if (!this.level || !this.player) return;
    const p = this.player;
    this.shakeT = Math.max(this.shakeT, 12);
    this.sfx('pound');
    // dust burst
    for (let i = 0; i < 12; i++) {
      this.particles.push({
        x: p.x + p.w / 2 + (Math.random() - 0.5) * 30, y: p.y + p.h,
        vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 2,
        life: 25, maxLife: 25, color: '#c9b184', size: 2.5, grav: 0.15,
      });
    }
    // defeat adjacent ground enemies within ~1.5 tiles
    for (const e of this.ents) {
      if (e.dead || e.remove) continue;
      if (!INSTANT_KILLABLE.has(e.kind) || e.kind === 'shell') continue;
      const dx = Math.abs(e.x + e.w / 2 - (p.x + p.w / 2));
      const dy = Math.abs(e.y + e.h - (p.y + p.h));
      if (dx < TS * 1.8 && dy < TS * 1.5) {
        this.killEnemyFlip(e);
        this.killScore(e, 200);
      }
    }
    // break brick blocks directly below (one layer), letting the pound continue
    const ty = Math.floor((p.y + p.h + 2) / TS);
    const x0 = Math.floor((p.x - 1) / TS), x1 = Math.floor((p.x + p.w + 1) / TS);
    let broke = false;
    for (let tx = x0; tx <= x1; tx++) {
      if (tx >= 0 && tx < this.level.width && ty >= 0 && ty < this.level.height && this.level.tiles[ty][tx] === TILE.Brick) {
        this.level.tiles[ty][tx] = TILE.Empty;
        broke = true;
        this.addScore(50);
        for (let i = 0; i < 6; i++) {
          this.particles.push({
            x: tx * TS + 8, y: ty * TS + 8, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3,
            life: 30, maxLife: 30, color: '#8a9a8b', size: 2.5, grav: 0.3,
          });
        }
      }
    }
    if (broke) p.vy = 6; // keep smashing through
  }

  private addCoin(x: number, y: number): void {
    if (!this.session) return;
    this.session.coins++;
    this.session.score += 200;
    this.sfx('coin');
    if (this.session.coins >= 100) { this.session.coins -= 100; this.session.lives++; this.sfx('1up'); }
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x, y, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3 - 1,
        life: 30, maxLife: 30, color: '#ffe07a', size: 2, grav: 0.15,
      });
    }
    this.onStats();
  }

  private addScore(n: number): void {
    if (!this.session) return;
    this.session.score += n;
    this.onStats();
  }

  // ================= main update =================

  update(input: InputState): void {
    if (!this.level || !this.player || this.editorMode) return;
    this.tick++;
    const p = this.player;
    const g = this.glitches;
    const phys = this.physics;

    if (this.phase === 'dying') {
      p.vy += 0.5; p.y += p.vy;
      this.phaseTimer++;
      this.updateParticles();
      if (this.phaseTimer > 140) {
        if (this.session) {
          this.session.lives--;
          this.onStats();
          if (this.session.lives < 0) { this.onGameOver(); return; }
        }
        this.onDied(this.session ? this.session.lives : 0);
      }
      return;
    }

    if (this.phase === 'complete') {
      // celebration: auto-walk right
      this.phaseTimer++;
      p.vx = 1.2;
      this.moveX(p, p.vx, false);
      p.anim++;
      if (Math.random() < 0.1) {
        this.particles.push({
          x: p.x + Math.random() * 60, y: p.y - 30 - Math.random() * 40,
          vx: (Math.random() - 0.5) * 2, vy: Math.random() * 1,
          life: 50, maxLife: 50, color: ['#ffe07a', '#e05fd0', '#6fd66f'][Math.floor(Math.random() * 3)], size: 2, grav: 0.02,
        });
      }
      this.updateParticles();
      if (this.phaseTimer > 150) this.onLevelComplete();
      return;
    }

    if (this.phase === 'bossfall') {
      this.phaseTimer++;
      this.updateEntsOnly();
      this.updateParticles();
      if (this.phaseTimer > 130) {
        this.phase = 'complete';
        this.phaseTimer = 0;
        this.addScore(5000);
      }
      return;
    }

    if (this.phase === 'warp') {
      const w = this.warpAnim;
      if (!w) { this.phase = 'play'; return; }
      w.t++;
      // shrink & slide into the jar mouth
      p.x += (w.jar.x + w.jar.w / 2 - (p.x + p.w / 2)) * 0.15;
      p.y += 0.55;
      this.updateParticles();
      if (this.glitchFx) { this.glitchFx.t--; this.glitchFx.elapsed++; if (this.glitchFx.t <= 0) this.restoreGlitchFx(); }
      if (w.t >= 40) this.onWarpRequest(w.jar.target, w.jar.x, w.jar.y);
      return;
    }

    // ---------- effective physics ----------
    let gravity = phys.gravity;
    if (g.moonGravity) gravity *= 0.35;
    const friction = g.icePhysics ? 0.015 : phys.friction;
    let accel = g.icePhysics ? phys.accel * 0.5 : phys.accel;
    const jaguar = p.timers.jaguar > 0;
    if (jaguar) accel *= 2;
    let maxSpeed = phys.runSpeed * (input.run ? 1.45 : 1);
    if (jaguar) maxSpeed *= 1.8;
    let jumpPow = phys.jumpPower;
    if (p.form === 'frog') jumpPow *= 1.25;
    if (p.timers.legs > 0) jumpPow *= 1.6;
    let bounceMul = g.superBounce ? 2.1 : phys.bounceFactor;
    if (p.timers.legs > 0) bounceMul = Math.max(bounceMul, 2.0);

    // ---------- swim mode ----------
    const wasSwimming = p.swimming;
    p.swimming = this.tileAtPx(p.x + p.w / 2, p.y + p.h / 2) === TILE.SwimWater;
    if (p.swimCd > 0) p.swimCd--;
    if (p.swimming) { maxSpeed *= 0.6; accel *= 0.6; }
    if (wasSwimming && !p.swimming && p.vy < 0) p.vy -= 1.2; // exit-water hop bonus

    // ---------- ember fire (X press while in Ember form) ----------
    if (input.firePressed && p.form === 'ember' && !p.dead) this.fireEmber();

    // ---------- kapok anvil ground pound ----------
    if (p.form === 'anvil' && !p.dead && input.down && !p.onGround && !p.pound && p.vy > -2 && !p.swimming) {
      p.pound = true;
      p.vx = 0;
      p.vy = 8;
    }

    // ---------- player horizontal ----------
    const left = g.reversedControls ? input.right : input.left;
    const right = g.reversedControls ? input.left : input.right;
    if (!p.dead && !p.pound) {
      if (left && !right) {
        p.vx = Math.max(p.vx - accel, -maxSpeed);
        p.facing = -1;
      } else if (right && !left) {
        p.vx = Math.min(p.vx + accel, maxSpeed);
        p.facing = 1;
      } else {
        const f = friction;
        if (p.vx > 0) p.vx = Math.max(0, p.vx - f);
        else p.vx = Math.min(0, p.vx + f);
      }
    }

    // ---------- jumping ----------
    if (input.jumpPressed) p.buffer = BUFFER_FRAMES;
    else if (p.buffer > 0) p.buffer--;
    if (p.onGround) { p.coyote = COYOTE_FRAMES; p.airJumps = g.doubleJump ? 1 : 0; }
    else if (p.coyote > 0) p.coyote--;

    if (p.buffer > 0 && !p.dead && p.swimming && p.swimCd <= 0) {
      // swim stroke (SMB1-style, ~12 frame cooldown)
      p.vy = -3.2;
      p.swimCd = 12;
      p.buffer = 0;
      this.sfx('swim');
      for (let i = 0; i < 4; i++) {
        this.particles.push({
          x: p.x + p.w / 2 + (Math.random() - 0.5) * 8, y: p.y + p.h / 2,
          vx: (Math.random() - 0.5) * 1, vy: -Math.random() * 1.5,
          life: 25, maxLife: 25, color: '#c9f2f8', size: 1.5, grav: -0.08,
        });
      }
    }

    if (p.buffer > 0 && !p.dead && !p.swimming) {
      let jumped = false;
      if (p.onGround || p.coyote > 0) {
        p.vy = -jumpPow;
        p.onGround = false; p.coyote = 0;
        jumped = true;
      } else if (g.infiniteJump) {
        p.vy = -jumpPow;
        jumped = true;
      } else if (g.doubleJump && p.airJumps > 0) {
        p.vy = -jumpPow * 0.92;
        p.airJumps--;
        jumped = true;
      } else if (p.wallSlide !== 0 && (g.wallJump || p.form === 'frog')) {
        p.vy = -jumpPow * 0.95;
        p.vx = -p.wallSlide * maxSpeed * 1.1;
        p.facing = p.wallSlide === 1 ? -1 : 1;
        jumped = true;
      }
      if (jumped) {
        p.buffer = 0;
        this.sfx('jump');
        if (p.timers.legs > 0) {
          for (let i = 0; i < 5; i++) {
            this.particles.push({
              x: p.x + p.w / 2 + (Math.random() - 0.5) * 10, y: p.y + p.h,
              vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 1.5,
              life: 25, maxLife: 25, color: ['#6fd66f', '#3fae4a', '#c9e8a0'][i % 3], size: 2, grav: 0.1,
            });
          }
        }
        for (let i = 0; i < 4; i++) {
          this.particles.push({
            x: p.x + p.w / 2, y: p.y + p.h, vx: (Math.random() - 0.5) * 2, vy: Math.random(),
            life: 15, maxLife: 15, color: '#d8f0d8', size: 1.5, grav: 0.05,
          });
        }
      }
    }

    // variable jump height: release jump to cut velocity
    if (!input.jump && p.vy < -3.5 && p.timers.wings <= 0 && !p.swimming) p.vy = -3.5;

    // gravity (higher when falling); buoyancy while swimming
    const falling = p.vy > 0;
    if (p.swimming) {
      p.vy += 0.08;
      if (p.vy > 1.2) p.vy = 1.2; // max sink speed
      if (p.vy < -4) p.vy = -4;
    } else {
      p.vy += gravity * (falling ? GRAV_FALL_MULT : 1);
      if (p.pound) { p.vy += 0.6; p.vx = 0; }
      // macaw wings: hold jump to flap upward slowly, release to glide
      if (p.timers.wings > 0 && !p.onGround && !p.pound) {
        if (input.jump) p.vy = Math.max(-2.2, p.vy - 0.55);
        else if (p.vy > 1.5) p.vy = 1.5;
      }
    }
    if (p.vy > (p.pound ? 16 : 13)) p.vy = p.pound ? 16 : 13;

    // ---------- move player ----------
    let scale = g.tinyPlayer ? 0.6 : g.giantPlayer ? 1.7 : 1;
    if (p.timers.shrink > 0) scale *= 0.5;
    const targetW = (p.big ? 14 : 12) * scale;
    const targetH = (p.big ? 28 : 14) * scale;
    if (Math.abs(targetH - p.h) > 0.5) {
      const dh = targetH - p.h;
      p.h = targetH; p.w = targetW; p.y -= dh; // grow upward
    }

    const wallHit = this.moveX(p, p.vx, g.ghostWalk);
    p.wallSlide = 0;
    if (wallHit !== 0 && !p.onGround) p.wallSlide = wallHit;

    // tree frog wall cling: pressing toward a wall while airborne slides slowly
    p.cling = 0;
    if (p.form === 'frog' && !p.onGround && p.vy > 0 && p.wallSlide !== 0) {
      const pushDir = left ? -1 : right ? 1 : 0;
      if (pushDir === p.wallSlide) {
        p.vy = Math.min(p.vy, 1.1);
        p.cling = p.wallSlide;
      }
    }

    const prevBottom = p.y + p.h;
    const wasGrounded = p.onGround;
    const landResult = this.moveY(p, p.vy, g.ghostWalk, true, prevBottom);
    if (landResult === 1) {
      if (p.pound) {
        this.poundLand();
        if (p.vy > 0.1) { p.onGround = false; } // smashed through bricks — keep falling
        else { p.pound = false; p.vy = 0; p.onGround = true; }
      } else if (!wasGrounded && g.trampolineGround) {
        p.vy = -Math.min(12, Math.abs(p.vy) * 0.85 + 2);
        p.onGround = false;
      } else {
        if (!wasGrounded && p.vy > 7) {
          for (let i = 0; i < 5; i++) {
            this.particles.push({
              x: p.x + Math.random() * p.w, y: p.y + p.h, vx: (Math.random() - 0.5) * 2.5, vy: -Math.random(),
              life: 18, maxLife: 18, color: '#c9b184', size: 1.5, grav: 0.12,
            });
          }
        }
        p.vy = 0;
        p.onGround = true;
      }
    } else {
      p.onGround = false;
      if (landResult === -1) p.vy = Math.max(p.vy, 0.5);
    }

    // crumbling bridges under the player
    if (p.onGround) {
      const ty = Math.floor((p.y + p.h + 1) / TS);
      const x0 = Math.floor(p.x / TS), x1 = Math.floor((p.x + p.w) / TS);
      for (let tx = x0; tx <= x1; tx++) {
        if (tileAt(this.level, tx, ty) === TILE.Bridge) {
          const key = tx + ',' + ty;
          const v = (this.crumble.get(key) ?? 0) + 1;
          this.crumble.set(key, v);
          if (v > 28) {
            this.level.tiles[ty][tx] = TILE.Empty;
            this.crumble.delete(key);
            for (let i = 0; i < 6; i++) {
              this.particles.push({
                x: tx * TS + 8, y: ty * TS + 4, vx: (Math.random() - 0.5) * 2, vy: Math.random(),
                life: 40, maxLife: 40, color: '#a5722e', size: 2, grav: 0.3,
              });
            }
          }
        }
      }
    }

    // hazard tiles
    if (!p.dead && !g.invincible && p.invuln <= 0) {
      const cx = p.x + p.w / 2, feet = p.y + p.h;
      const tC = this.tileAtPx(cx, p.y + p.h * 0.5);
      const tF = this.tileAtPx(cx, feet - 1);
      if (tC === TILE.Lava || tF === TILE.Lava || tC === TILE.Spikes || tF === TILE.Spikes) {
        this.hurtPlayer(true);
      } else if (tF === TILE.Water && p.vy >= 0) {
        this.hurtPlayer(true);
        for (let i = 0; i < 8; i++) {
          this.particles.push({
            x: cx, y: feet, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3,
            life: 25, maxLife: 25, color: '#7fd8ef', size: 2, grav: 0.2,
          });
        }
      }
    }

    // pit death
    if (!p.dead && p.y > this.level.height * TS + 24) this.hurtPlayer(true);

    if (p.invuln > 0) p.invuln--;
    p.anim++;

    // ---------- timed powerup countdowns ----------
    for (const key of Object.keys(p.timers) as TimedKey[]) {
      if (p.timers[key] <= 0) continue;
      if (key === 'shrink' && p.timers.shrink <= 1) {
        // shrinkberry only expires when there's headroom to grow back
        if (this.canGrow(p)) p.timers.shrink = 0;
      } else {
        p.timers[key]--;
      }
    }

    // rainbow orchid sparkles
    if (p.timers.orchid > 0 && this.tick % 3 === 0) {
      this.particles.push({
        x: p.x + Math.random() * p.w, y: p.y + Math.random() * p.h,
        vx: (Math.random() - 0.5) * 1.5, vy: -Math.random() * 1.5,
        life: 20, maxLife: 20, color: `hsl(${(this.tick * 13) % 360},95%,70%)`, size: 2, grav: 0,
      });
    }

    // coin capuchin magnet: nearby coins fly to the player
    if (p.timers.capuchin > 0) {
      for (const e of this.ents) {
        if (e.kind !== 'coin' || e.remove) continue;
        const dx = p.x + p.w / 2 - (e.x + e.w / 2);
        const dy = p.y + p.h / 2 - (e.y + e.h / 2);
        const dist = Math.hypot(dx, dy);
        if (dist < TS * 4 && dist > 2) {
          e.x += (dx / dist) * 3.2;
          e.y += (dy / dist) * 3.2;
        }
      }
    }

    // rainbow trail
    if (g.rainbowTrail && (Math.abs(p.vx) > 0.5 || Math.abs(p.vy) > 0.5)) {
      this.rainbowHue = (this.rainbowHue + 7) % 360;
      this.particles.push({
        x: p.x + p.w / 2, y: p.y + p.h / 2, vx: 0, vy: 0,
        life: 24, maxLife: 24, color: `hsl(${this.rainbowHue},90%,65%)`, size: 2.5, grav: 0,
      });
    }

    // ---------- entities ----------
    this.updateEntsOnly();

    // ---------- static starfruit countdown ----------
    if (this.glitchFx) {
      this.glitchFx.t--;
      this.glitchFx.elapsed++;
      if (this.glitchFx.t <= 0) this.restoreGlitchFx();
    }

    // ---------- player vs entities ----------
    if (!p.dead) this.playerVsEnts(bounceMul);

    // ---------- warp jar: stand on top + press DOWN ----------
    if (input.down && !p.dead) {
      for (const e of this.ents) {
        if (e.kind !== 'warpJar' || e.remove) continue;
        const px = p.x + p.w / 2, jx = e.x + e.w / 2;
        if (Math.abs(px - jx) < 14 && p.y + p.h > e.y - 4 && p.y + p.h < e.y + 12) {
          this.phase = 'warp';
          this.warpAnim = { t: 0, jar: e };
          p.vx = 0; p.vy = 0;
          this.sfx('warp');
          break;
        }
      }
    }

    // ---------- camera ----------
    const levelWpx = this.level.width * TS;
    const levelHpx = this.level.height * TS;
    const fwdTarget = p.x + p.w - VIEW_W * 0.45;
    if (fwdTarget > this.camX) this.camX = Math.min(fwdTarget, levelWpx - VIEW_W);
    const backTarget = p.x - VIEW_W * 0.32;
    if (backTarget < this.camX) this.camX = Math.max(Math.max(backTarget, 0), Math.min(this.maxCamX - VIEW_W * 0.25, levelWpx - VIEW_W));
    this.camX = Math.max(0, Math.min(this.camX, Math.max(0, levelWpx - VIEW_W)));
    this.maxCamX = Math.max(this.maxCamX, this.camX);
    const camYt = Math.max(0, Math.min(p.y - VIEW_H * 0.55, levelHpx - VIEW_H));
    this.camY += (camYt - this.camY) * 0.12;

    this.updateParticles();
    for (const b of this.bumpAnims) b.t++;
    this.bumpAnims = this.bumpAnims.filter((b) => b.t < 12);
    if (this.shakeT > 0) this.shakeT--;
    if (this.flashT > 0) this.flashT--;
  }

  /** Is there headroom for the player to return to normal size (shrinkberry expiry)? */
  private canGrow(p: Player): boolean {
    const g = this.glitches;
    const scale = g.tinyPlayer ? 0.6 : g.giantPlayer ? 1.7 : 1;
    const targetH = (p.big ? 28 : 14) * scale;
    const targetW = (p.big ? 14 : 12) * scale;
    if (targetH <= p.h + 0.5) return true;
    if (!this.level) return true;
    const newY = p.y + p.h - targetH;
    // check the region the grown body would newly occupy (above the current head)
    const x0 = Math.floor(p.x / TS), x1 = Math.floor((p.x + targetW) / TS);
    const y0 = Math.floor(newY / TS), y1 = Math.floor(p.y / TS);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (SOLID_TILES.has(tileAt(this.level, tx, ty))) return false;
      }
    }
    return true;
  }

  // ================= entities =================

  private updateEntsOnly(): void {
    if (!this.level || !this.player) return;
    const p = this.player;
    const spd = this.physics.enemySpeed;
    const viewL = this.camX - 80, viewR = this.camX + VIEW_W + 80;

    for (const e of this.ents) {
      if (e.remove) continue;
      e.frame++;
      // dead enemies flip & fall
      if (e.dead) {
        e.vy += 0.4; e.y += e.vy; e.x += e.vx;
        if (e.y > this.level.height * TS + 80) e.remove = true;
        continue;
      }
      // extreme "crack" stun: paused, still falls/lands
      if (e.stun > 0) {
        e.stun--;
        e.vy += 0.4; if (e.vy > 10) e.vy = 10;
        if (this.moveY(e, e.vy, false, true) === 1) { e.vy = 0; e.onGround = true; } else e.onGround = false;
        continue;
      }
      // skip far-off entities (except boss/eagle/goal)
      if (!['boss', 'eagle', 'goal', 'gong', 'axe', 'warpJar'].includes(e.kind) && (e.x + e.w < viewL || e.x > viewR)) continue;

      // EXTREME enemies move ~1.4x faster
      const spdE = e.extreme ? spd * 1.4 : spd;

      switch (e.kind) {
        case 'beetle': {
          if (e.state === 'init') { e.state = 'walk'; e.vx = -0.5 * spdE; }
          e.vy += 0.4; if (e.vy > 10) e.vy = 10;
          const hit = this.moveX(e, e.vx, false);
          if (hit !== 0) { e.vx = -hit * 0.5 * spdE; e.dir = (-hit) as 1 | -1; }
          e.dir = e.vx > 0 ? 1 : -1;
          if (this.moveY(e, e.vy, false, true) === 1) { e.vy = 0; e.onGround = true; } else e.onGround = false;
          // EXTREME: hops periodically
          if (e.extreme && e.onGround && e.frame % 110 === 0) e.vy = -5.5;
          break;
        }
        case 'durian': {
          if (e.state === 'init') { e.state = 'walk'; e.vx = -0.45 * spdE; }
          e.vy += 0.4; if (e.vy > 10) e.vy = 10;
          // EXTREME: leaps at nearby players
          if (e.extreme && e.onGround && e.frame % 90 === 0 &&
            Math.abs(p.x - e.x) < TS * 5 && Math.abs(p.y - e.y) < TS * 3) {
            e.vy = -7; e.vx = (p.x < e.x ? -1 : 1) * 1.2 * spdE;
          }
          const hit = this.moveX(e, e.vx, false);
          if (hit !== 0) e.vx = -hit * 0.45 * spdE;
          if (this.moveY(e, e.vy, false, true) === 1) { e.vy = 0; e.onGround = true; } else e.onGround = false;
          break;
        }
        case 'tortoise': {
          if (e.state === 'init') { e.state = 'walk'; e.vx = -0.45 * spdE; }
          e.vy += 0.4; if (e.vy > 10) e.vy = 10;
          // red tortoises turn at ledges
          if (e.variant === 'red' && e.onGround) {
            const aheadX = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
            const belowTy = Math.floor((e.y + e.h + 2) / TS);
            const aheadTx = Math.floor(aheadX / TS);
            const tBelow = tileAt(this.level, aheadTx, belowTy);
            if (!SOLID_TILES.has(tBelow) && !ONEWAY_TILES.has(tBelow)) e.vx = -e.vx;
          }
          const hit = this.moveX(e, e.vx, false);
          if (hit !== 0) e.vx = -hit * 0.45 * spdE;
          e.dir = e.vx > 0 ? 1 : -1;
          if (this.moveY(e, e.vy, false, true) === 1) { e.vy = 0; e.onGround = true; } else e.onGround = false;
          break;
        }
        case 'armadillo': {
          if (e.state === 'init') { e.state = 'walk'; e.vx = -0.5 * spdE; }
          e.vy += 0.4; if (e.vy > 10) e.vy = 10;
          const hit = this.moveX(e, e.vx, false);
          if (hit !== 0) e.vx = -hit * 0.5 * spdE;
          e.dir = e.vx > 0 ? 1 : -1;
          if (this.moveY(e, e.vy, false, true) === 1) { e.vy = 0; e.onGround = true; } else e.onGround = false;
          break;
        }
        case 'shell': {
          e.vy += 0.45; if (e.vy > 11) e.vy = 11;
          if (e.state === 'slide') {
            // sliding shells break bricks
            const frontX = e.vx > 0 ? e.x + e.w + 1 : e.x - 1;
            const ftx = Math.floor(frontX / TS);
            const fty = Math.floor((e.y + e.h - 4) / TS);
            if (tileAt(this.level, ftx, fty) === TILE.Brick) {
              this.level.tiles[fty][ftx] = TILE.Empty;
              this.addScore(50);
              for (let i = 0; i < 8; i++) {
                this.particles.push({
                  x: ftx * TS + 8, y: fty * TS + 8, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 4,
                  life: 35, maxLife: 35, color: '#8a9a8b', size: 3, grav: 0.3,
                });
              }
            }
            const hit = this.moveX(e, e.vx, false);
            if (hit !== 0) {
              e.vx = -e.vx; // bounce off walls
              // EXTREME armadillo shells ricochet off walls with a hop
              if (e.extreme && e.variant === 'armadillo') e.vy = -4;
            }
            // EXTREME tortoise shells home slightly toward the player
            if (e.extreme && e.variant !== 'armadillo') {
              const maxV = 8.5;
              e.vx += Math.sign(p.x + p.w / 2 - (e.x + e.w / 2)) * 0.04;
              if (Math.abs(e.vx) > maxV) e.vx = Math.sign(e.vx) * maxV;
            }
            // shell kills other enemies
            for (const o of this.ents) {
              if (o === e || o.dead || o.remove) continue;
              if (!['beetle', 'tortoise', 'armadillo', 'durian', 'monkey', 'flytrap', 'jaguarWarrior', 'serpent', 'sentinel'].includes(o.kind)) continue;
              if (this.overlap(e, o)) { this.killEnemyFlip(o); this.killScore(o, 200); this.sfx('stomp'); }
            }
            // shell hits boss
            const boss = this.ents.find((o) => o.kind === 'boss' && !o.dead && !o.remove);
            if (boss && this.overlap(e, boss)) {
              e.vx = -e.vx;
              boss.hp--;
              boss.t = Math.min(boss.t, 10);
              this.flashBoss(boss);
              if (boss.hp <= 0) this.defeatBoss(boss);
            }
          }
          if (this.moveY(e, e.vy, false, true) === 1) { e.vy = 0; e.onGround = true; } else e.onGround = false;
          if (e.y > this.level.height * TS + 40) e.remove = true;
          break;
        }
        case 'flytrap': {
          const near = Math.abs((p.x + p.w / 2) - (e.x + e.w / 2)) < TS * 2.2 && Math.abs(p.y - e.y) < TS * 6;
          e.t++;
          // EXTREME: emerges faster with longer reach
          const riseSpd = (e.extreme ? 1.0 : 0.6) * spdE;
          const reach = e.extreme ? 22 : 14;
          if (e.state === 'hidden') {
            e.y = e.baseY + 18;
            if (e.t > (e.extreme ? 40 : 70) && !near) { e.state = 'rise'; e.t = 0; }
          } else if (e.state === 'rise') {
            e.y -= riseSpd;
            if (e.y <= e.baseY - reach) { e.y = e.baseY - reach; e.state = 'hold'; e.t = 0; }
          } else if (e.state === 'hold') {
            if (e.t > 60) { e.state = 'lower'; e.t = 0; }
          } else if (e.state === 'lower') {
            e.y += riseSpd;
            if (e.y >= e.baseY + 18) { e.y = e.baseY + 18; e.state = 'hidden'; e.t = 0; }
          }
          break;
        }
        case 'monkey': {
          e.vy += 0.4; if (e.vy > 10) e.vy = 10;
          e.dir = p.x < e.x ? -1 : 1;
          e.t++;
          // occasional hop
          if (e.onGround && e.t % 140 === 50) { e.vy = -6; e.vx = e.dir * 0.8 * spdE; }
          // throw coconuts (EXTREME: 3-coconut spread)
          if (e.t % 150 === 100) {
            const volleys = e.extreme ? [-6.4, -5.2, -4.0] : [-5.2];
            for (const v0 of volleys) {
              this.ents.push({
                kind: 'coconut', x: e.x + e.w / 2, y: e.y - 4, w: 8, h: 8,
                vx: e.dir * 1.6 * spdE, vy: v0, onGround: false, dir: e.dir, frame: 0,
                state: 'fly', t: 0, dead: false, remove: false, hp: 1, baseY: 0, homeTx: 0, variant: '', target: '', extreme: false, stun: 0,
              });
            }
          }
          if (e.onGround) e.vx *= 0.8;
          this.moveX(e, e.vx, false);
          if (this.moveY(e, e.vy, false, true) === 1) { e.vy = 0; e.onGround = true; } else e.onGround = false;
          break;
        }
        case 'coconut': {
          e.vy += 0.28;
          const hit = this.moveX(e, e.vx, false);
          const landed = this.moveY(e, e.vy, false, false);
          if (hit !== 0 || landed !== 0 || e.y > this.level.height * TS + 40) e.remove = true;
          break;
        }
        case 'eagle': {
          // sinusoidal flight following the player, drops durians
          e.t++;
          const targetX = p.x + p.w / 2 - e.w / 2;
          e.x += Math.max(-1.4 * spdE, Math.min(1.4 * spdE, (targetX - e.x) * 0.02));
          const hoverBase = Math.max(8, this.camY + 24);
          e.y = hoverBase + Math.sin(e.t * 0.045) * 14;
          if (e.t % 210 === 120) {
            // EXTREME: drops a 3-durian volley
            const drops = e.extreme ? [-12, 0, 12] : [0];
            for (const dx of drops) {
              this.ents.push({
                kind: 'durianDrop', x: e.x + e.w / 2 - 7 + dx, y: e.y + e.h, w: 14, h: 14,
                vx: 0, vy: 0, onGround: false, dir: -1, frame: 0, state: 'fall', t: 0,
                dead: false, remove: false, hp: 1, baseY: 0, homeTx: 0, variant: '', target: '', extreme: false, stun: 0,
              });
            }
          }
          break;
        }
        case 'durianDrop': {
          e.vy += 0.35; if (e.vy > 8) e.vy = 8;
          const r = this.moveY(e, e.vy, false, true);
          if (r === 1) {
            e.kind = 'durian'; e.state = 'walk'; e.vx = (p.x < e.x ? -1 : 1) * 0.45 * spdE; e.vy = 0;
          }
          if (e.y > this.level.height * TS + 40) e.remove = true;
          break;
        }
        case 'piranha': {
          e.t--;
          if (e.state === 'wait') {
            if (e.t <= 0) {
              e.state = 'leap';
              // EXTREME: leaps much higher
              e.vy = -8.8 * Math.min(1.4, spdE) * (e.extreme ? 1.5 : 1);
              e.vx = Math.max(-1, Math.min(1, (p.x - e.x) * 0.01));
            }
          } else if (e.state === 'leap') {
            e.vy += 0.32;
            e.x += e.vx;
            e.y += e.vy;
            if (e.vy > 0 && e.y > e.baseY) {
              e.y = e.baseY; e.state = 'wait'; e.t = 90 + Math.floor(Math.random() * 120);
              for (let i = 0; i < 6; i++) {
                this.particles.push({
                  x: e.x + 7, y: e.baseY, vx: (Math.random() - 0.5) * 2.5, vy: -Math.random() * 2.5,
                  life: 20, maxLife: 20, color: '#7fd8ef', size: 2, grav: 0.2,
                });
              }
            }
          }
          break;
        }
        case 'bloom': case 'emberChili': case 'frogSuit': case 'kapokAnvil':
        case 'macawWings': case 'jaguarPelt': case 'rainbowOrchid':
        case 'grasshopperLegs': case 'shrinkberry': case 'coinCapuchin':
        case 'goldenBanana': case 'thunderMango': {
          if (e.state === 'emerge') {
            e.t++;
            if (e.t > 30) {
              if (WALKER_ITEMS.has(e.kind)) { e.state = 'walk'; e.vx = 0.8; }
              else if (FLOATER_ITEMS.has(e.kind)) { e.state = 'drift'; e.vx = 0.5; }
              else e.state = 'still';
            }
          } else if (e.state === 'walk') {
            e.vy += 0.35; if (e.vy > 9) e.vy = 9;
            const hit = this.moveX(e, e.vx, false);
            if (hit !== 0) e.vx = -hit * 0.8;
            if (this.moveY(e, e.vy, false, true) === 1) { e.vy = 0; e.onGround = true; } else e.onGround = false;
          } else if (e.state === 'drift') {
            // gentle floating: slow horizontal drift + sine bob, no gravity
            const hit = this.moveX(e, e.vx, false);
            if (hit !== 0) e.vx = -hit * 0.5;
            e.y = e.baseY + Math.sin(e.frame * 0.05) * 6;
            e.baseY += Math.sin(e.frame * 0.01) * 0.1;
          }
          if (e.y > this.level.height * TS + 40) e.remove = true;
          break;
        }
        case 'ember': {
          // bouncing ember seed projectile
          e.t--;
          if (e.t <= 0) { e.remove = true; break; }
          e.vy += 0.3; if (e.vy > 9) e.vy = 9;
          const hit = this.moveX(e, e.vx, false);
          if (hit !== 0) { e.remove = true; break; } // dies on walls
          const landed = this.moveY(e, e.vy, false, false);
          if (landed === 1) e.vy = -3.2; // bounce off ground
          // hit enemies
          for (const o of this.ents) {
            if (o === e || o.dead || o.remove) continue;
            if (!this.overlap(e, o)) continue;
            if (o.kind === 'armadillo' || o.kind === 'sentinel') {
              // fireproof — the ember fizzles
              e.remove = true;
              for (let i = 0; i < 6; i++) {
                this.particles.push({
                  x: e.x + 4, y: e.y + 4, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2,
                  life: 18, maxLife: 18, color: '#8a8f96', size: 2, grav: 0.1,
                });
              }
              break;
            }
            if (o.kind === 'boss') {
              e.remove = true;
              o.hp--;
              this.flashBoss(o);
              if (o.hp <= 0) this.defeatBoss(o);
              break;
            }
            if (['beetle', 'durian', 'durianDrop', 'monkey', 'eagle', 'flytrap', 'piranha', 'jaguarWarrior', 'serpent'].includes(o.kind)) {
              this.killEnemyFlip(o);
              this.killScore(o, 200);
              e.remove = true;
              break;
            }
            if (o.kind === 'tortoise') {
              this.shellify(o);
              this.addScore(200);
              e.remove = true;
              break;
            }
          }
          break;
        }
        case 'coin': break; // static, spins via frame
        case 'swimfish': {
          // swims horizontally inside SwimWater, sine bob, turns at walls/water edge
          const spdF = 0.5 * Math.max(0.4, spdE);
          if (e.vx === 0) e.vx = -spdF;
          // EXTREME: lunges at nearby swimmers
          if (e.extreme &&
            Math.abs(p.y + p.h / 2 - (e.y + e.h / 2)) < TS * 1.5 &&
            Math.abs(p.x + p.w / 2 - (e.x + e.w / 2)) < TS * 3.5) {
            e.vx = (p.x + p.w / 2 >= e.x + e.w / 2 ? 1 : -1) * spdF * 3;
          }
          const aheadX = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
          if (this.tileAtPx(aheadX, e.y + e.h / 2) !== TILE.SwimWater) e.vx = (e.vx > 0 ? -1 : 1) * spdF;
          e.dir = e.vx > 0 ? 1 : -1;
          e.x += e.vx;
          e.y = e.baseY + Math.sin(e.frame * 0.06) * 4;
          break;
        }
        case 'jaguarWarrior': {
          // patrols; crouches (0.4s tell) then LUNGES when the player is near & level
          if (e.state === 'init') { e.state = 'walk'; e.vx = -0.5 * spdE; }
          e.vy += 0.4; if (e.vy > 10) e.vy = 10;
          const pdx = (p.x + p.w / 2) - (e.x + e.w / 2);
          const nearLevel = Math.abs((p.y + p.h) - (e.y + e.h)) < TS * 2;
          if (e.state === 'walk') {
            if (e.t < 0) e.t++; // post-lunge cooldown
            const hit = this.moveX(e, e.vx, false);
            if (hit !== 0) e.vx = -hit * 0.5 * spdE;
            e.dir = e.vx > 0 ? 1 : -1;
            if (e.t >= 0 && e.onGround && nearLevel && Math.abs(pdx) < TS * 5) {
              e.state = 'crouch'; e.t = 0; e.vx = 0;
              e.dir = pdx > 0 ? 1 : -1;
            }
          } else if (e.state === 'crouch') {
            e.t++;
            e.dir = pdx > 0 ? 1 : -1;
            if (e.t >= 24) {
              e.state = 'lunge'; e.t = 0;
              e.vx = e.dir * (e.extreme ? 4.5 : 3.2) * Math.max(0.7, spdE);
              e.vy = -2;
            }
          } else if (e.state === 'lunge') {
            e.t++;
            const hit = this.moveX(e, e.vx, false);
            if (hit !== 0 || e.t > (e.extreme ? 30 : 22)) {
              e.state = 'walk'; e.t = -50; // recover before the next lunge
              e.vx = e.dir * 0.5 * spdE;
            }
          }
          if (this.moveY(e, e.vy, false, true) === 1) { e.vy = 0; e.onGround = true; } else e.onGround = false;
          break;
        }
        case 'serpent': {
          // quetzal serpent: wide sine patrol across its home range, no gravity
          if (e.state === 'init') { e.state = 'fly'; e.vx = 0.8 * spdE * (e.extreme ? 1.5 : 1); e.dir = 1; }
          e.x += e.vx;
          const homeX = e.homeTx * TS + 8;
          if (Math.abs(e.x + e.w / 2 - homeX) > TS * 6) {
            e.x = homeX + Math.sign(e.x + e.w / 2 - homeX) * TS * 6 - e.w / 2;
            e.vx = -e.vx;
          }
          e.dir = e.vx > 0 ? 1 : -1;
          e.y = e.baseY + Math.sin(e.frame * 0.045) * 22;
          // EXTREME: leaves a harmless sparkle trail
          if (e.extreme && e.frame % 4 === 0) {
            this.particles.push({
              x: e.x + e.w / 2, y: e.y + e.h / 2, vx: (Math.random() - 0.5) * 0.5, vy: -0.3,
              life: 22, maxLife: 22, color: ['#3ac8f0', '#f2b632', '#6fe0a0'][e.frame % 3], size: 1.5, grav: -0.01,
            });
          }
          break;
        }
        case 'sentinel': {
          // stationary sun-stone turret: fires arcing sun-darts at nearby players
          e.t++;
          const cycle = e.extreme ? 100 : 150;
          if (e.t >= cycle) {
            const pdx = (p.x + p.w / 2) - (e.x + e.w / 2);
            if (Math.abs(pdx) < TS * 8 && Math.abs(p.y - e.y) < TS * 6) {
              e.t = 0;
              const dir = pdx > 0 ? 1 : -1;
              const shots = e.extreme ? 2 : 1;
              for (let s = 0; s < shots; s++) {
                this.ents.push({
                  kind: 'sunDart', x: e.x + e.w / 2 + dir * 8, y: e.y + 10 - s * 4, w: 10, h: 6,
                  vx: dir * (1.4 + s * 0.3), vy: -3.2 - s * 0.8, onGround: false, dir, frame: 0,
                  state: 'fly', t: 0, dead: false, remove: false, hp: 1, baseY: 0, homeTx: 0, variant: '', target: '', extreme: false, stun: 0,
                });
              }
              this.sfx('ember');
            }
          }
          break;
        }
        case 'sunDart': {
          e.vy += 0.14;
          e.x += e.vx; e.y += e.vy;
          const tC = this.tileAtPx(e.x + e.w / 2, e.y + e.h / 2);
          if (SOLID_TILES.has(tC) || e.y > this.level.height * TS + 40) e.remove = true;
          break;
        }
        case 'warpJar': {
          if (e.state === 'shake') {
            e.t++;
            if (e.t > 20) e.state = 'idle';
          }
          break;
        }
        case 'checkpoint': break;
        case 'goal': e.t++; break; // t doubles as the LOCKED-thud cooldown
        case 'gong': break;
        case 'axe': break; // static pickup, waits on the ground
        case 'fireball': {
          e.vy += 0.25;
          const hit = this.moveX(e, e.vx, false);
          const landed = this.moveY(e, e.vy, false, false);
          if (landed === 1) e.vy = -3.5; // bounce
          if (hit !== 0 || e.y > this.level.height * TS + 40) e.remove = true;
          break;
        }
        case 'boss': {
          this.updateBoss(e, spdE);
          break;
        }
        default: break;
      }
    }
    this.ents = this.ents.filter((e) => !e.remove);
  }

  private updateBoss(e: Ent, spd: number): void {
    if (!this.level || !this.player) return;
    const p = this.player;
    e.t--;
    if (e.state === 'fall') {
      e.vy += 0.35; e.y += e.vy;
      // fell into lava?
      if (this.tileAtPx(e.x + e.w / 2, e.y + e.h) === TILE.Lava || e.y > this.level.height * TS) {
        e.remove = true;
        for (let i = 0; i < 16; i++) {
          this.particles.push({
            x: e.x + e.w / 2, y: e.y + e.h - 6, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 6,
            life: 45, maxLife: 45, color: i % 2 ? '#ff5a1f' : '#ffb02e', size: 3, grav: 0.25,
          });
        }
      }
      return;
    }
    if (e.state === 'pause') {
      e.dir = p.x + p.w / 2 < e.x + e.w / 2 ? -1 : 1;
      // gravity: stay grounded, fall if the bridge crumbles away
      e.vy += 0.38;
      if (this.moveY(e, e.vy, false, false) === 1) { e.vy = 0; e.onGround = true; }
      if (e.y > this.level.height * TS + 60 || this.tileAtPx(e.x + e.w / 2, e.y + e.h + 2) === TILE.Lava) {
        this.defeatBoss(e);
        return;
      }
      if (e.t <= 0) {
        const roll = Math.random();
        if (roll < 0.45) {
          e.state = 'spit'; e.t = 34;
        } else if (roll < 0.65) {
          e.state = 'highjump'; e.vy = -11; e.vx = e.dir * 1.0 * Math.max(0.7, spd);
        } else {
          e.state = 'hop'; e.vy = -7.5; e.vx = e.dir * 0.8 * Math.max(0.7, spd);
        }
      }
    } else if (e.state === 'spit') {
      e.vy += 0.38;
      if (this.moveY(e, e.vy, false, false) === 1) { e.vy = 0; e.onGround = true; }
      if (e.y > this.level.height * TS + 60 || this.tileAtPx(e.x + e.w / 2, e.y + e.h + 2) === TILE.Lava) {
        this.defeatBoss(e);
        return;
      }
      if (e.t === 24 || e.t === 14 || (e.t === 4 && Math.random() < 0.5)) {
        this.ents.push({
          kind: 'fireball', x: e.x + e.w / 2 + e.dir * 20, y: e.y + 30, w: 9, h: 9,
          vx: e.dir * (1.6 + Math.random() * 0.9) * (e.extreme ? 1.4 : 1), vy: -4.5 - Math.random() * 1.5,
          onGround: false, dir: e.dir, frame: 0, state: 'fly', t: 0, dead: false, remove: false,
          hp: 1, baseY: 0, homeTx: 0, variant: '', target: '', extreme: false, stun: 0,
        });
      }
      if (e.t <= 0) { e.state = 'pause'; e.t = 50 + Math.floor(Math.random() * 40); }
    } else { // hop / highjump airborne
      e.vy += 0.28; // floatier boss gravity — big slow arcs you can run under or jump over
      this.moveX(e, e.vx, false);
      if (this.moveY(e, e.vy, false, false) === 1) {
        e.vy = 0; e.onGround = true;
        e.state = 'pause'; e.t = 45 + Math.floor(Math.random() * 45);
        // landing thud
        for (let i = 0; i < 8; i++) {
          this.particles.push({
            x: e.x + Math.random() * e.w, y: e.y + e.h, vx: (Math.random() - 0.5) * 3, vy: -Math.random(),
            life: 20, maxLife: 20, color: '#9aa79a', size: 2, grav: 0.2,
          });
        }
      } else e.onGround = false;
      if (e.y > this.level.height * TS + 60) {
        // fell in a pit on its own — counts as defeat
        this.defeatBoss(e);
      }
    }
  }

  private flashBoss(boss: Ent): void {
    for (let i = 0; i < 12; i++) {
      this.particles.push({
        x: boss.x + Math.random() * boss.w, y: boss.y + Math.random() * boss.h,
        vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3,
        life: 25, maxLife: 25, color: '#ffe07a', size: 2.5, grav: 0.1,
      });
    }
  }

  private defeatBoss(boss: Ent): void {
    if (this.bossDefeated) return;
    this.bossDefeated = true;
    this.sfx('bossRoar');
    boss.state = 'fall';
    boss.vy = -3;
    // collapse all bridge tiles
    if (this.level) {
      for (let y = 0; y < this.level.height; y++) {
        for (let x = 0; x < this.level.width; x++) {
          if (this.level.tiles[y][x] === TILE.Bridge) {
            this.level.tiles[y][x] = TILE.Empty;
            for (let i = 0; i < 4; i++) {
              this.particles.push({
                x: x * TS + 8, y: y * TS + 4, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2,
                life: 50, maxLife: 50, color: '#a5722e', size: 2.5, grav: 0.3,
              });
            }
          }
        }
      }
    }
    this.phase = 'bossfall';
    this.phaseTimer = 0;
  }

  private overlap(a: Body, b: Body): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  /** Sound hook (controller wires this to the AudioEngine; no-op in tests). */
  private sfx(name: string): void {
    this.onSfx(name);
  }

  /** Kill score with the EXTREME 3x bonus. */
  private killScore(e: Ent, base: number): void {
    this.addScore(base * (e.extreme ? 3 : 1));
  }

  /** Floating combat text (LOCKED / CRACK! / key names). */
  private addText(x: number, y: number, text: string, color: string): void {
    this.texts.push({ x, y, t: 0, text, color });
  }

  /**
   * EXTREME armor soak: first stomp on a 2-HP extreme enemy cracks it (stun)
   * instead of defeating it. Returns true when the stomp was absorbed.
   */
  private extremeSoak(e: Ent, p: Player, bounceMul: number): boolean {
    if (!e.extreme || e.hp <= 1) return false;
    e.hp--;
    e.stun = 50;
    p.vy = -6.5 * bounceMul;
    p.onGround = false;
    this.sfx('stomp');
    this.addText(e.x + e.w / 2, e.y - 8, 'CRACK!', '#ffd94a');
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: e.x + e.w / 2, y: e.y + 4, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3,
        life: 25, maxLife: 25, color: i % 2 ? '#ff5a3a' : '#f2b632', size: 2, grav: 0.15,
      });
    }
    return true;
  }

  private killEnemyFlip(e: Ent): void {
    if (this.glitches.enemyConfetti) {
      e.remove = true;
      for (let i = 0; i < 14; i++) {
        this.particles.push({
          x: e.x + e.w / 2, y: e.y + e.h / 2,
          vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 5,
          life: 40, maxLife: 40,
          color: ['#e05fd0', '#ffe07a', '#6fd66f', '#7fd8ef'][Math.floor(Math.random() * 4)],
          size: 2.5, grav: 0.2,
        });
      }
    } else {
      e.dead = true;
      e.vy = -5;
      e.vx = (Math.random() - 0.5) * 1.5;
    }
  }

  // ================= player interactions =================

  private playerVsEnts(bounceMul: number): void {
    if (!this.level || !this.player || !this.session) return;
    const p = this.player;
    const g = this.glitches;

    for (const e of this.ents) {
      if (e.dead || e.remove) continue;
      if (!this.overlap(p, e)) continue;
      const stomp = (p.vy > 0 && p.y + p.h - e.y < e.h * 0.55) || p.pound;

      // jaguar pelt / rainbow orchid: contact defeats enemies outright
      if ((p.timers.jaguar > 0 || p.timers.orchid > 0) && INSTANT_KILLABLE.has(e.kind)) {
        this.killEnemyFlip(e);
        this.killScore(e, 200);
        continue;
      }

      switch (e.kind) {
        case 'coin':
          e.remove = true;
          this.addCoin(e.x + 6, e.y);
          break;
        case 'bloom': case 'emberChili': case 'frogSuit': case 'kapokAnvil':
        case 'macawWings': case 'jaguarPelt': case 'rainbowOrchid':
        case 'grasshopperLegs': case 'shrinkberry': case 'coinCapuchin':
        case 'goldenBanana': case 'thunderMango': case 'staticStarfruit':
          if (e.state !== 'emerge') {
            e.remove = true;
            this.applyPowerup(e.kind);
          }
          break;
        case 'keyJade': case 'keyGold': case 'keyObsidian': {
          // colored key -> session inventory (persist across levels/warps; never consumed)
          const color: KeyColor = e.kind === 'keyJade' ? 'jade' : e.kind === 'keyGold' ? 'gold' : 'obsidian';
          e.remove = true;
          this.session.keys ??= [];
          if (!this.session.keys.includes(color)) this.session.keys.push(color);
          this.addScore(1000);
          this.sfx('key');
          this.addText(e.x + 6, e.y - 8, KEY_INFO[color].label.toUpperCase(), KEY_INFO[color].color);
          for (let i = 0; i < 10; i++) {
            this.particles.push({
              x: e.x + 6, y: e.y + 6, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 4,
              life: 30, maxLife: 30, color: KEY_INFO[color].color, size: 2, grav: 0.08,
            });
          }
          this.onStats();
          break;
        }
        case 'warpJar': break; // walked over — DOWN to warp
        case 'swimfish': {
          // stompable only from above water; underwater contact always hurts
          if (stomp && !p.swimming) {
            if (!this.extremeSoak(e, p, bounceMul)) {
              this.killEnemyFlip(e);
              this.killScore(e, 200);
              this.sfx('stomp');
              p.vy = -6.5 * bounceMul;
              p.onGround = false;
            }
          } else this.hurtPlayer(false);
          break;
        }
        case 'checkpoint':
          if (e.state === 'off') {
            e.state = 'on';
            this.checkpoint = { x: Math.floor(e.x / TS), y: Math.floor((e.y + e.h) / TS) - 2 };
            this.addScore(500);
            this.sfx('checkpoint');
          }
          break;
        case 'goal': {
          // locked goal: needs the matching key in the session inventory
          const lock = e.variant as '' | KeyColor;
          if (lock) {
            if (!(this.session.keys ?? []).includes(lock)) {
              if (e.t > 30) { // thud cooldown
                e.t = 0;
                this.shakeT = Math.max(this.shakeT, 6);
                this.sfx('locked');
                this.addText(e.x + e.w / 2, e.y - 6, 'LOCKED', '#ff8a8a');
              }
              break;
            }
            // seal breaks (the key stays in the inventory — not consumed)
            e.variant = '';
            this.sfx('fanfare');
            for (let i = 0; i < 14; i++) {
              this.particles.push({
                x: e.x + e.w / 2, y: e.y + 22, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 5,
                life: 35, maxLife: 35, color: KEY_INFO[lock].color, size: 2.5, grav: 0.12,
              });
            }
          }
          this.addScore(1000);
          this.phase = 'complete';
          this.phaseTimer = 0;
          p.vx = 0;
          this.sfx('goal');
          break;
        }
        case 'gong': {
          const boss = this.ents.find((o) => o.kind === 'boss' && !o.dead && !o.remove);
          this.addScore(2000);
          if (boss) this.defeatBoss(boss);
          else if (this.phase === 'play') { this.phase = 'complete'; this.phaseTimer = 0; this.sfx('goal'); }
          break;
        }
        case 'axe': {
          // grabbing the Jade Axe fells the Cursed Idol — you win!
          const boss = this.ents.find((o) => o.kind === 'boss' && !o.dead && !o.remove);
          this.addScore(2000);
          e.remove = true;
          this.sfx('fanfare');
          for (let i = 0; i < 14; i++) {
            this.particles.push({
              x: e.x + e.w / 2, y: e.y + 8, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 5,
              life: 40, maxLife: 40, color: '#ffd94a', size: 3, grav: 0.25,
            });
          }
          if (boss) this.defeatBoss(boss);
          else if (this.phase === 'play') { this.phase = 'complete'; this.phaseTimer = 0; this.sfx('goal'); }
          break;
        }
        case 'jaguarWarrior': {
          if (stomp) {
            if (!this.extremeSoak(e, p, bounceMul)) {
              this.killEnemyFlip(e);
              this.killScore(e, 400);
              this.sfx('stomp');
              p.vy = -6.5 * bounceMul;
              p.onGround = false;
            }
          } else this.hurtPlayer(false);
          break;
        }
        case 'serpent': {
          if (stomp) {
            if (!this.extremeSoak(e, p, bounceMul)) {
              this.killEnemyFlip(e);
              this.killScore(e, 300);
              this.sfx('stomp');
              p.vy = -7 * bounceMul;
              p.onGround = false;
            }
          } else this.hurtPlayer(false);
          break;
        }
        case 'sentinel': {
          // low & wide — stomp from above defeats it, side contact hurts
          if (stomp) {
            if (!this.extremeSoak(e, p, bounceMul)) {
              this.killEnemyFlip(e);
              this.killScore(e, 300);
              this.sfx('stomp');
              p.vy = -6.5 * bounceMul;
              p.onGround = false;
            }
          } else this.hurtPlayer(false);
          break;
        }
        case 'beetle':
        case 'monkey': {
          if (stomp) {
            if (!this.extremeSoak(e, p, bounceMul)) {
              this.killEnemyFlip(e);
              this.killScore(e, e.kind === 'monkey' ? 400 : 100);
              this.sfx('stomp');
              p.vy = -6.5 * bounceMul;
              p.onGround = false;
            }
          } else this.hurtPlayer(false);
          break;
        }
        case 'eagle': {
          if (stomp) {
            if (!this.extremeSoak(e, p, bounceMul)) {
              this.killEnemyFlip(e);
              this.killScore(e, 400);
              this.sfx('stomp');
              p.vy = -7 * bounceMul;
            }
          } else this.hurtPlayer(false);
          break;
        }
        case 'durian':
        case 'durianDrop':
        case 'flytrap':
        case 'piranha':
        case 'coconut':
        case 'fireball':
        case 'sunDart': {
          // not stompable — contact hurts (even a stomp attempt)
          this.hurtPlayer(false);
          break;
        }
        case 'tortoise':
        case 'armadillo': {
          if (stomp) {
            if (!this.extremeSoak(e, p, bounceMul)) {
              // retreat into shell
              this.shellify(e);
              this.killScore(e, 200);
              this.sfx('stomp');
              p.vy = -6.5 * bounceMul;
              p.onGround = false;
            }
          } else this.hurtPlayer(false);
          break;
        }
        case 'shell': {
          if (e.state === 'slide') {
            if (stomp) {
              if (g.springyShells) {
                p.vy = -7 * bounceMul; // bounces you, shell keeps going
              } else {
                e.state = 'still'; e.vx = 0;
                p.vy = -6.5 * bounceMul;
              }
              p.onGround = false;
              this.sfx('stomp');
            } else this.hurtPlayer(false);
          } else {
            // kick it (EXTREME shells slide 1.5x)
            const kickDir = p.x + p.w / 2 < e.x + e.w / 2 ? 1 : -1;
            e.state = 'slide';
            e.vx = kickDir * (e.variant === 'armadillo' ? 7.5 : 5.5) * (e.extreme ? 1.5 : 1);
            this.addScore(100);
            this.sfx('kick');
            if (stomp) { p.vy = -5; p.onGround = false; }
          }
          break;
        }
        case 'boss': {
          // cannot be stomped — contact hurts
          this.hurtPlayer(false);
          break;
        }
        default: break;
      }
      if (p.dead) break;
    }
  }

  private hurtPlayer(forceKill: boolean): void {
    const p = this.player;
    if (!p || p.dead || this.phase !== 'play') return;
    if (this.glitches.invincible) return;
    if (p.timers.orchid > 0 && !forceKill) return; // rainbow orchid invincibility
    if (p.invuln > 0 && !forceKill) return;
    if (!forceKill) {
      this.sfx('hurt');
      // damage flow: FORM -> big (Spirit Bloom) -> small -> death
      if (p.form !== 'none') {
        p.form = 'none';
        p.pound = false;
        p.big = true;
        p.invuln = 130;
        return;
      }
      if (p.big && !this.glitches.tinyPlayer) {
        p.big = false;
        p.invuln = 130;
        p.h = 14; p.w = 12;
        p.y += 14;
        return;
      }
    }
    p.dead = true;
    p.vy = -9;
    this.sfx('death');
    this.phase = 'dying';
    this.phaseTimer = 0;
  }

  // ================= particles =================

  private updateParticles(): void {
    for (const pt of this.particles) {
      pt.vy += pt.grav;
      pt.x += pt.vx; pt.y += pt.vy;
      pt.life--;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const t of this.texts) { t.t++; t.y -= 0.45; }
    this.texts = this.texts.filter((t) => t.t < 50);
  }

  // ================= rendering =================

  render(): void {
    const c = this.ctx;
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, VIEW_W, VIEW_H);
    c.save();
    if (this.shakeT > 0) {
      const m = this.shakeT * 0.3;
      c.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }

    if (!this.level) {
      c.fillStyle = '#0d2818';
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      return;
    }

    // parallax background
    const factors = [0.12, 0.3, 0.55];
    for (let l = 0; l < 3; l++) {
      const bg = this.tex.bg(this.level.theme, l);
      const f = factors[l];
      const offX = -((this.camX * f) % 512);
      const offY = l === 0 ? 0 : Math.max(-40, Math.min(0, -(this.camY * f * 0.4)));
      c.drawImage(bg, offX, offY);
      c.drawImage(bg, offX + 512, offY);
    }

    const camX = Math.floor(this.camX), camY = Math.floor(this.camY);
    const tx0 = Math.max(0, Math.floor(camX / TS)), tx1 = Math.min(this.level.width - 1, Math.ceil((camX + VIEW_W) / TS));
    const ty0 = Math.max(0, Math.floor(camY / TS)), ty1 = Math.min(this.level.height - 1, Math.ceil((camY + VIEW_H) / TS));

    // tiles
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = this.level.tiles[ty][tx];
        if (t === TILE.Empty) continue;
        let name = '';
        switch (t) {
          case TILE.Ground: name = 'ground'; break;
          case TILE.Dirt: name = 'dirt'; break;
          case TILE.Brick: name = 'brick'; break;
          case TILE.Question: name = `question:${Math.floor(this.tick / 18) % 3}`; break;
          case TILE.QuestionUsed: name = 'questionUsed'; break;
          case TILE.Stone: name = 'stone'; break;
          case TILE.LogTop: name = 'logTop'; break;
          case TILE.LogBody: name = 'logBody'; break;
          case TILE.Vine: name = 'vine'; break;
          case TILE.Wood: name = 'wood'; break;
          case TILE.Cloud: name = 'cloud'; break;
          case TILE.Lava: name = `lava:${Math.floor(this.tick / 24) % 2}`; break;
          case TILE.Water: name = `water:${Math.floor(this.tick / 24) % 2}`; break;
          case TILE.Spikes: name = 'spikes'; break;
          case TILE.Bridge: name = 'bridge'; break;
          case TILE.Leaves: name = 'leaves'; break;
          case TILE.Foliage: name = `foliage:${(tx + ty) % 2}`; break;
          case TILE.Temple: name = 'temple'; break;
          case TILE.GongTile: name = 'gongStand'; break;
          case TILE.SwimWater: name = `swimWater:${Math.floor(this.tick / 24) % 2}`; break;
          case TILE.Sand: name = 'sand'; break;
          default: break;
        }
        if (!name) continue;
        let dy = ty * TS - camY;
        const bump = this.bumpAnims.find((b) => b.tx === tx && b.ty === ty);
        if (bump) dy -= Math.sin((bump.t / 12) * Math.PI) * 5;
        c.drawImage(this.tex.get(name), tx * TS - camX, dy);
      }
    }

    // entities
    for (const e of this.ents) {
      if (e.remove) continue;
      const sx = e.x - camX, sy = e.y - camY;
      if (sx < -80 || sx > VIEW_W + 80) continue;
      this.drawEnt(c, e, sx, sy);
    }

    // player
    if (this.player && !(this.player.invuln > 0 && Math.floor(this.tick / 3) % 2 === 0 && !this.player.dead)) {
      this.drawPlayer(c, this.player, camX, camY);
    }

    // particles
    for (const pt of this.particles) {
      c.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      c.fillStyle = pt.color;
      c.fillRect(pt.x - camX - pt.size / 2, pt.y - camY - pt.size / 2, pt.size, pt.size);
    }
    c.globalAlpha = 1;

    // floating combat texts (LOCKED / CRACK! / key labels)
    c.font = '7px monospace';
    c.textAlign = 'center';
    for (const t of this.texts) {
      c.globalAlpha = Math.max(0, 1 - t.t / 50);
      c.fillStyle = t.color;
      c.fillText(t.text, t.x - camX, t.y - camY);
    }
    c.globalAlpha = 1;
    c.textAlign = 'left';

    // editor overlay
    if (this.editorMode) this.renderEditorOverlay(c, camX, camY);
    c.restore();

    // thunder-mango / golden-banana screen flash
    if (this.flashT > 0) {
      c.fillStyle = `rgba(255,255,235,${Math.min(0.85, this.flashT / 18)})`;
      c.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    // Static Starfruit glitch post-processing (ramps in over ~30f, out at the end)
    if (this.glitchFx && !this.editorMode) {
      const fx = this.glitchFx;
      const k = Math.min(1, fx.elapsed / 30) * (fx.t < 30 ? Math.max(0, fx.t / 30) : 1);
      this.sliceTick++;
      const cv = this.canvas;
      // hue/saturation jitter (where canvas filters are supported)
      if ('filter' in c) {
        try {
          c.filter = `hue-rotate(${Math.round(Math.sin(this.sliceTick * 0.35) * 18 * k)}deg) saturate(${(1 + 0.3 * k).toFixed(2)})`;
          c.drawImage(cv, 0, 0);
          c.filter = 'none';
        } catch { /* filter unsupported — slices/washes still sell the effect */ }
      }
      // screen-tear: re-roll strip offsets every few frames, self-copy shifted strips
      const n = this.sliceShift.length;
      if (this.sliceTick % 7 === 0) {
        for (let i = 0; i < n; i++) {
          this.sliceShift[i] = Math.random() < 0.3 ? Math.round((Math.random() * 2 - 1) * 6 * k) : 0;
        }
      }
      const stripH = Math.ceil(VIEW_H / n);
      for (let i = 0; i < n; i++) {
        const off = this.sliceShift[i];
        if (off !== 0) c.drawImage(cv, 0, i * stripH, VIEW_W, stripH, off, i * stripH, VIEW_W, stripH);
      }
      // color washes
      c.fillStyle = `rgba(255,0,90,${(0.035 * k).toFixed(3)})`;
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      c.fillStyle = `rgba(0,240,200,${(0.02 * k).toFixed(3)})`;
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      // occasional scanlines
      if (Math.random() < 0.45 * k) {
        c.fillStyle = 'rgba(0,0,0,0.12)';
        const y0 = Math.floor(Math.random() * 4);
        for (let y = y0; y < VIEW_H; y += 4) c.fillRect(0, y, VIEW_W, 1);
      }
    }
  }

  private drawEnt(c: CanvasRenderingContext2D, e: Ent, sx: number, sy: number): void {
    const T2 = this.tex;
    const flip = e.dir === 1;
    const draw = (name: string, x: number, y: number, w?: number, h?: number) => {
      const img = T2.get(name);
      c.save();
      if (flip) {
        c.translate(x + (w ?? img.width), y);
        c.scale(-1, 1);
        c.drawImage(img, 0, 0, w ?? img.width, h ?? img.height);
      } else {
        c.drawImage(img, x, y, w ?? img.width, h ?? img.height);
      }
      c.restore();
    };
    const anim2 = Math.floor(e.frame / 12) % 2;

    // EXTREME aura (hitbox glow)
    if (e.extreme && !e.dead) {
      c.fillStyle = 'rgba(255,80,40,0.15)';
      c.fillRect(sx - 2, sy - 2, e.w + 4, e.h + 4);
    }

    switch (e.kind) {
      case 'beetle': draw(`beetle:${anim2}`, sx - 2, sy - 3); break;
      case 'tortoise': draw(`tortoise${e.variant === 'red' ? 'Red' : 'Green'}:${anim2}`, sx - 1, sy - 2); break;
      case 'armadillo': draw(`armadillo:${anim2}`, sx - 1, sy - 3); break;
      case 'shell': draw(`shell:${e.variant ?? 'green'}`, sx - 1, sy - 3); break;
      case 'durian': case 'durianDrop': draw('durian', sx - 1, sy - 2); break;
      case 'flytrap': {
        if (e.state !== 'hidden') draw(`flytrap:${Math.floor(e.frame / 16) % 2}`, sx - 2, sy - 4);
        break;
      }
      case 'monkey': draw(`monkey:${e.state === 'spit' ? 1 : Math.floor(e.frame / 20) % 2}`, sx - 1, sy - 2); break;
      case 'coconut': draw('coconut', sx, sy); break;
      case 'eagle': draw(`eagle:${Math.floor(e.frame / 10) % 2}`, sx, sy); break;
      case 'piranha': if (e.state === 'leap') draw(`piranha:${anim2}`, sx - 1, sy - 1); break;
      case 'bloom': draw(`bloom:${Math.floor(e.frame / 20) % 2}`, sx - 2, sy - 2); break;
      case 'emberChili': draw(`emberChili:${Math.floor(e.frame / 20) % 2}`, sx - 2, sy - 2 + this.itemBob(e)); break;
      case 'frogSuit': draw('frogSuit', sx - 2, sy - 2 + this.itemBob(e)); break;
      case 'kapokAnvil': draw('kapokAnvil', sx - 2, sy - 2 + this.itemBob(e)); break;
      case 'macawWings': draw(`macawWings:${Math.floor(e.frame / 8) % 2}`, sx - 2, sy - 2 + this.itemBob(e)); break;
      case 'jaguarPelt': draw('jaguarPelt', sx - 2, sy - 2 + this.itemBob(e)); break;
      case 'rainbowOrchid': draw(`rainbowOrchid:${Math.floor(e.frame / 5) % 6}`, sx - 2, sy - 2 + this.itemBob(e)); break;
      case 'grasshopperLegs': draw(`grasshopperLegs:${anim2}`, sx - 2, sy - 2 + this.itemBob(e)); break;
      case 'shrinkberry': draw(`shrinkberry:${Math.floor(e.frame / 20) % 2}`, sx - 2, sy - 2 + this.itemBob(e)); break;
      case 'coinCapuchin': draw('coinCapuchin', sx - 2, sy - 2 + this.itemBob(e)); break;
      case 'goldenBanana': draw(`goldenBanana:${Math.floor(e.frame / 16) % 2}`, sx - 2, sy - 2 + this.itemBob(e)); break;
      case 'thunderMango': draw(`thunderMango:${Math.floor(e.frame / 8) % 2}`, sx - 2, sy - 2 + this.itemBob(e)); break;
      case 'staticStarfruit': {
        // magenta/cyan channel-split jitter
        const jf = Math.floor(e.frame / 6) % 2;
        draw(`staticStarfruit:${jf}`, sx - 2, sy - 2 + this.itemBob(e));
        break;
      }
      case 'keyJade': case 'keyGold': case 'keyObsidian': draw(e.kind, sx - 2, sy - 2 + this.itemBob(e)); break;
      case 'jaguarWarrior': draw(`jaguarWarrior:${e.state === 'crouch' ? 1 : anim2}`, sx - 1, sy - 2); break;
      case 'serpent': draw(`serpent:${Math.floor(e.frame / 10) % 2}`, sx, sy); break;
      case 'sentinel': draw(`sentinel:${e.t > (e.extreme ? 80 : 120) ? 1 : 0}`, sx, sy); break;
      case 'sunDart': draw(`sunDart:${Math.floor(e.frame / 6) % 2}`, sx, sy); break;
      case 'swimfish': draw(`swimfish:${anim2}`, sx - 1, sy - 1); break;
      case 'warpJar': {
        const jx = e.state === 'shake' ? Math.round(Math.sin(e.t * 0.9) * 2) : 0;
        draw('warpJar', sx + jx, sy);
        break;
      }
      case 'ember': draw(`emberSeed:${Math.floor(e.frame / 4) % 2}`, sx, sy); break;
      case 'coin': draw(`coin:${Math.floor(e.frame / 8) % 4}`, sx - 2, sy - 2); break;
      case 'checkpoint': draw(`checkpoint:${e.state === 'on' ? 1 : 0}`, sx - 1, sy - 2); break;
      case 'goal': draw('goal', sx, sy); if (e.variant) draw(`lock:${e.variant}`, sx + 8, sy + 18); break;
      case 'gong': draw(`gong:${Math.floor(this.tick / 30) % 2}`, sx, sy); break;
      case 'axe': draw(`axe:${Math.floor(this.tick / 24) % 2}`, sx, sy); break;
      case 'fireball': draw(`fireball:${Math.floor(e.frame / 6) % 2}`, sx, sy); break;
      case 'boss': draw(`boss:${Math.floor(this.tick / 24) % 2}`, sx, sy); break;
      default: break;
    }

    // EXTREME crown marker
    if (e.extreme && !e.dead) c.drawImage(T2.get('extremeCrown'), sx + e.w / 2 - 6, sy - 8);
  }

  /** Gentle bob offset for placed/floating powerup items. */
  private itemBob(e: Ent): number {
    if (!POWERUP_KINDS.has(e.kind) && !KEY_KINDS.has(e.kind)) return 0;
    if (e.state === 'still' || e.state === 'drift') return Math.sin(e.frame * 0.06) * 2;
    return 0;
  }

  private drawPlayer(c: CanvasRenderingContext2D, p: Player, camX: number, camY: number): void {
    const g = this.glitches;
    let scale = g.tinyPlayer ? 0.6 : g.giantPlayer ? 1.7 : 1;
    if (p.timers.shrink > 0) scale *= 0.5;
    if (this.phase === 'warp' && this.warpAnim) scale *= Math.max(0.15, 1 - (this.warpAnim.t / 40) * 0.85);
    let frame: 'idle' | 'run1' | 'run2' | 'jump' = 'idle';
    if (p.dead) frame = 'jump';
    else if (!p.onGround) frame = 'jump';
    else if (Math.abs(p.vx) > 0.3) frame = Math.floor(p.anim / 7) % 2 === 0 ? 'run1' : 'run2';
    const spriteKey = p.form === 'ember' ? 'playerEmber' : p.form === 'frog' ? 'playerFrog' : p.form === 'anvil' ? 'playerAnvil'
      : `player${p.big ? 'Big' : 'Small'}`;
    const img = this.tex.get(`${spriteKey}:${frame}`);
    const dw = img.width * scale, dh = img.height * scale;

    const dx = p.x - camX + p.w / 2 - dw / 2;
    const dy = p.y - camY + p.h - dh;

    // swim tilt / warp shrink wrappers (restored at the end of drawPlayer)
    const swimTilt = p.swimming && !p.dead && this.phase === 'play'
      ? (p.facing === 1 ? 0.22 : -0.22) + Math.sin(this.tick * 0.15) * 0.06
      : 0;
    if (swimTilt !== 0) {
      c.save();
      c.translate(p.x - camX + p.w / 2, p.y - camY + p.h / 2);
      c.rotate(swimTilt);
      c.translate(-(p.x - camX + p.w / 2), -(p.y - camY + p.h / 2));
    }

    // macaw wings behind the player
    if (p.timers.wings > 0 && !p.dead) {
      const flap = p.vy < -0.5 ? 0 : 1;
      const wing = this.tex.get(`wingsOverlay:${flap}`);
      const wx = p.facing === 1 ? dx + dw - 4 : dx - wing.width * scale + 4;
      c.save();
      if (p.facing === -1) {
        c.translate(dx - 4, dy - 2);
        c.drawImage(wing, 0, 0, wing.width * scale, wing.height * scale);
      } else {
        c.drawImage(wing, wx, dy - 2, wing.width * scale, wing.height * scale);
      }
      c.restore();
    }
    c.save();
    if (p.facing === -1 && !p.dead) {
      c.translate(dx + dw, dy);
      c.scale(-1, 1);
      c.drawImage(img, 0, 0, dw, dh);
      c.restore();
      c.save();
    } else {
      c.drawImage(img, dx, dy, dw, dh);
    }
    // big head mode: redraw the head region enlarged
    if (g.bigHead && !p.dead) {
      const headH = Math.floor(img.height * 0.4);
      const hw = dw * 1.9, hh = dh * 0.4 * 1.9;
      const hx = p.x - camX + p.w / 2 - hw / 2;
      const hy = dy - hh * 0.55;
      if (p.facing === -1) {
        c.translate(hx + hw, hy);
        c.scale(-1, 1);
        c.drawImage(img, 0, 0, img.width, headH, 0, 0, hw, hh);
      } else {
        c.drawImage(img, 0, 0, img.width, headH, hx, hy, hw, hh);
      }
    }
    // timed-effect tints + buddies, drawn over the player
    if (!p.dead) {
      if (p.timers.jaguar > 0) {
        c.fillStyle = 'rgba(232,168,58,0.25)';
        c.fillRect(dx, dy, dw, dh);
        c.fillStyle = 'rgba(122,74,22,0.5)';
        c.fillRect(dx + dw * 0.25, dy + dh * 0.3, 2, 2);
        c.fillRect(dx + dw * 0.6, dy + dh * 0.5, 2, 2);
        c.fillRect(dx + dw * 0.4, dy + dh * 0.7, 2, 2);
      }
      if (p.timers.orchid > 0) {
        c.fillStyle = `hsla(${(this.tick * 13) % 360},95%,62%,0.3)`;
        c.fillRect(dx, dy, dw, dh);
      }
      if (p.timers.capuchin > 0) {
        const buddy = this.tex.get('capuchinBuddy');
        const bw = buddy.width * scale, bh = buddy.height * scale;
        const bx = p.facing === 1 ? dx - bw * 0.4 : dx + dw - bw * 0.6;
        c.drawImage(buddy, bx, dy - bh * 0.35 + Math.sin(p.anim * 0.1) * 1.5, bw, bh);
      }
    }
    c.restore();
    if (swimTilt !== 0) c.restore();
  }

  /** FX state for the HUD: current form + active timed effects + starfruit chaos. */
  getFx(): { form: string; timers: { key: string; label: string; seconds: number; frac: number }[]; static: { seconds: number; kind: 'surge' | 'scramble' } | null } {
    const p = this.player;
    if (!p) return { form: 'none', timers: [], static: null };
    const out: { key: string; label: string; seconds: number; frac: number }[] = [];
    for (const key of Object.keys(p.timers) as TimedKey[]) {
      const t = p.timers[key];
      if (t > 0) {
        out.push({ key, label: TIMED_EFFECTS[key].label, seconds: Math.ceil(t / 60), frac: t / TIMED_EFFECTS[key].duration });
      }
    }
    const fx = this.glitchFx;
    return {
      form: p.form,
      timers: out,
      static: fx ? { seconds: Math.ceil(fx.t / 60), kind: fx.kind } : null,
    };
  }

  /** Item-kind -> texture name for HUD icons and editor previews. */
  static itemIcon(kind: string): string {
    const map: Record<string, string> = {
      bloom: 'bloom:0', emberChili: 'emberChili:0', frogSuit: 'frogSuit', kapokAnvil: 'kapokAnvil',
      macawWings: 'macawWings:0', jaguarPelt: 'jaguarPelt', rainbowOrchid: 'rainbowOrchid:0',
      grasshopperLegs: 'grasshopperLegs:0', shrinkberry: 'shrinkberry:0', coinCapuchin: 'coinCapuchin',
      goldenBanana: 'goldenBanana:0', thunderMango: 'thunderMango:0', staticStarfruit: 'staticStarfruit:0',
      // form icons for the HUD form slot
      ember: 'emberChili:0', frog: 'frogSuit', anvil: 'kapokAnvil',
      // timed-effect icons
      wings: 'macawWings:0', jaguar: 'jaguarPelt', orchid: 'rainbowOrchid:0',
      legs: 'grasshopperLegs:0', shrink: 'shrinkberry:0', capuchin: 'coinCapuchin',
      // temple keys
      keyJade: 'keyJade', keyGold: 'keyGold', keyObsidian: 'keyObsidian',
    };
    return map[kind] ?? 'bloom:0';
  }

  private renderEditorOverlay(c: CanvasRenderingContext2D, camX: number, camY: number): void {
    // grid
    c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.lineWidth = 0.5;
    const x0 = Math.floor(camX / TS) * TS, y0 = Math.floor(camY / TS) * TS;
    c.beginPath();
    for (let x = x0; x <= camX + VIEW_W; x += TS) { c.moveTo(x - camX, 0); c.lineTo(x - camX, VIEW_H); }
    for (let y = y0; y <= camY + VIEW_H; y += TS) { c.moveTo(0, y - camY); c.lineTo(VIEW_W, y - camY); }
    c.stroke();

    // entity markers are already drawn by drawEnt (level entities spawned)

    // ghost preview
    if (this.editorHover) {
      const { x, y } = this.editorHover;
      const sx = x * TS - camX, sy = y * TS - camY;
      c.globalAlpha = 0.55;
      if (this.editorSel.kind === 'tile') {
        const names: Record<number, string> = {
          [TILE.Ground]: 'ground', [TILE.Dirt]: 'dirt', [TILE.Brick]: 'brick', [TILE.Question]: 'question:0',
          [TILE.QuestionUsed]: 'questionUsed', [TILE.Stone]: 'stone', [TILE.LogTop]: 'logTop', [TILE.LogBody]: 'logBody',
          [TILE.Vine]: 'vine', [TILE.Wood]: 'wood', [TILE.Cloud]: 'cloud', [TILE.Lava]: 'lava:0', [TILE.Water]: 'water:0',
          [TILE.Spikes]: 'spikes', [TILE.Bridge]: 'bridge', [TILE.Leaves]: 'leaves', [TILE.Foliage]: 'foliage:0',
          [TILE.Temple]: 'temple', [TILE.GongTile]: 'gongStand',
          [TILE.SwimWater]: 'swimWater:0', [TILE.Sand]: 'sand',
        };
        const n = names[this.editorSel.tile];
        if (n) c.drawImage(this.tex.get(n), sx, sy);
      } else if (this.editorSel.kind === 'entity') {
        const sprite = this.editorSprite(this.editorSel.entity);
        if (sprite) c.drawImage(this.tex.get(sprite), sx, sy - TS);
      } else {
        c.fillStyle = 'rgba(255,80,80,0.5)';
        c.fillRect(sx, sy, TS, TS);
      }
      c.globalAlpha = 1;
      c.strokeStyle = '#ffe07a';
      c.lineWidth = 1;
      c.strokeRect(sx + 0.5, sy + 0.5, TS - 1, TS - 1);
    }
  }

  editorSprite(entity: string): string | null {
    const map: Record<string, string> = {
      beetle: 'beetle:0', tortoiseGreen: 'tortoiseGreen:0', tortoiseRed: 'tortoiseRed:0',
      flytrap: 'flytrap:0', monkey: 'monkey:0', eagle: 'eagle:0', durian: 'durian',
      armadillo: 'armadillo:0', piranha: 'piranha:0', bloom: 'bloom:0', coin: 'coin:0',
      checkpoint: 'checkpoint:0', goal: 'goal', gong: 'gong:0', axe: 'axe:0', boss: 'boss:0',
      playerStart: 'playerSmall:idle',
      emberChili: 'emberChili:0', frogSuit: 'frogSuit', kapokAnvil: 'kapokAnvil',
      macawWings: 'macawWings:0', jaguarPelt: 'jaguarPelt', rainbowOrchid: 'rainbowOrchid:0',
      grasshopperLegs: 'grasshopperLegs:0', shrinkberry: 'shrinkberry:0', coinCapuchin: 'coinCapuchin',
      goldenBanana: 'goldenBanana:0', thunderMango: 'thunderMango:0',
      swimfish: 'swimfish:0', staticStarfruit: 'staticStarfruit:0', warpJar: 'warpJar',
      keyJade: 'keyJade', keyGold: 'keyGold', keyObsidian: 'keyObsidian',
      jaguarWarrior: 'jaguarWarrior:0', serpent: 'serpent:0', sentinel: 'sentinel:0',
    };
    return map[entity] ?? null;
  }

  editorPlace(tx: number, ty: number): void {
    if (!this.level || tx < 0 || ty < 0 || tx >= this.level.width || ty >= this.level.height) return;
    if (this.editorSel.kind === 'tile') {
      this.level.tiles[ty][tx] = this.editorSel.tile;
    } else if (this.editorSel.kind === 'entity') {
      const type = this.editorSel.entity;
      if (type === 'playerStart') {
        this.level.entities = this.level.entities.filter((e) => e.type !== 'playerStart');
        this.level.entities.push({ type: 'playerStart', x: tx, y: ty });
      } else {
        // avoid stacking the same entity on one tile
        if (!this.level.entities.some((e) => e.type === type && e.x === tx && e.y === ty)) {
          const spawn: EntitySpawn = { type: type as EntitySpawn['type'], x: tx, y: ty };
          if (type === 'warpJar' && this.editorWarpTarget) spawn.target = this.editorWarpTarget;
          if (type === 'goal' && this.editorGoalLock) spawn.lockColor = this.editorGoalLock;
          if (this.editorExtreme && ENEMY_BRUSHES.has(type)) spawn.extreme = true;
          this.level.entities.push(spawn);
        }
      }
    } else {
      this.editorErase(tx, ty);
      return;
    }
    this.editorDirty = true;
    this.refreshEditorEnts();
  }

  editorErase(tx: number, ty: number): void {
    if (!this.level || tx < 0 || ty < 0 || tx >= this.level.width || ty >= this.level.height) return;
    this.level.tiles[ty][tx] = TILE.Empty;
    this.level.entities = this.level.entities.filter((e) => !(e.x === tx && e.y === ty));
    this.editorDirty = true;
    this.refreshEditorEnts();
  }

  /** In editor mode, (re)spawn lightweight entity markers so placements are visible. */
  refreshEditorEnts(): void {
    if (!this.level || !this.editorMode) return;
    this.ents = [];
    for (const e of this.level.entities) {
      if (e.type === 'playerStart') continue;
      this.spawnEntity(e);
    }
    // keep the player marker on the current start position
    const start = this.level.entities.find((e) => e.type === 'playerStart');
    if (start && this.player) {
      this.player.x = start.x * TS + 2;
      this.player.y = start.y * TS;
    }
    this.onStats();
  }

  enterEditor(): void {
    if (!this.level) return;
    this.editorMode = true;
    this.refreshEditorEnts();
  }

  exitEditor(testPlay: boolean, session?: SessionState): void {
    this.editorMode = false;
    if (testPlay && this.level && session) {
      this.startLevel(this.level, session);
    }
  }

  setEditorCam(dx: number, dy: number): void {
    if (!this.level) return;
    this.camX = Math.max(0, Math.min(this.camX + dx, this.level.width * TS - VIEW_W));
    this.camY = Math.max(0, Math.min(this.camY + dy, this.level.height * TS - VIEW_H));
  }

  screenToTile(gx: number, gy: number): { x: number; y: number } {
    return {
      x: Math.floor((gx + this.camX) / TS),
      y: Math.floor((gy + this.camY) / TS),
    };
  }

  getCam(): { x: number; y: number } {
    return { x: this.camX, y: this.camY };
  }

  setCam(x: number, y: number): void {
    if (!this.level) return;
    this.camX = Math.max(0, Math.min(x, this.level.width * TS - VIEW_W));
    this.camY = Math.max(0, Math.min(y, this.level.height * TS - VIEW_H));
  }

  getLevel(): LevelData | null {
    return this.level;
  }

  getPhase(): string {
    return this.phase;
  }

  getSession(): SessionState | null {
    return this.session;
  }
}
