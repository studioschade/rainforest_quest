// GameController — singleton bridge between React UI and the canvas engine.
import { Engine, TS } from './engine';
import type { SessionState, InputState } from './engine';
import { generateTextures } from './textures';
import type { TexAtlas } from './textures';
import { loadPhysics, loadGlitches, savePhysics, saveGlitches, DEFAULT_PHYSICS, DEFAULT_GLITCHES, anyGlitchActive } from './config';
import type { PhysicsConfig, GlitchFlags } from './config';
import { cloneLevel, listCustomLevels, listWorlds } from './storage';
import { BUILTIN_LEVELS } from './builtinLevels';
import { emptyLevel, TILE, LEVEL_HEIGHT } from './types';
import type { LevelData, WorldData, Theme } from './types';
import { audio } from './audio';
import type { MusicTrack, SfxName } from './audio';

export type Screen = 'title' | 'howto' | 'worlds' | 'editorPick' | 'game';
export type Overlay = 'none' | 'pause' | 'glitch' | 'levelComplete' | 'gameOver' | 'worldComplete' | 'transition';

const FIXED_DT = 1000 / 60;

/** One warp-jar round-trip record: the level we left plus where the jar stood (px). */
interface WarpReturn {
  level: LevelData;
  jarX: number;
  jarY: number;
}

/** Maximum nested warp round-trips. */
const WARP_STACK_MAX = 3;

export class GameController {
  engine: Engine | null = null;
  tex: TexAtlas | null = null;

  screen: Screen = 'title';
  overlay: Overlay = 'none';
  transitionText = '';

  physics: PhysicsConfig = loadPhysics();
  glitches: GlitchFlags = loadGlitches();

  world: WorldData | null = null;
  levelIndex = 0;
  session: SessionState = { score: 0, coins: 0, lives: 3, levelName: '' };
  testPlay = false;
  worldName = '';

  /** Warp round-trip stack; finishing a warped-to level pops back to the jar. */
  warpStack: WarpReturn[] = [];
  /** The level currently loaded (world slot or warp target); drives respawns. */
  private currentLevel: LevelData | null = null;

  editorLevelName = '';
  editorTheme: Theme = 'overworld';

  input: InputState = { left: false, right: false, up: false, down: false, jump: false, jumpPressed: false, run: false, firePressed: false };

  private listeners = new Set<() => void>();
  private version = 0;
  private raf = 0;
  private lastTime = 0;
  private acc = 0;
  private keys = new Set<string>();
  private hudTick = 0;
  private mouse = { down: false, button: -1, dragPanning: false, lastX: 0, lastY: 0, moved: 0 };
  private transitionTimer: ReturnType<typeof setTimeout> | null = null;

  // ---------- React subscription ----------
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = (): number => this.version;
  bump(): void {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  // ---------- engine attach & main loop ----------
  attach(canvas: HTMLCanvasElement): void {
    if (!this.tex) this.tex = generateTextures();
    if (!this.engine) {
      this.engine = new Engine(canvas, this.tex);
      this.engine.physics = this.physics;
      this.engine.glitches = this.glitches;
      this.engine.onStats = () => this.bump();
      this.engine.onLevelComplete = () => this.handleLevelComplete();
      this.engine.onGameOver = () => {
        if (this.testPlay) {
          // straight back to the editor after a failed test run
          this.engine?.enterEditor();
          this.overlay = 'none';
        } else {
          this.overlay = 'gameOver';
        }
        this.bump();
      };
      this.engine.onDied = () => this.respawn();
      this.engine.onWarpRequest = (target, jarX, jarY) => this.handleWarp(target, jarX, jarY);
      this.engine.onSfx = (name) => audio.sfx(name as SfxName);
    }
    if (!this.raf) {
      this.lastTime = performance.now();
      const loop = (t: number) => {
        this.raf = requestAnimationFrame(loop);
        const dt = Math.min(100, t - this.lastTime);
        this.lastTime = t;
        this.frame(dt);
      };
      this.raf = requestAnimationFrame(loop);
    }
  }

  private frame(dt: number): void {
    const eng = this.engine;
    if (!eng) return;
    // invariant: a 'transition' overlay with no live timer can never trap input
    if (this.overlay === 'transition' && !this.transitionTimer) this.skipTransition();
    const timeScale = this.glitches.slowMo ? 0.4 : this.physics.timeScale;
    const uiPaused = this.overlay === 'pause' || this.overlay === 'glitch' ||
      this.overlay === 'levelComplete' || this.overlay === 'gameOver' ||
      this.overlay === 'worldComplete' || this.overlay === 'transition' || this.screen !== 'game';
    if (this.screen === 'game' && !uiPaused) {
      this.acc += dt * timeScale;
      let steps = 0;
      while (this.acc >= FIXED_DT && steps < 5) {
        this.acc -= FIXED_DT;
        steps++;
        if (eng.editorMode) this.editorPanStep();
        else eng.update(this.input);
        this.input.jumpPressed = false;
        this.input.firePressed = false;
      }
      if (steps === 5) this.acc = 0;
      // refresh the HUD ~5x/sec so timed-effect countdowns tick
      this.hudTick++;
      if (this.hudTick >= 12 && eng.getLevel()) {
        this.hudTick = 0;
        this.bump();
      }
    } else {
      this.input.jumpPressed = false; // don't buffer jumps through menus
      this.input.firePressed = false;
    }
    eng.render();
    // music follows the loaded level's theme (title theme outside gameplay)
    const lvl = eng.getLevel();
    audio.setMusic(this.screen === 'game' && lvl ? (lvl.theme as MusicTrack) : 'title');
  }

  // ---------- input ----------
  handleKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
    audio.resume(); // browsers require a user gesture before audio can start
    const k = e.key.toLowerCase();

    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();

    if (k === 'm') {
      audio.toggleMute();
      this.bump();
      return;
    }
    if (k === 'g' && this.screen === 'game' && !this.engine?.editorMode && this.overlay !== 'transition') {
      this.overlay = this.overlay === 'glitch' ? 'none' : 'glitch';
      this.bump();
      return;
    }
    if (k === 'b' && this.screen === 'game' && this.overlay !== 'transition') {
      this.toggleEditor();
      return;
    }
    if (k === 'enter' && this.screen === 'game' && !this.engine?.editorMode) {
      // end-screens & transition splash: Enter = the panel's primary action
      if (this.overlay === 'transition') { this.skipTransition(); return; }
      if (this.overlay === 'levelComplete') { this.nextLevel(); return; }
      if (this.overlay === 'gameOver') { if (this.world) this.startWorld(this.world); else this.quitToTitle(); return; }
      if (this.overlay === 'worldComplete') { this.quitToTitle(); return; }
    }
    if ((k === 'escape' || k === 'p') && this.screen === 'game') {
      if (this.engine?.editorMode) {
        if (k === 'escape') this.quitToTitle();
        return;
      }
      if (this.overlay === 'transition') { this.skipTransition(); return; }
      if (this.overlay === 'pause') this.overlay = 'none';
      else if (this.overlay === 'none') this.overlay = 'pause';
      else if (this.overlay === 'glitch') this.overlay = 'none';
      else if (k === 'escape') { this.quitToTitle(); return; } // end-screens: Escape = quit to title
      this.bump();
      return;
    }

    const first = !this.keys.has(k);
    this.keys.add(k);
    if (first && (k === ' ' || k === 'z' || k === 'arrowup' || k === 'w')) this.input.jumpPressed = true;
    if (first && k === 'x') this.input.firePressed = true;
    this.applyKeys();
  }

  handleKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.key.toLowerCase());
    this.applyKeys();
  }

  private applyKeys(): void {
    const has = (s: string) => this.keys.has(s);
    this.input.left = has('arrowleft') || has('a');
    this.input.right = has('arrowright') || has('d');
    this.input.up = has('arrowup') || has('w');
    this.input.down = has('arrowdown') || has('s');
    this.input.jump = has(' ') || has('z') || has('arrowup') || has('w');
    this.input.run = has('x');
  }

  clearKeys(): void {
    this.keys.clear();
    this.input = { left: false, right: false, up: false, down: false, jump: false, jumpPressed: false, run: false, firePressed: false };
  }

  // ---------- mouse (editor) ----------
  /** Convert client coords to game px, accounting for object-fit: contain letterboxing. */
  private toGame(e: MouseEvent, canvas: HTMLCanvasElement): { gx: number; gy: number } {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
    const ox = (rect.width - canvas.width * scale) / 2;
    const oy = (rect.height - canvas.height * scale) / 2;
    return {
      gx: (e.clientX - rect.left - ox) / scale / 2,
      gy: (e.clientY - rect.top - oy) / scale / 2,
    };
  }

  handleMouseDown(e: MouseEvent, canvas: HTMLCanvasElement): void {
    const eng = this.engine;
    if (!eng?.editorMode) return;
    const { gx, gy } = this.toGame(e, canvas);
    this.mouse.down = true;
    this.mouse.button = e.button;
    this.mouse.lastX = gx; this.mouse.lastY = gy; this.mouse.moved = 0;
    if (e.button === 1 || e.button === 2) this.mouse.dragPanning = true;
    if (e.button === 0) {
      const t = eng.screenToTile(gx, gy);
      eng.editorPlace(t.x, t.y);
      this.bump();
    }
    e.preventDefault();
  }

  handleMouseMove(e: MouseEvent, canvas: HTMLCanvasElement): void {
    const eng = this.engine;
    if (!eng?.editorMode) return;
    const { gx, gy } = this.toGame(e, canvas);
    const t = eng.screenToTile(gx, gy);
    if (!eng.editorHover || eng.editorHover.x !== t.x || eng.editorHover.y !== t.y) {
      eng.editorHover = t;
      this.bump();
    }
    if (this.mouse.down) {
      const dx = gx - this.mouse.lastX, dy = gy - this.mouse.lastY;
      this.mouse.moved += Math.abs(dx) + Math.abs(dy);
      if (this.mouse.dragPanning) {
        eng.setEditorCam(-dx, -dy);
      } else if (this.mouse.button === 0 && this.mouse.moved > 4) {
        eng.editorPlace(t.x, t.y);
        this.bump();
      }
    }
    this.mouse.lastX = gx; this.mouse.lastY = gy;
  }

  handleMouseUp(e: MouseEvent, canvas: HTMLCanvasElement): void {
    const eng = this.engine;
    if (!eng?.editorMode) return;
    if (this.mouse.down && this.mouse.button === 2 && this.mouse.moved < 6) {
      const { gx, gy } = this.toGame(e, canvas);
      const t = eng.screenToTile(gx, gy);
      eng.editorErase(t.x, t.y);
      this.bump();
    }
    this.mouse.down = false;
    this.mouse.dragPanning = false;
    this.mouse.button = -1;
  }

  private editorPanStep(): void {
    const speed = 6;
    if (this.input.left) this.engine?.setEditorCam(-speed, 0);
    if (this.input.right) this.engine?.setEditorCam(speed, 0);
    if (this.input.up) this.engine?.setEditorCam(0, -speed);
    if (this.input.down) this.engine?.setEditorCam(0, speed);
  }

  /** Abandon a pending level-transition splash (timer + overlay). */
  private clearTransition(): void {
    if (this.transitionTimer) { clearTimeout(this.transitionTimer); this.transitionTimer = null; }
    if (this.overlay === 'transition') this.overlay = 'none';
  }

  // ---------- game flow ----------
  startWorld(world: WorldData): void {
    // deep-copy so warp-jar level swaps never mutate shared/built-in level data
    this.world = { name: world.name, levels: world.levels.map(cloneLevel) };
    this.worldName = world.name;
    this.levelIndex = 0;
    this.session = { score: 0, coins: 0, lives: 3, levelName: '' };
    this.warpStack = [];
    this.currentLevel = null; // assigned by beginLevelWithTransition
    this.testPlay = false;
    this.screen = 'game';
    this.beginLevelWithTransition();
  }

  // ---------- Mayan warp jars ----------
  /**
   * Resolve a warp-jar target and jump there.
   * - "world:<name>"  -> one-way: start that world fresh (clears the stack).
   * - "<level name>"  -> round-trip inside a world run: the current level and
   *   the jar position are pushed onto warpStack (max 3 deep); finishing the
   *   target level pops back to the jar instead of advancing. Outside a world
   *   run (test play), just start the level directly.
   * - "" (unset)      -> default: the next built-in level after the current
   *   one (fallback: the first built-in level).
   * Unresolvable targets (or a full stack) seal the jar (engine shake feedback).
   */
  handleWarp(target: string, jarX?: number, jarY?: number): void {
    const eng = this.engine;
    if (!eng) return;
    const fail = () => eng.warpFailed();

    let t = target.trim();
    if (!t) {
      // default: next built-in level after the current one
      const cur = eng.getLevel()?.name ?? '';
      const i = BUILTIN_LEVELS.findIndex((l) => l.name === cur);
      t = (i >= 0 && i < BUILTIN_LEVELS.length - 1 ? BUILTIN_LEVELS[i + 1] : BUILTIN_LEVELS[0]).name;
    }

    if (t.startsWith('world:')) {
      const name = t.slice('world:'.length);
      const w = listWorlds().find((x) => x.name === name);
      if (!w || w.levels.length === 0) { fail(); return; }
      this.warpStack = []; // one-way jump abandons pending round-trips
      this.clearTransition();
      this.startWorld(w);
      return;
    }

    const lvl = listCustomLevels().find((l) => l.name === t) ?? BUILTIN_LEVELS.find((l) => l.name === t);
    if (!lvl) { fail(); return; }
    this.clearTransition();
    if (this.world) {
      // round-trip: remember where we came from, then load the target level
      if (this.warpStack.length >= WARP_STACK_MAX) { fail(); return; }
      const from = this.currentLevel ?? eng.getLevel();
      if (!from) { fail(); return; }
      this.warpStack.push({ level: cloneLevel(from), jarX: jarX ?? 0, jarY: jarY ?? 0 });
      this.currentLevel = cloneLevel(lvl);
      this.overlay = 'none';
      eng.startLevel(cloneLevel(lvl), this.session);
    } else {
      this.session = { score: 0, coins: 0, lives: 3, levelName: lvl.name };
      this.currentLevel = cloneLevel(lvl);
      this.overlay = 'none';
      eng.startLevel(cloneLevel(lvl), this.session);
    }
    this.bump();
  }

  private beginLevelWithTransition(): void {
    if (!this.world) return;
    const lvl = this.world.levels[this.levelIndex];
    if (!lvl) { this.overlay = 'none'; this.bump(); return; }
    this.currentLevel = lvl;
    this.transitionText = lvl.name;
    this.overlay = 'transition';
    this.bump();
    if (this.transitionTimer) clearTimeout(this.transitionTimer);
    this.transitionTimer = setTimeout(() => {
      this.transitionTimer = null;
      if (this.overlay === 'transition') this.overlay = 'none'; // don't stomp a newer overlay
      this.engine?.startLevel(cloneLevel(lvl), this.session);
      this.bump();
    }, 1600);
  }

  /** Finish a pending level-transition splash immediately (Escape/P/Enter). */
  skipTransition(): void {
    if (this.transitionTimer) { clearTimeout(this.transitionTimer); this.transitionTimer = null; }
    if (this.overlay !== 'transition') return;
    const lvl = this.currentLevel ?? this.world?.levels[this.levelIndex];
    this.overlay = 'none';
    if (lvl && this.engine) this.engine.startLevel(cloneLevel(lvl), this.session);
    this.bump();
  }

  private handleLevelComplete(): void {
    // Warp round-trip return takes priority: finishing a warped-to level pops
    // back to the jar in the level we came from instead of advancing.
    if (this.warpStack.length > 0) {
      const rec = this.warpStack.pop()!;
      this.currentLevel = rec.level;
      this.overlay = 'none';
      const eng = this.engine;
      if (eng) {
        eng.startLevel(cloneLevel(rec.level), this.session);
        // rematerialize just past the jar mouth, one tile above it
        eng.teleportPlayer(rec.jarX + TS * 2.5, rec.jarY - TS);
      }
      this.bump();
      return;
    }
    if (this.testPlay) {
      // back to the editor after a successful test run
      this.engine?.enterEditor();
      this.overlay = 'none';
      this.bump();
      return;
    }
    if (!this.world) {
      // standalone level (e.g. warped-to outside a world run): show an end
      // panel — never leave the engine spinning in the 'complete' phase
      this.overlay = 'worldComplete';
      this.bump();
      return;
    }
    if (this.levelIndex >= this.world.levels.length - 1) {
      this.overlay = 'worldComplete';
    } else {
      this.overlay = 'levelComplete';
    }
    this.bump();
  }

  nextLevel(): void {
    if (!this.world || this.levelIndex >= this.world.levels.length - 1) return;
    this.levelIndex++;
    this.beginLevelWithTransition();
  }

  private respawn(): void {
    if (this.testPlay) {
      this.overlay = 'none';
      this.engine?.startLevel(this.engine.getLevel()!, this.session);
      this.bump();
      return;
    }
    // dying inside a warped-to level respawns there (the stack is kept)
    const lvl = this.currentLevel ?? this.world?.levels[this.levelIndex];
    if (!lvl) return;
    this.engine?.startLevel(cloneLevel(lvl), this.session, true);
    this.bump();
  }

  restartLevel(): void {
    if (this.testPlay) { this.respawn(); this.overlay = 'none'; this.bump(); return; }
    const lvl = this.currentLevel ?? this.world?.levels[this.levelIndex];
    if (!lvl) return;
    this.overlay = 'none';
    this.engine?.startLevel(cloneLevel(lvl), this.session);
    this.bump();
  }

  quitToTitle(): void {
    if (this.transitionTimer) { clearTimeout(this.transitionTimer); this.transitionTimer = null; }
    this.screen = 'title';
    this.overlay = 'none';
    this.testPlay = false;
    this.warpStack = [];
    this.currentLevel = null;
    if (this.engine) this.engine.editorMode = false;
    this.clearKeys();
    this.bump();
  }

  // ---------- editor flow ----------
  openEditorWithLevel(level: LevelData): void {
    this.clearTransition(); // never let a stale splash stomp the editor
    this.screen = 'game';
    this.overlay = 'none';
    this.testPlay = false;
    this.warpStack = [];
    this.currentLevel = null;
    this.editorLevelName = level.name;
    this.editorTheme = level.theme;
    this.session = { score: 0, coins: 0, lives: 3, levelName: level.name };
    this.engine?.startLevel(cloneLevel(level), this.session);
    this.engine?.enterEditor();
    this.clearKeys();
    this.bump();
  }

  createBlankLevel(name: string, theme: Theme, width: number): LevelData {
    const level = emptyLevel(name || 'Untitled Level', theme, Math.max(40, Math.min(400, width)));
    // Starter ground across the full width so a new level is playable
    // immediately (same top row as the built-in levels, theme-appropriate
    // tiles: grass overworld, stone underworld, leaves canopy, sand lagoon,
    // temple boss).
    const top = 18;
    const [topTile, fillTile] =
      theme === 'lagoon' ? [TILE.Sand, TILE.Dirt]
      : theme === 'underworld' ? [TILE.Stone, TILE.Temple]
      : theme === 'canopy' ? [TILE.Leaves, TILE.Leaves]
      : theme === 'boss' ? [TILE.Temple, TILE.Stone]
      : [TILE.Ground, TILE.Dirt];
    for (let x = 0; x < level.width; x++) {
      level.tiles[top][x] = topTile;
      for (let y = top + 1; y < LEVEL_HEIGHT; y++) level.tiles[y][x] = fillTile;
    }
    // playerStart from emptyLevel() sits at LEVEL_HEIGHT-4, now underground
    for (const e of level.entities) if (e.type === 'playerStart') e.y = top - 2;
    return level;
  }

  toggleEditor(): void {
    const eng = this.engine;
    if (!eng) return;
    this.clearTransition(); // the editor and the splash must never co-exist
    if (eng.editorMode) {
      // Test Play
      this.testPlay = true;
      this.session = { score: 0, coins: 0, lives: 3, levelName: eng.getLevel()?.name ?? '' };
      eng.exitEditor(true, this.session);
    } else {
      eng.enterEditor();
      this.testPlay = false;
    }
    this.overlay = 'none';
    this.bump();
  }

  // ---------- glitch / physics setters ----------
  setPhysics<K extends keyof PhysicsConfig>(key: K, value: number): void {
    this.physics[key] = value;
    savePhysics(this.physics);
    this.bump();
  }

  setGlitch(key: keyof GlitchFlags, value: boolean): void {
    this.glitches[key] = value;
    saveGlitches(this.glitches);
    this.bump();
  }

  resetGlitches(): void {
    this.glitches = { ...DEFAULT_GLITCHES };
    this.physics = { ...DEFAULT_PHYSICS };
    if (this.engine) { this.engine.glitches = this.glitches; this.engine.physics = this.physics; }
    saveGlitches(this.glitches);
    savePhysics(this.physics);
    this.bump();
  }

  get glitchActive(): boolean {
    return anyGlitchActive(this.glitches);
  }
}

export const controller = new GameController();
export { TS };
