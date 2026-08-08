// Headless smoke test — run with: node smoke.mjs (bundled by esbuild)
/* eslint-disable @typescript-eslint/no-explicit-any */

// ---- minimal DOM stubs so textures/engine can load under Node ----
const ctxStub = (): any => new Proxy({}, {
  get: (_t, p) => {
    if (p === 'createLinearGradient') return () => ({ addColorStop: () => {} });
    if (p === 'canvas') return {};
    return () => {};
  },
  set: () => true,
});
(globalThis as any).document = {
  createElement: () => ({ width: 0, height: 0, getContext: ctxStub, style: {} }),
};
(globalThis as any).localStorage = undefined;

import { Engine } from '../src/game/engine';
import { generateTextures } from '../src/game/textures';
import { BUILTIN_LEVELS } from '../src/game/builtinLevels';
import { TILE, SOLID_TILES } from '../src/game/types';
import type { InputState, SessionState } from '../src/game/engine';
import { DEFAULT_PHYSICS, DEFAULT_GLITCHES } from '../src/game/config';

let failures = 0;
const ok = (cond: boolean, name: string) => {
  if (cond) console.log('  ✅', name);
  else { console.log('  ❌', name); failures++; }
};
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// ---------- 1. level data validation ----------
console.log('Level validation:');
for (const l of BUILTIN_LEVELS) {
  const starts = l.entities.filter((e) => e.type === 'playerStart');
  const goals = l.entities.filter((e) => e.type === 'goal' || e.type === 'gong' || e.type === 'axe');
  ok(l.tiles.length === l.height && l.tiles.every((r) => r.length === l.width), `${l.name}: grid dims ok`);
  ok(starts.length === 1, `${l.name}: exactly one player start`);
  ok(goals.length >= 1, `${l.name}: has goal/gong`);
  ok(l.entities.every((e) => e.x >= 0 && e.x < l.width && e.y >= 0 && e.y < l.height), `${l.name}: entities in bounds`);
  ok(l.tiles.every((row) => row.every((t) => Number.isInteger(t) && t >= 0 && t <= TILE.Sand)), `${l.name}: tile ids valid`);
  // liquids must be horizontally contained: no water/lava column open to
  // thin air (or decor) on a side — every side neighbor is solid or liquid
  const LIQUIDS = new Set([TILE.Water, TILE.SwimWater, TILE.Lava]);
  let unbounded = 0;
  for (let y = 0; y < l.height; y++) for (let x = 0; x < l.width; x++) {
    if (!LIQUIDS.has(l.tiles[y][x])) continue;
    for (const nx of [x - 1, x + 1]) {
      const t = nx < 0 || nx >= l.width ? TILE.Stone : l.tiles[y][nx]; // world sides are solid
      if (!SOLID_TILES.has(t) && !LIQUIDS.has(t)) unbounded++;
    }
  }
  ok(unbounded === 0, `${l.name}: all liquids walled in (${unbounded} open)`);
}

// editor: blank levels come with a full-width starter ground + start above it
{
  const lvl = controller.createBlankLevel('Test Blank', 'overworld', 60);
  const solidRow = (y: number) => lvl.tiles[y].every((t) => SOLID_TILES.has(t));
  ok(solidRow(18) && solidRow(lvl.height - 1), 'blank editor level: ground spans the full width');
  const ps = lvl.entities.find((e) => e.type === 'playerStart')!;
  ok(ps.y < 18 && !SOLID_TILES.has(lvl.tiles[ps.y][ps.x]), 'blank editor level: playerStart above the ground, not in it');
  ok(SOLID_TILES.has(lvl.tiles[18][3]), 'blank editor level: solid ground under the playerStart');
}

// saga order: the five-level built-in sequence
ok(JSON.stringify(BUILTIN_LEVELS.map((l) => l.name)) === JSON.stringify([
  '1-1 Emerald Floor', '1-2 Sunken Grotto', '1-3 Canopy Heights', '1-4 Azure Lagoon', "1-5 Idol's Sanctum",
]), 'saga order is the 5-level sequence (lagoon before the idol)');

// ---------- 2. engine simulation ----------
console.log('Engine simulation:');
const tex = generateTextures();
const fakeCanvas: any = { width: 1024, height: 576, getContext: ctxStub };
const eng = new Engine(fakeCanvas, tex);
eng.physics = { ...DEFAULT_PHYSICS };
eng.glitches = { ...DEFAULT_GLITCHES };

const idle: InputState = { left: false, right: false, up: false, down: false, jump: false, jumpPressed: false, run: false, firePressed: false };
const session: SessionState = { score: 0, coins: 0, lives: 3, levelName: '' };

// run right on 1-1
eng.startLevel(clone(BUILTIN_LEVELS[0]), session);
const p0 = (eng as any).player;
ok(!!p0, 'player spawned');
const startX = p0.x;
let threw = false;
try {
  for (let i = 0; i < 600; i++) {
    eng.update({ ...idle, right: true, run: true });
    if (i === 60 || i === 200) eng.update({ ...idle, right: true, run: true, jump: true, jumpPressed: true });
    else eng.update({ ...idle, right: true, run: true, jump: false });
    eng.render();
  }
} catch (e) { threw = true; console.log('   error:', (e as Error).message); }
ok(!threw, '600 frames of running/jumping without exceptions');
ok(p0.x > startX + 200, `player advanced right (x ${startX.toFixed(0)} -> ${p0.x.toFixed(0)})`);

// jump height check
eng.startLevel(clone(BUILTIN_LEVELS[0]), session);
const p1 = (eng as any).player;
for (let i = 0; i < 30; i++) eng.update(idle); // settle on ground
ok(p1.onGround, 'player lands on ground');
let minY = p1.y;
for (let i = 0; i < 120; i++) {
  eng.update({ ...idle, jump: true, jumpPressed: i === 0 });
  minY = Math.min(minY, p1.y);
}
ok(p1.y - minY > 30, `jump gains height (${(p1.y - minY).toFixed(1)}px)`);

// stomp a beetle: put player directly above first beetle, fall
eng.startLevel(clone(BUILTIN_LEVELS[0]), session);
const ents1 = (eng as any).ents;
const beetle = ents1.find((e: any) => e.kind === 'beetle');
const p2 = (eng as any).player;
p2.x = beetle.x; p2.y = beetle.y - 40; p2.vy = 2;
const scoreBefore = session.score;
let stomped = false;
try {
  for (let i = 0; i < 90; i++) { eng.update(idle); if (beetle.dead || beetle.remove) { stomped = true; break; } }
} catch (e) { console.log('   stomp error:', (e as Error).message); }
ok(stomped, 'beetle stomped');
ok(session.score > scoreBefore, 'stomp awarded score');

// ghost walk glitch: player clips through solid floors (and pits still kill)
eng.glitches = { ...DEFAULT_GLITCHES, ghostWalk: true };
eng.startLevel(clone(BUILTIN_LEVELS[0]), session);
const p3 = (eng as any).player;
for (let i = 0; i < 60; i++) eng.update({ ...idle, right: true });
ok(p3.y > 18 * 16, 'ghost walk clips through solid ground');
eng.glitches = { ...DEFAULT_GLITCHES };

// question block bump: stand under a question block at tile 14,13 in 1-1
eng.startLevel(clone(BUILTIN_LEVELS[0]), session);
const p4 = (eng as any).player;
p4.x = 14 * 16 + 2; p4.y = 15 * 16; p4.vy = 0;
for (let i = 0; i < 10; i++) eng.update(idle);
for (let i = 0; i < 40; i++) eng.update({ ...idle, jump: true, jumpPressed: i === 0 });
const lvl = (eng as any).level;
ok(lvl.tiles[13][14] === TILE.QuestionUsed || session.coins > 0 || session.score > 0, 'question block activated');

// all levels: 900 idle-ish frames each looking for crashes
for (let li = 0; li < BUILTIN_LEVELS.length; li++) {
  const s2: SessionState = { score: 0, coins: 0, lives: 3, levelName: '' };
  eng.startLevel(clone(BUILTIN_LEVELS[li]), s2);
  let crashed: string | null = null;
  try {
    for (let i = 0; i < 900; i++) {
      eng.update({ ...idle, right: i % 3 !== 0, jump: i % 90 < 30, jumpPressed: i % 90 === 0 });
      if (i % 60 === 0) eng.render();
    }
  } catch (e) { crashed = (e as Error).message + '\n' + (e as Error).stack?.split('\n')[1]; }
  ok(!crashed, `level ${BUILTIN_LEVELS[li].name}: 900 chaotic frames no crash${crashed ? ' — ' + crashed : ''}`);
}

// boss level: teleport player to the axe -> victory sequence triggers
{
  const s3: SessionState = { score: 0, coins: 0, lives: 3, levelName: '' };
  eng.startLevel(clone(BUILTIN_LEVELS[BUILTIN_LEVELS.length - 1]), s3);
  const p5 = (eng as any).player;
  const axe = (eng as any).ents.find((e: any) => e.kind === 'axe');
  p5.x = axe.x; p5.y = axe.y;
  let completed = false;
  eng.onLevelComplete = () => { completed = true; };
  for (let i = 0; i < 400 && !completed; i++) eng.update(idle);
  ok(completed, 'axe pickup triggers boss defeat + level complete');
}

// editor round-trip
console.log('Editor round-trip:');
{
  const l = clone(BUILTIN_LEVELS[1]);
  const ser = JSON.stringify(l);
  const back = JSON.parse(ser);
  ok(ser === JSON.stringify(back), 'save -> load -> identical JSON');
  // editor place/erase
  const s4: SessionState = { score: 0, coins: 0, lives: 3, levelName: '' };
  eng.startLevel(clone(BUILTIN_LEVELS[0]), s4);
  eng.enterEditor();
  eng.editorSel = { kind: 'tile', tile: TILE.Brick };
  eng.editorPlace(5, 5);
  ok((eng as any).level.tiles[5][5] === TILE.Brick, 'editor places tile');
  eng.editorErase(5, 5);
  ok((eng as any).level.tiles[5][5] === TILE.Empty, 'editor erases tile');
  eng.editorSel = { kind: 'entity', entity: 'coin' };
  eng.editorPlace(7, 7);
  ok((eng as any).level.entities.some((e: any) => e.type === 'coin' && e.x === 7 && e.y === 7), 'editor places entity');
  eng.exitEditor(false);
}

// ---------- 3. powerups ----------
console.log('Powerups:');
import { questionContent } from '../src/game/engine';
import { TIMED_EFFECTS } from '../src/game/types';
import type { EntitySpawn } from '../src/game/types';

/** Fresh engine on 1-1 with all entities cleared; returns internals. */
function cleanRoom() {
  const s: SessionState = { score: 0, coins: 0, lives: 3, levelName: '' };
  eng.glitches = { ...DEFAULT_GLITCHES };
  eng.startLevel(clone(BUILTIN_LEVELS[0]), s);
  (eng as any).ents = [];
  const p = (eng as any).player;
  for (let i = 0; i < 20; i++) eng.update(idle); // settle on ground
  return { s, p };
}

/** Place a powerup item right on the player and step until picked up. */
function give(kind: string) {
  const p = (eng as any).player;
  (eng as any).ents.push({
    kind, x: p.x, y: p.y, w: 12, h: 14, vx: 0, vy: 0, onGround: false,
    dir: 1, frame: 0, state: 'still', t: 0, dead: false, remove: false,
    hp: 1, baseY: p.y, homeTx: 0, variant: '', target: '', extreme: false, stun: 0,
  });
  for (let i = 0; i < 5; i++) eng.update(idle);
}

function spawn(type: string, tx: number, ty: number) {
  (eng as any).spawnEntity({ type, x: tx, y: ty } as EntitySpawn);
}

// timed powerups: pickup sets the timer, timer expires
const TIMED_CASES: [string, keyof typeof TIMED_EFFECTS][] = [
  ['macawWings', 'wings'], ['jaguarPelt', 'jaguar'], ['rainbowOrchid', 'orchid'],
  ['grasshopperLegs', 'legs'], ['shrinkberry', 'shrink'], ['coinCapuchin', 'capuchin'],
];
for (const [item, key] of TIMED_CASES) {
  const { p } = cleanRoom();
  give(item);
  const set = p.timers[key] > TIMED_EFFECTS[key].duration - 20;
  let frames = 0;
  while (p.timers[key] > 0 && frames < TIMED_EFFECTS[key].duration + 120) { eng.update(idle); frames++; }
  ok(set && p.timers[key] === 0, `${item}: timer set then expired (${frames}f)`);
}

// shrinkberry: half size while active, restores on expiry
{
  const { p } = cleanRoom();
  const h0 = p.h;
  give('shrinkberry');
  eng.update(idle);
  const shrunkH = p.h;
  let frames = 0;
  while (p.timers.shrink > 0 && frames < 1100) { eng.update(idle); frames++; }
  eng.update(idle);
  ok(shrunkH <= h0 * 0.55 && p.h >= h0 - 0.5, `shrinkberry: ${h0} -> ${shrunkH} -> ${p.h}`);
}

// ember chili: form set, X fires, max 2, kills beetle, armadillo fireproof
{
  const { p } = cleanRoom();
  give('emberChili');
  ok(p.form === 'ember' && p.big, 'ember chili: form applied + big');
  for (let i = 0; i < 3; i++) eng.update({ ...idle, firePressed: true });
  const embers = (eng as any).ents.filter((e: any) => e.kind === 'ember' && !e.remove);
  ok(embers.length === 2, `ember chili: max 2 embers alive (got ${embers.length})`);
  // beetle ahead at same height
  const btx = Math.floor(p.x / 16) + 4, bty = Math.floor(p.y / 16);
  spawn('beetle', btx, bty);
  const beetle = (eng as any).ents.find((e: any) => e.kind === 'beetle');
  let beetleDead = false;
  for (let i = 0; i < 240 && !beetleDead; i++) {
    eng.update(i === 0 ? { ...idle, firePressed: true } : idle);
    if (beetle.dead || beetle.remove) beetleDead = true;
  }
  ok(beetleDead, 'ember kills a beetle');
  // armadillo is fireproof
  cleanRoom();
  const p2 = (eng as any).player;
  give('emberChili');
  const atx = Math.floor(p2.x / 16) + 3, aty = Math.floor(p2.y / 16);
  spawn('armadillo', atx, aty);
  const arm = (eng as any).ents.find((e: any) => e.kind === 'armadillo');
  for (let i = 0; i < 240; i++) eng.update(i === 0 ? { ...idle, firePressed: true } : idle);
  ok(!arm.dead && !arm.remove, 'armadillo survives embers (fireproof)');
}

// form replacement: chili -> frog
{
  const { p } = cleanRoom();
  give('emberChili');
  const wasEmber = p.form === 'ember';
  give('frogSuit');
  ok(wasEmber && p.form === 'frog' && p.big, 'form replacement: ember -> frog');
  // damage flow: form -> big -> small
  (eng as any).hurtPlayer(false);
  ok(p.form === 'none' && p.big && !p.dead, 'hit in form: lose form, stay big');
  p.invuln = 0;
  (eng as any).hurtPlayer(false);
  ok(!p.big && !p.dead, 'hit while big: shrink to small');
}

// golden banana: on-screen beetles become coins
{
  const { p } = cleanRoom();
  const tx = Math.floor(p.x / 16);
  spawn('beetle', tx + 2, Math.floor(p.y / 16));
  spawn('beetle', tx + 5, Math.floor(p.y / 16));
  give('goldenBanana');
  eng.update(idle);
  const kinds = (eng as any).ents.map((e: any) => e.kind);
  ok(!kinds.includes('beetle') && kinds.filter((k: string) => k === 'coin').length >= 2,
    'golden banana: beetles became coins');
}

// thunder mango: clears on-screen enemies
{
  const { p } = cleanRoom();
  const tx = Math.floor(p.x / 16);
  spawn('beetle', tx + 2, Math.floor(p.y / 16));
  spawn('durian', tx + 4, Math.floor(p.y / 16));
  spawn('monkey', tx + 6, Math.floor(p.y / 16) - 1);
  give('thunderMango');
  eng.update(idle);
  const alive = (eng as any).ents.filter((e: any) => ['beetle', 'durian', 'monkey'].includes(e.kind) && !e.dead && !e.remove);
  ok(alive.length === 0, 'thunder mango: screen enemies defeated');
}

// question block distribution: only valid contents
{
  const valid = new Set(['coin', 'bloom', 'emberChili', 'frogSuit', 'kapokAnvil', 'macawWings', 'jaguarPelt', 'rainbowOrchid', 'grasshopperLegs', 'shrinkberry', 'coinCapuchin', 'goldenBanana', 'thunderMango', 'staticStarfruit']);
  let allValid = true;
  const counts: Record<string, number> = {};
  const countsSmall: Record<string, number> = {};
  for (let x = 0; x < 200; x++) {
    for (let y = 8; y < 16; y++) {
      const c = questionContent(x, y, false);
      const cs = questionContent(x, y, true);
      if (!valid.has(c) || !valid.has(cs)) allValid = false;
      counts[c] = (counts[c] ?? 0) + 1;
      countsSmall[cs] = (countsSmall[cs] ?? 0) + 1;
    }
  }
  const total = 200 * 8;
  ok(allValid, 'question distribution: only valid contents');
  ok((counts['coin'] ?? 0) / total > 0.4, `question distribution: coin common (${(((counts['coin'] ?? 0) / total) * 100).toFixed(0)}%)`);
  ok((countsSmall['bloom'] ?? 0) > (counts['bloom'] ?? 0), 'question distribution: small players get more blooms');
  ok((counts['staticStarfruit'] ?? 0) / total < 0.03 && (countsSmall['staticStarfruit'] ?? 0) / total < 0.03,
    `question distribution: starfruit rare (${(((counts['staticStarfruit'] ?? 0) / total) * 100).toFixed(1)}%/${(((countsSmall['staticStarfruit'] ?? 0) / total) * 100).toFixed(1)}%)`);
}

// editor round-trip with new powerups
{
  const s5: SessionState = { score: 0, coins: 0, lives: 3, levelName: '' };
  eng.startLevel(clone(BUILTIN_LEVELS[0]), s5);
  eng.enterEditor();
  eng.editorSel = { kind: 'entity', entity: 'thunderMango' };
  eng.editorPlace(9, 9);
  const lvl = (eng as any).level;
  const rt = JSON.parse(JSON.stringify(lvl));
  ok(rt.entities.some((e: any) => e.type === 'thunderMango' && e.x === 9 && e.y === 9), 'editor: new powerup places + serializes');
  eng.exitEditor(false);
}

// ---------- 4. lagoon: swimming & swimfish ----------
console.log('Lagoon / swimming:');
const LAGOON = 3; // 1-4 Azure Lagoon in the saga order asserted above
{
  const s: SessionState = { score: 0, coins: 0, lives: 3, levelName: '' };
  eng.glitches = { ...DEFAULT_GLITCHES };
  eng.startLevel(clone(BUILTIN_LEVELS[LAGOON]), s);
  (eng as any).ents = [];
  const lvl = (eng as any).level;
  // find a deep SwimWater cell (water above it too)
  let sx = -1, sy = -1;
  outer: for (let y = lvl.height - 3; y >= 0; y--) {
    for (let x = 4; x < lvl.width - 4; x++) {
      if (lvl.tiles[y][x] === TILE.SwimWater && lvl.tiles[y - 1][x] === TILE.SwimWater) { sx = x; sy = y; break outer; }
    }
  }
  ok(sx > 0, 'lagoon level contains SwimWater');
  const p = (eng as any).player;
  p.x = sx * 16; p.y = sy * 16; p.vx = 0; p.vy = 0; p.swimCd = 0;
  eng.update(idle);
  ok(p.swimming === true, 'SwimWater puts the player into swim mode');
  eng.update({ ...idle, jump: true, jumpPressed: true });
  ok(p.vy < -2.5, `swim stroke launches upward (vy ${p.vy.toFixed(2)})`);
  for (let i = 0; i < 300; i++) eng.update(idle);
  ok(!p.dead && s.lives === 3, 'no damage after 300 frames submerged (SwimWater is safe)');
}

// swimfish: swims, turns at the water edge, contact hurts while swimming
{
  const s: SessionState = { score: 0, coins: 0, lives: 3, levelName: '' };
  eng.startLevel(clone(BUILTIN_LEVELS[LAGOON]), s);
  (eng as any).ents = [];
  const lvl = (eng as any).level;
  // leftmost SwimWater column at a mid-depth row (fish starts by the left edge)
  let fy = -1, fx = -1;
  outer: for (let y = 15; y < lvl.height - 2; y++) {
    for (let x = 1; x < lvl.width - 1; x++) {
      if (lvl.tiles[y][x] === TILE.SwimWater) { fx = x; fy = y; break outer; }
    }
  }
  spawn('swimfish', fx + 1, fy);
  const fish = (eng as any).ents.find((e: any) => e.kind === 'swimfish');
  const p = (eng as any).player;
  p.invuln = 100000; // observe the fish up close without dying
  p.x = fish.x - 48; p.y = fish.y - 8; p.vx = 0; p.vy = 0;
  const fx0 = fish.x;
  for (let i = 0; i < 30; i++) eng.update(idle);
  ok(Math.abs(fish.x - fx0) > 2 && !fish.remove, `swimfish swims (moved ${Math.abs(fish.x - fx0).toFixed(1)}px)`);
  for (let i = 0; i < 240 && fish.vx < 0; i++) eng.update(idle);
  ok(fish.vx > 0, 'swimfish turns at the water edge');
  // underwater contact hurts
  p.invuln = 0;
  p.x = fish.x; p.y = fish.y; p.vy = 0;
  let hurt = false;
  for (let i = 0; i < 12 && !hurt; i++) { eng.update(idle); if (p.dead || p.invuln > 0) hurt = true; }
  ok(hurt, 'underwater swimfish contact hurts the player');
}

// ---------- 5. Static Starfruit ----------
console.log('Static Starfruit:');
{
  // physics scramble: changes every slider, then restores the exact snapshot
  cleanRoom();
  const physBefore = JSON.stringify((eng as any).physics);
  (eng as any).rollStarfruit('scramble');
  ok((eng as any).glitchFx?.kind === 'scramble', 'scramble: glitch fx active');
  ok(JSON.stringify((eng as any).physics) !== physBefore, 'scramble: physics randomized');
  ok((eng as any).physics.gravity >= 0.15 && (eng as any).physics.jumpPower >= 6, 'scramble: gravity/jump clamps hold');
  const fx1 = eng.getFx();
  ok(fx1.static !== null && fx1.static.seconds > 0, 'HUD fx reports STATIC with countdown');
  let threw = false;
  try { for (let i = 0; i < 330; i++) { eng.update(idle); if (i % 25 === 0) eng.render(); } } catch (e) { threw = true; }
  ok(!threw, 'glitch render mode runs without exceptions');
  ok((eng as any).glitchFx === null, 'scramble: effect expired');
  ok(JSON.stringify((eng as any).physics) === physBefore, 'scramble: physics restored exactly');
  ok(eng.getFx().static === null, 'HUD fx cleared after restore');

  // glitch surge: force a deterministic key (bigHead, purely cosmetic) via patched random
  cleanRoom();
  const realRandom = Math.random;
  Math.random = () => 11.5 / 16; // keys[11] === 'bigHead' (slowMo excluded)
  (eng as any).rollStarfruit('surge');
  Math.random = realRandom;
  ok((eng as any).glitchFx?.kind === 'surge' && (eng as any).glitches.bigHead === true, 'surge: random glitch forced ON');
  for (let i = 0; i < 620; i++) eng.update(idle);
  ok((eng as any).glitchFx === null && (eng as any).glitches.bigHead === false, 'surge: flag restored after 10s');

  // no stacking: a second roll restores the first effect before applying
  Math.random = () => 11.5 / 16;
  (eng as any).rollStarfruit('surge');
  Math.random = realRandom;
  (eng as any).rollStarfruit('scramble');
  ok((eng as any).glitches.bigHead === false && (eng as any).glitchFx?.kind === 'scramble', 'second starfruit restores the first roll (no stacking)');
  (eng as any).restoreGlitchFx();

  // pickup path: touching the item triggers a roll and awards score
  {
    const { p } = cleanRoom();
    const scoreBefore = (eng as any).session.score;
    give('staticStarfruit');
    ok((eng as any).glitchFx !== null && (eng as any).session.score > scoreBefore, 'starfruit pickup rolls an effect + scores');
    (eng as any).restoreGlitchFx();
    void p;
  }
}

// ---------- 6. warp jars ----------
console.log('Warp jars:');
import { controller } from '../src/game/controller';
{
  // engine side: stand on a targeted jar, press DOWN -> warp request fires
  const { p } = cleanRoom();
  const tx = Math.floor(p.x / 16) + 2;
  (eng as any).spawnEntity({ type: 'warpJar', x: tx, y: 17, target: '1-2 Sunken Grotto' } as EntitySpawn);
  const jar = (eng as any).ents.find((e: any) => e.kind === 'warpJar');
  p.x = jar.x + jar.w / 2 - p.w / 2;
  p.y = jar.y - p.h; // standing on the jar mouth
  let captured: string | null = null;
  eng.onWarpRequest = (t: string) => { if (captured === null) captured = t; };
  eng.update({ ...idle, down: true });
  ok((eng as any).phase === 'warp', 'DOWN on jar starts the warp animation');
  for (let i = 0; i < 60 && captured === null; i++) eng.update(idle);
  ok(captured === '1-2 Sunken Grotto', `warp request fired with target ("${String(captured)}")`);

  // controller side: level warp is a ROUND-TRIP — the world slot is untouched
  controller.engine = eng;
  controller.world = { name: 'TestWorld', levels: [clone(BUILTIN_LEVELS[0]), clone(BUILTIN_LEVELS[1])] };
  controller.levelIndex = 0;
  controller.session = { score: 1234, coins: 7, lives: 2, levelName: '' };
  controller.warpStack = [];
  (controller as any).currentLevel = controller.world.levels[0];
  eng.startLevel(clone(BUILTIN_LEVELS[0]), controller.session);
  controller.handleWarp('1-2 Sunken Grotto', 99 * 16, 9 * 16);
  ok((eng as any).level.name === '1-2 Sunken Grotto', 'controller warp loads the target level');
  ok(controller.session.score === 1234 && controller.session.coins === 7 && controller.session.lives === 2,
    'session score/coins/lives preserved through warp');
  ok(controller.world.levels[0].name === '1-1 Emerald Floor' && controller.levelIndex === 0,
    'round-trip: world slot untouched (no replacement)');
  ok(controller.warpStack.length === 1, 'round-trip: return pushed onto the warp stack');

  // finishing the warped-to level pops back to the jar in the origin level
  (controller as any).handleLevelComplete();
  ok((eng as any).level.name === '1-1 Emerald Floor', 'round-trip: completion returns to the origin level');
  const rp = (eng as any).player;
  ok(Math.abs(rp.x - (99 * 16 + 2.5 * 16)) < 20, `round-trip: player rematerializes by the jar (x=${rp.x.toFixed(0)})`);
  ok(controller.session.score === 1234 && controller.session.lives === 2, 'round-trip: session still intact after return');
  ok(controller.warpStack.length === 0, 'round-trip: stack drained');

  // with the stack empty, completion advances the world normally again
  (controller as any).handleLevelComplete();
  ok(controller.overlay === 'levelComplete', 'normal level-complete flow resumes after the round-trip');
  controller.overlay = 'none';

  // empty target -> default: next built-in level after the current one
  controller.handleWarp('');
  ok((eng as any).level.name === '1-2 Sunken Grotto', 'empty target defaults to the next built-in level');

  // missing target -> sealed jar, no crash, level unchanged
  controller.handleWarp('definitely-not-a-level');
  ok((eng as any).level.name === '1-2 Sunken Grotto' && (eng as any).phase === 'play', 'missing target: sealed-jar fallback, no crash');

  // world target with no saved worlds -> sealed jar, no crash
  controller.handleWarp('world:Nowhere');
  ok((eng as any).level.name === '1-2 Sunken Grotto', 'unknown world target: sealed-jar fallback');

  // stack cap: three nested round-trips max, the fourth jar seals
  controller.warpStack = [];
  controller.handleWarp('1-1 Emerald Floor');   // 1 (back to 1-1)
  controller.handleWarp('1-2 Sunken Grotto');   // 2
  controller.handleWarp('1-3 Canopy Heights');  // 3
  controller.handleWarp('1-4 Azure Lagoon');    // refused — stack full
  ok(controller.warpStack.length === 3 && (eng as any).level.name === '1-3 Canopy Heights', 'warp stack capped at 3 nested trips');
  controller.warpStack = [];
  (controller as any).currentLevel = null;
  controller.world = null;
  controller.overlay = 'none';

  // JSON round-trip preserves warpJar target
  const l1 = clone(BUILTIN_LEVELS[0]);
  ok(l1.entities.some((e: any) => e.type === 'warpJar' && e.target === '1-4 Azure Lagoon'), '1-1 hides a warp jar to the lagoon');
  const rt = JSON.parse(JSON.stringify(l1));
  ok(rt.entities.some((e: any) => e.type === 'warpJar' && e.target === '1-4 Azure Lagoon'), 'level JSON round-trip preserves warpJar target');

  // editor: placing a jar attaches the chosen target
  const s6: SessionState = { score: 0, coins: 0, lives: 3, levelName: '' };
  eng.startLevel(clone(BUILTIN_LEVELS[0]), s6);
  eng.enterEditor();
  eng.editorWarpTarget = '1-2 Sunken Grotto';
  eng.editorSel = { kind: 'entity', entity: 'warpJar' };
  eng.editorPlace(20, 17);
  ok((eng as any).level.entities.some((e: any) => e.type === 'warpJar' && e.x === 20 && e.y === 17 && e.target === '1-2 Sunken Grotto'),
    'editor places warp jar with the chosen target');
  eng.editorWarpTarget = '';
  eng.exitEditor(false);
}

// ---------- 7. colored keys & locked goals ----------
console.log('Keys & locked goals:');
{
  const { s, p } = cleanRoom();
  const tx = Math.floor(p.x / 16), ty = Math.floor(p.y / 16);
  spawn('keyGold', tx, ty); // right on the player
  const scoreBefore = s.score;
  let picked = false;
  for (let i = 0; i < 30 && !picked; i++) { eng.update(idle); if (s.keys?.includes('gold')) picked = true; }
  ok(picked, 'gold key picked up into session.keys');
  ok(s.score >= scoreBefore + 1000, 'key pickup scores 1000');

  // locked goal: refuses without the key, opens with it (key not consumed)
  (eng as any).spawnEntity({ type: 'goal', x: tx + 3, y: ty, lockColor: 'jade' } as EntitySpawn);
  const goal = (eng as any).ents.find((e: any) => e.kind === 'goal');
  ok(goal.variant === 'jade', 'locked goal spawned with the jade seal');
  p.x = goal.x; p.y = goal.y; p.vy = 0;
  for (let i = 0; i < 10; i++) eng.update(idle);
  ok((eng as any).phase === 'play', 'sealed goal refuses without the key');
  s.keys = ['jade'];
  let done = false;
  for (let i = 0; i < 20 && !done; i++) { eng.update(idle); if ((eng as any).phase === 'complete') done = true; }
  ok(done, 'matching key breaks the seal and completes the level');
  ok(s.keys.includes('jade'), 'key is NOT consumed by the seal');
}

// ---------- 7b. goal celebration keeps gravity ----------
console.log('Goal celebration gravity:');
{
  const { p } = cleanRoom();
  const tx = Math.floor(p.x / 16), ty = Math.floor(p.y / 16);
  (eng as any).spawnEntity({ type: 'goal', x: tx + 2, y: ty } as EntitySpawn);
  const goal = (eng as any).ents.find((e: any) => e.kind === 'goal');
  // touch the goal mid-jump: overlap it while airborne with upward velocity
  p.x = goal.x; p.y = goal.y - 40; p.vy = -6; p.onGround = false;
  let done = false;
  for (let i = 0; i < 20 && !done; i++) { eng.update(idle); if ((eng as any).phase === 'complete') done = true; }
  ok(done, 'airborne goal touch completes the level');
  const yAtGoal = p.y;
  for (let i = 0; i < 140; i++) eng.update(idle); // celebration walk
  ok(p.y > yAtGoal + 20, 'player falls to the ground during the celebration (no float-off)');
  ok(p.onGround, 'player is grounded by the end of the celebration');
}

// ---------- 8. EXTREME variants ----------
console.log('EXTREME variants:');
{
  const { s, p } = cleanRoom();
  const tx = Math.floor(p.x / 16), ty = Math.floor(p.y / 16);
  (eng as any).spawnEntity({ type: 'tortoiseGreen', x: tx + 3, y: ty, extreme: true } as EntitySpawn);
  const tor = (eng as any).ents.find((e: any) => e.kind === 'tortoise');
  ok(tor.extreme === true && Math.abs(tor.w - 14 * 1.6) < 0.01 && tor.hp === 2,
    `extreme tortoise: 1.6x size (${tor.w.toFixed(1)}w), 2 stomp HP`);
  // stomp 1: CRACK — stunned, not killed
  p.x = tor.x; p.y = tor.y - 40; p.vy = 2;
  for (let i = 0; i < 90 && tor.stun === 0; i++) eng.update(idle);
  ok(tor.stun > 0 && tor.kind === 'tortoise' && !tor.dead, 'extreme stomp 1: CRACK + stun, still alive');
  p.invuln = 100000; // observe safely during the stun
  for (let i = 0; i < 80 && tor.stun > 0; i++) eng.update(idle);
  // stomp 2: retreats into shell, 3x score
  p.x = tor.x; p.y = tor.y - 40; p.vy = 2;
  for (let i = 0; i < 90 && tor.kind === 'tortoise'; i++) eng.update(idle);
  ok(tor.kind === 'shell', 'extreme stomp 2: retreats into shell');
  ok(s.score >= 600, `extreme kill scores 3x (score=${s.score})`);
  p.invuln = 0;
}

// ---------- 9. Aztec enemies ----------
console.log('Aztec enemies:');
{
  // jaguar warrior: crouch-then-lunge when the player is near & level
  const { p } = cleanRoom();
  const tx = Math.floor(p.x / 16), ty = Math.floor(p.y / 16);
  spawn('jaguarWarrior', tx + 4, ty);
  const jw = (eng as any).ents.find((e: any) => e.kind === 'jaguarWarrior');
  p.invuln = 100000;
  let sawTell = false;
  for (let i = 0; i < 120 && !sawTell; i++) { eng.update(idle); if (jw.state === 'crouch' || jw.state === 'lunge') sawTell = true; }
  ok(sawTell, 'jaguar warrior telegraphs (crouch/lunge) when the player is near');
  p.invuln = 0;
}
{
  // serpent: sine bob, home-range reversal, no gravity
  const { p } = cleanRoom();
  const tx = Math.floor(p.x / 16), ty = Math.floor(p.y / 16);
  spawn('serpent', tx + 5, ty - 2);
  const ser = (eng as any).ents.find((e: any) => e.kind === 'serpent');
  p.invuln = 100000;
  let minY = ser.y, maxY = ser.y, minX = ser.x, maxX = ser.x, prevX = ser.x, flips = 0, lastDir = 0;
  for (let i = 0; i < 300; i++) {
    eng.update(idle);
    minY = Math.min(minY, ser.y); maxY = Math.max(maxY, ser.y);
    minX = Math.min(minX, ser.x); maxX = Math.max(maxX, ser.x);
    const dx = ser.x - prevX; prevX = ser.x;
    const d = Math.sign(dx);
    if (d !== 0 && lastDir !== 0 && d !== lastDir) flips++;
    if (d !== 0) lastDir = d;
  }
  ok(maxY - minY > 10 && maxY - minY < 60, `serpent sine-bobs (y range ${(maxY - minY).toFixed(1)}px)`);
  ok(flips >= 1 && maxX - minX > 40 && maxX - minX < 240,
    `serpent patrols + reverses in its home range (x span ${(maxX - minX).toFixed(1)}px, ${flips} reversals)`);
  ok(Math.abs(ser.y - ser.baseY) <= 22.5, 'serpent ignores gravity (stays on its sine path)');
  p.invuln = 0;
}
{
  // sentinel: fires arcing sun darts at a near player; ember-proof; stompable
  const { p } = cleanRoom();
  const tx = Math.floor(p.x / 16), ty = Math.floor(p.y / 16);
  spawn('sentinel', tx + 4, ty);
  const sen = (eng as any).ents.find((e: any) => e.kind === 'sentinel');
  ok(!!sen && sen.w === 24 && sen.h === 24, 'sentinel spawned (sun-stone turret)');
  p.invuln = 100000;
  let dartSeen = false;
  for (let i = 0; i < 260 && !dartSeen; i++) {
    eng.update(idle);
    if ((eng as any).ents.some((e: any) => e.kind === 'sunDart' && !e.remove)) dartSeen = true;
  }
  ok(dartSeen, 'sentinel fires sun darts at a nearby player');
  // ember-proof: an ember overlapping it fizzles out
  (eng as any).ents.push({
    kind: 'ember', x: sen.x, y: sen.y, w: 8, h: 8, vx: 0, vy: 0, onGround: false,
    dir: 1, frame: 0, state: 'fly', t: 60, dead: false, remove: false,
    hp: 1, baseY: 0, homeTx: 0, variant: '', target: '', extreme: false, stun: 0,
  });
  for (let i = 0; i < 20; i++) eng.update(idle);
  ok(!sen.dead && !sen.remove, 'sentinel is ember-proof (ember fizzles)');
  // stompable from above
  p.x = sen.x; p.y = sen.y - 40; p.vy = 2;
  let dead = false;
  for (let i = 0; i < 90 && !dead; i++) { eng.update(idle); if (sen.dead || sen.remove) dead = true; }
  ok(dead, 'sentinel can be stomped from above');
  p.invuln = 0;
}

// ---------- 10. audio (headless-safe) ----------
console.log('Audio:');
{
  const { AudioEngine } = await import('../src/game/audio');
  const a = new AudioEngine();
  let threw = false;
  try {
    a.sfx('jump'); a.sfx('bossRoar'); a.sfx('locked'); a.sfx('key');
    a.setMusic('lagoon'); a.setMusic('boss'); a.setMusic('title'); a.setMusic(null);
    a.toggleMute(); a.toggleMute(); a.resume();
  } catch (e) { threw = true; console.log('   audio error:', (e as Error).message); }
  ok(!threw && typeof a.muted === 'boolean', 'audio engine is headless-safe (no AudioContext)');
}

// ---------- 11. pyramid backgrounds & new-field JSON round-trip ----------
console.log('Backgrounds & serialization:');
{
  ok(!!tex.bg('overworld', 1) && !!tex.bg('boss', 1) && !!tex.bg('lagoon', 1),
    'pyramid background layers generate for overworld/boss/lagoon');
  const l = clone(BUILTIN_LEVELS[0]);
  l.entities.push({ type: 'keyGold', x: 10, y: 10 } as EntitySpawn);
  l.entities.push({ type: 'goal', x: 20, y: 17, lockColor: 'obsidian' } as EntitySpawn);
  l.entities.push({ type: 'beetle', x: 30, y: 17, extreme: true } as EntitySpawn);
  const rt = JSON.parse(JSON.stringify(l));
  ok(rt.entities.some((e: any) => e.type === 'keyGold'), 'JSON round-trip: key entity preserved');
  ok(rt.entities.some((e: any) => e.type === 'goal' && e.lockColor === 'obsidian'), 'JSON round-trip: goal lockColor preserved');
  ok(rt.entities.some((e: any) => e.type === 'beetle' && e.extreme === true), 'JSON round-trip: extreme flag preserved');
  ok(BUILTIN_LEVELS[3].entities.some((e: any) => e.type === 'keyGold'), '1-4 Azure Lagoon hides a sunken gold key');

  // editor: sealed goal + EXTREME enemy brushes
  const s7: SessionState = { score: 0, coins: 0, lives: 3, levelName: '' };
  eng.startLevel(clone(BUILTIN_LEVELS[0]), s7);
  eng.enterEditor();
  eng.editorGoalLock = 'gold';
  eng.editorSel = { kind: 'entity', entity: 'goal' };
  eng.editorPlace(22, 17);
  ok((eng as any).level.entities.some((e: any) => e.type === 'goal' && e.x === 22 && e.lockColor === 'gold'),
    'editor places a sealed goal with the chosen lock');
  eng.editorGoalLock = '';
  eng.editorExtreme = true;
  eng.editorSel = { kind: 'entity', entity: 'jaguarWarrior' };
  eng.editorPlace(24, 17);
  ok((eng as any).level.entities.some((e: any) => e.type === 'jaguarWarrior' && e.x === 24 && e.extreme === true),
    'editor places an EXTREME enemy with the checkbox on');
  eng.editorExtreme = false;
  eng.exitEditor(false);
}

// ---------- 12. soft-lock guards (Issue A) ----------
console.log('Soft-lock guards:');
{
  const esc = () => controller.handleKeyDown({ key: 'Escape', target: null, preventDefault: () => {} } as any);
  const key = (k: string) => controller.handleKeyDown({ key: k, target: null, preventDefault: () => {} } as any);
  const freshRun = () => {
    controller.engine = eng;
    controller.world = { name: 'W', levels: [clone(BUILTIN_LEVELS[0]), clone(BUILTIN_LEVELS[1])] };
    controller.levelIndex = 0;
    controller.session = { score: 50, coins: 1, lives: 2, levelName: '' };
    controller.warpStack = [];
    controller.testPlay = false;
    controller.screen = 'game';
    controller.overlay = 'none';
    (controller as any).currentLevel = controller.world.levels[0];
    if (eng.editorMode) eng.exitEditor(false);
    eng.startLevel(clone(BUILTIN_LEVELS[0]), controller.session);
  };

  // A1: Escape during the level-transition splash skips it — never a dead screen
  freshRun();
  (controller as any).beginLevelWithTransition();
  ok(controller.overlay === 'transition', 'transition splash shown');
  esc();
  ok(controller.overlay === 'none', 'Escape skips the transition splash');
  ok((controller as any).transitionTimer === null, 'transition timer cleared (no orphan timer)');
  ok((eng as any).level?.name === '1-1 Emerald Floor' && (eng as any).phase === 'play',
    'gameplay begins immediately after the skip');
  esc();
  ok(controller.overlay === 'pause', 'pause still opens after the skip');
  esc();
  ok(controller.overlay === 'none', 'pause still closes after the skip');

  // A2: warp round-trip with a pause injected mid-sequence returns playable
  freshRun();
  controller.handleWarp('1-2 Sunken Grotto', 40 * 16, 9 * 16);
  ok((eng as any).level.name === '1-2 Sunken Grotto' && controller.warpStack.length === 1, 'warped away (stack 1)');
  controller.overlay = 'pause'; // user pauses mid-trip…
  (controller as any).handleLevelComplete(); // …and the completion signal arrives while paused
  ok(controller.overlay === 'none', 'warp return force-resolves to a playable overlay');
  ok((eng as any).level.name === '1-1 Emerald Floor' && (eng as any).phase === 'play',
    'back at the origin level in play phase');
  ok(controller.warpStack.length === 0 && controller.session.score === 50, 'stack drained, session intact');
  esc();
  ok(controller.overlay === 'pause', 'pause opens post-return');
  esc();
  ok(controller.overlay === 'none', 'pause closes post-return');

  // A3: every overlay has at least one keyboard or self-clearing exit
  const OVERLAYS = ['pause', 'glitch', 'transition', 'levelComplete', 'gameOver', 'worldComplete'];
  for (const ov of OVERLAYS) {
    freshRun();
    if (ov === 'transition') (controller as any).beginLevelWithTransition();
    else controller.overlay = ov as typeof controller.overlay;
    ok(controller.overlay === ov, `audit: ${ov} shown`);
    esc();
    ok(controller.overlay !== ov || controller.screen !== 'game',
      `audit: Escape exits ${ov} (overlay=${controller.overlay}, screen=${controller.screen})`);
    controller.screen = 'game';
    controller.overlay = 'none';
  }

  // Enter advances the Level Clear panel; Escape skips the resulting splash
  freshRun();
  controller.overlay = 'levelComplete';
  key('Enter');
  ok(controller.overlay === 'transition', 'Enter on Level Clear starts the next-level transition');
  esc();
  ok(controller.overlay === 'none' && (eng as any).level.name === '1-2 Sunken Grotto' && controller.levelIndex === 1,
    'skipping the splash lands in the next level');
  ok((controller as any).transitionTimer === null, 'no orphan timer after Enter+skip');

  // A4: standalone completion (no world) shows an end panel instead of
  // leaving the engine spinning in the 'complete' phase with no overlay
  controller.world = null;
  controller.warpStack = [];
  controller.testPlay = false;
  controller.screen = 'game';
  controller.overlay = 'none';
  (controller as any).currentLevel = null;
  (controller as any).handleLevelComplete();
  ok(controller.overlay === 'worldComplete', 'standalone completion shows an end panel (no complete-phase spin)');
  esc();
  ok(controller.screen === 'title' && controller.overlay === 'none', 'end panel exitable via Escape');
  controller.screen = 'game';
  controller.world = null;
}

// ---------- 13. volume control (Issue B) ----------
console.log('Volume control:');
{
  const { AudioEngine: AE } = await import('../src/game/audio');
  const a = new AE();
  let threw = false;
  try {
    a.setVolume(0.5);
    a.setVolume(2);
    a.setVolume(-1);
    a.cycleVolume();
  } catch (e) { threw = true; console.log('   volume error:', (e as Error).message); }
  ok(!threw, 'setVolume/cycleVolume headless-safe (no throw)');
  a.setVolume(0.5);
  ok(Math.abs(a.volume - 0.5) < 1e-9, 'setVolume stores 0.5');
  a.setVolume(2);
  ok(a.volume === 1, 'setVolume clamps high');
  a.setVolume(-1);
  ok(a.volume === 0, 'setVolume clamps low');
  a.setVolume(1);
  ok(Math.abs(a.cycleVolume() - 0.75) < 1e-9, 'cycleVolume steps 100% -> 75%');
  a.cycleVolume(); a.cycleVolume(); a.cycleVolume(); // 0.5 -> 0.25 -> 0
  ok(a.volume === 0, 'cycleVolume reaches 0%');
  ok(a.cycleVolume() === 1, 'cycleVolume wraps 0% -> 100%');

  // persistence across instances via a fake localStorage
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
  };
  const a1 = new AE();
  a1.setVolume(0.42);
  const a2 = new AE();
  ok(Math.abs(a2.volume - 0.42) < 1e-9, 'volume persists across instances (localStorage)');
  a2.setMuted(true);
  const a3 = new AE();
  ok(a3.muted === true && Math.abs(a3.volume - 0.42) < 1e-9, 'mute persists; volume survives muting');
  (globalThis as any).localStorage = undefined;
}

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
