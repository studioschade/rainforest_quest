// The five built-in levels, hand-crafted with builder helpers (same schema as editor saves).
import { TILE, LEVEL_HEIGHT, emptyLevel } from './types';
import type { LevelData, Theme, EntityType } from './types';

const T = TILE;
const GROUND_ROW = 18; // top row of the ground in flat levels
const H = LEVEL_HEIGHT; // 24

function set(l: LevelData, x: number, y: number, t: number): void {
  if (x >= 0 && x < l.width && y >= 0 && y < l.height) l.tiles[y][x] = t;
}

function fill(l: LevelData, x: number, y: number, w: number, h: number, t: number): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(l, xx, yy, t);
}

/** Solid ground column: grass/leaves/stone top with dirt fill to the bottom. */
function ground(l: LevelData, x: number, w: number, top: number = GROUND_ROW, topTile: number = T.Ground, fillTile: number = T.Dirt): void {
  fill(l, x, top, w, 1, topTile);
  fill(l, x, top + 1, w, H - top - 1, fillTile);
}

function ent(l: LevelData, type: EntityType, x: number, y: number, target?: string): void {
  l.entities.push(target ? { type, x, y, target } : { type, x, y });
}

/** A row of coins. */
function coinRow(l: LevelData, x: number, y: number, n: number): void {
  for (let i = 0; i < n; i++) ent(l, 'coin', x + i, y);
}

/** Staircase of blocks. dir 1 = up to the right, -1 = down to the right. */
function stairs(l: LevelData, x: number, baseY: number, steps: number, dir: 1 | -1, tile: number = T.Stone): void {
  for (let i = 0; i < steps; i++) {
    const h = dir === 1 ? i + 1 : steps - i;
    fill(l, x + i, baseY - h + 1, 1, h, tile);
  }
}

function blank(name: string, theme: Theme, width: number): LevelData {
  const l = emptyLevel(name, theme, width);
  l.entities = [];
  l.builtin = true;
  return l;
}

// ======================================================================
// 1-1 Emerald Floor (overworld) — gentle intro, ~200 tiles wide
// ======================================================================
function build11(): LevelData {
  const l = blank('1-1 Emerald Floor', 'overworld', 200);
  ground(l, 0, 30);
  ground(l, 33, 22);
  ground(l, 58, 26);
  ground(l, 87, 30);
  ground(l, 120, 24);
  ground(l, 147, 53); // to the end

  ent(l, 'playerStart', 2, GROUND_ROW - 2);

  // early question blocks
  set(l, 14, 13, T.Question);
  set(l, 18, 13, T.Brick); set(l, 19, 13, T.Question); set(l, 20, 13, T.Brick);
  ent(l, 'beetle', 22, GROUND_ROW - 1);

  // decorative foliage
  set(l, 6, GROUND_ROW - 1, T.Foliage); set(l, 26, GROUND_ROW - 1, T.Foliage);
  set(l, 40, GROUND_ROW - 1, T.Foliage); set(l, 71, GROUND_ROW - 1, T.Foliage);
  set(l, 96, GROUND_ROW - 1, T.Foliage); set(l, 135, GROUND_ROW - 1, T.Foliage);

  // first gap (x 30-32), then blocks after it
  ent(l, 'beetle', 36, GROUND_ROW - 1);
  set(l, 38, 13, T.Question);

  // new powerups sprinkled through the jungle
  ent(l, 'emberChili', 44, GROUND_ROW - 2);
  ent(l, 'coinCapuchin', 126, GROUND_ROW - 2);
  ent(l, 'goldenBanana', 162, GROUND_ROW - 2);

  // coin arc over the second gap (55-57)
  coinRow(l, 54, 12, 4);

  // brick + question cluster w/ hidden bloom block
  set(l, 62, 13, T.Brick); set(l, 63, 13, T.Question); set(l, 64, 13, T.Brick); set(l, 65, 13, T.Question); set(l, 66, 13, T.Brick);
  set(l, 64, 9, T.Question); // high block
  ent(l, 'tortoiseGreen', 74, GROUND_ROW - 2);

  // hollow log with flytrap
  fill(l, 80, GROUND_ROW - 2, 2, 2, T.LogBody);
  set(l, 80, GROUND_ROW - 3, T.LogTop); set(l, 81, GROUND_ROW - 3, T.LogTop);
  fill(l, 80, GROUND_ROW - 4, 2, 1, T.Empty);
  ent(l, 'flytrap', 80, GROUND_ROW - 3);

  // bonus area: wooden platforms with coins
  fill(l, 90, 13, 4, 1, T.Wood);
  coinRow(l, 90, 12, 4);
  fill(l, 96, 10, 4, 1, T.Wood);
  coinRow(l, 96, 9, 3);
  // hidden Mayan warp jar on the high bonus platform — skips ahead to the lagoon
  ent(l, 'warpJar', 99, 9, '1-4 Azure Lagoon');
  set(l, 98, 6, T.Question);
  ent(l, 'macawWings', 98, 8);

  // stairs up + gap
  stairs(l, 106, GROUND_ROW - 1, 4, 1);
  // gap 117-119 with cloud platform
  fill(l, 117, 14, 3, 1, T.Cloud);
  coinRow(l, 117, 13, 3);

  // twin beetles + tortoise gauntlet
  ent(l, 'beetle', 124, GROUND_ROW - 1);
  ent(l, 'beetle', 127, GROUND_ROW - 1);
  ent(l, 'tortoiseGreen', 133, GROUND_ROW - 2);

  // question row with vines decor
  set(l, 138, 13, T.Question); set(l, 140, 13, T.Question); set(l, 142, 13, T.Question);
  fill(l, 139, 8, 1, 5, T.Vine); fill(l, 143, 8, 1, 5, T.Vine);

  // checkpoint
  ent(l, 'checkpoint', 147, GROUND_ROW - 2);

  // final stretch: log + flytrap, stairs to goal
  fill(l, 154, GROUND_ROW - 2, 2, 2, T.LogBody);
  set(l, 154, GROUND_ROW - 3, T.LogTop); set(l, 155, GROUND_ROW - 3, T.LogTop);
  ent(l, 'flytrap', 155, GROUND_ROW - 3);
  ent(l, 'beetle', 160, GROUND_ROW - 1);
  set(l, 164, 13, T.Brick); set(l, 165, 13, T.Question); set(l, 166, 13, T.Brick);
  stairs(l, 172, GROUND_ROW - 1, 5, 1);
  // big gap then goal plateau
  ground(l, 182, 18, 14);
  coinRow(l, 184, 13, 3);
  ent(l, 'goal', 190, 14 - 1);
  return l;
}

// ======================================================================
// 1-2 Sunken Grotto (underworld) — lava, piranhas, armadillos, bridges
// ======================================================================
function build12(): LevelData {
  const l = blank('1-2 Sunken Grotto', 'underworld', 160);
  const top = 18;
  const st = (x: number, w: number, t = top) => ground(l, x, w, t, T.Stone, T.Temple);

  st(0, 24);
  st(28, 14);
  st(46, 18);
  st(68, 10);
  st(82, 20);
  st(106, 14);
  st(124, 36);

  ent(l, 'playerStart', 2, top - 2);

  // ceiling for cavern feel (sparse)
  fill(l, 0, 0, l.width, 2, T.Stone);
  for (let x = 10; x < l.width - 10; x += 17) fill(l, x, 2, 4, 1, T.Stone);

  // lava pool 24-27 with crumbling bridge
  fill(l, 24, top + 2, 4, H - top - 2, T.Lava);
  fill(l, 24, top - 1, 4, 1, T.Bridge);
  ent(l, 'armadillo', 30, top - 1);

  // question blocks
  set(l, 33, 13, T.Question); set(l, 35, 13, T.Brick); set(l, 37, 13, T.Question);
  ent(l, 'frogSuit', 34, top - 2);

  // water pool 42-45 with leaping piranhas
  fill(l, 42, top, 4, H - top, T.Water);
  ent(l, 'piranha', 43, top + 2);
  // wooden platform across
  fill(l, 42, 13, 4, 1, T.Wood);
  coinRow(l, 42, 12, 4);

  // beetle cave patrol
  ent(l, 'beetle', 50, top - 1);
  ent(l, 'armadillo', 56, top - 1);
  set(l, 52, 13, T.Brick); set(l, 53, 13, T.Question); set(l, 54, 13, T.Brick);

  // lava pit 64-67, jump across via stone pillar
  fill(l, 64, top + 1, 4, H - top - 1, T.Lava);
  fill(l, 65, top - 2, 2, 2, T.Stone);

  // spikes section
  fill(l, 70, top - 1, 4, 1, T.Spikes);
  fill(l, 70, 13, 4, 1, T.Wood);
  coinRow(l, 70, 12, 4);

  ent(l, 'checkpoint', 78, top - 2);

  // second water crossing, two piranhas
  fill(l, 78, top, 4, H - top, T.Empty); // restore gap region handled above; carve real water pool:
  st(78, 4); // small island before the pool
  fill(l, 102, top, 4, H - top, T.Water);
  ent(l, 'piranha', 103, top + 2);
  ent(l, 'piranha', 104, top + 3);
  fill(l, 102, 12, 4, 1, T.Wood);

  // long lava lake 84-101 with bridge segments and gaps
  fill(l, 84, top + 2, 18, H - top - 2, T.Lava);
  fill(l, 84, top - 1, 6, 1, T.Bridge);
  fill(l, 92, top - 1, 4, 1, T.Bridge);
  fill(l, 98, top - 1, 4, 1, T.Bridge);
  fill(l, 90, top - 1, 2, 1, T.Stone);
  fill(l, 96, top - 1, 2, 1, T.Stone);
  ent(l, 'armadillo', 86, top - 2);

  // grotto treasures
  set(l, 108, 13, T.Question); set(l, 110, 13, T.Question); set(l, 112, 13, T.Brick);
  fill(l, 109, 9, 3, 1, T.Wood); coinRow(l, 109, 8, 3);
  ent(l, 'shrinkberry', 108, top - 2);
  ent(l, 'thunderMango', 130, top - 2);

  // tight jumps on stone pillars
  fill(l, 120, top - 2, 2, 2, T.Stone);
  fill(l, 122, top - 3, 2, 3, T.Stone);
  // (124+ is solid ground already)
  ent(l, 'beetle', 128, top - 1);
  ent(l, 'tortoiseRed', 134, top - 2);

  // final gauntlet: spikes + flytrap log
  fill(l, 138, top - 1, 3, 1, T.Spikes);
  fill(l, 137, 13, 5, 1, T.Wood);
  fill(l, 144, top - 2, 2, 2, T.LogBody);
  set(l, 144, top - 3, T.LogTop); set(l, 145, top - 3, T.LogTop);
  ent(l, 'flytrap', 144, top - 3);

  // tucked-away warp jar after the spikes — foliage + coins hint at the secret
  set(l, 141, top - 1, T.Foliage);
  ent(l, 'warpJar', 142, top - 1, '1-3 Canopy Heights');
  coinRow(l, 141, 15, 3);

  stairs(l, 148, top - 1, 4, 1, T.Temple);
  ground(l, 152, 8, 15, T.Stone, T.Temple);
  ent(l, 'goal', 155, 14);
  return l;
}

// ======================================================================
// 1-3 Canopy Heights (canopy) — treetop platforms, verticality, eagles
// ======================================================================
function build13(): LevelData {
  const l = blank('1-3 Canopy Heights', 'canopy', 150);
  const leaf = (x: number, y: number, w: number) => fill(l, x, y, w, 1, T.Leaves);
  const wood = (x: number, y: number, w: number) => fill(l, x, y, w, 1, T.Wood);
  const cloud = (x: number, y: number, w: number) => fill(l, x, y, w, 1, T.Cloud);

  // starting branch (low, right side of view)
  leaf(0, 18, 10); fill(l, 0, 19, 10, 2, T.Leaves);
  ent(l, 'playerStart', 2, 16);

  // ascending platforms
  wood(12, 16, 4);
  leaf(18, 15, 5);
  cloud(25, 13, 3);
  wood(30, 11, 4); coinRow(l, 30, 10, 3);
  leaf(36, 13, 6);
  ent(l, 'monkey', 38, 12);

  // canopy road with durian
  leaf(44, 15, 8);
  ent(l, 'durian', 48, 14);
  cloud(54, 12, 3);
  leaf(59, 10, 5); coinRow(l, 59, 9, 4);
  wood(66, 13, 3);
  leaf(71, 15, 7);
  ent(l, 'monkey', 74, 14);

  // eagle patrol zone
  ent(l, 'eagle', 60, 4);

  // high detour with bonus
  cloud(80, 9, 3); cloud(85, 7, 3);
  leaf(90, 8, 4); coinRow(l, 90, 7, 4);
  set(l, 91, 4, T.Question);
  ent(l, 'macawWings', 60, 8);

  // main path continues
  wood(80, 13, 4);
  leaf(86, 15, 6);
  ent(l, 'durian', 89, 14);
  cloud(94, 12, 3);
  leaf(99, 14, 8);
  ent(l, 'monkey', 102, 13);
  ent(l, 'checkpoint', 105, 12);
  ent(l, 'grasshopperLegs', 100, 12);

  // drop-down section with vines
  fill(l, 108, 6, 1, 8, T.Vine); fill(l, 110, 6, 1, 8, T.Vine);
  leaf(109, 17, 5);
  wood(116, 15, 3);
  cloud(121, 13, 3);
  leaf(126, 15, 6);
  ent(l, 'eagle', 122, 5);
  ent(l, 'jaguarPelt', 128, 13);

  // final ascent to the goal nest
  wood(133, 12, 3);
  leaf(137, 10, 5);
  fill(l, 141, 11, 6, 1, T.Leaves);
  fill(l, 141, 12, 6, 8, T.Leaves);
  ent(l, 'goal', 143, 9);
  return l;
}

// ======================================================================
// 1-4 Azure Lagoon (lagoon) — sandy beach, swim basins, sunken temple
// ======================================================================
function buildLagoon(): LevelData {
  const l = blank('1-4 Azure Lagoon', 'lagoon', 150);
  const top = 18;
  const sand = (x: number, w: number, t = top) => ground(l, x, w, t, T.Sand, T.Dirt);

  // one long sand bed; swim basins are carved into it
  sand(0, 150);
  /** Carve a swim basin: SwimWater from depthRow down, sandy floor on the last 2 rows. */
  const basin = (x: number, w: number, depthRow: number) => {
    fill(l, x, depthRow, w, H - depthRow, T.SwimWater);
    fill(l, x, H - 2, w, 2, T.Sand);
  };

  ent(l, 'playerStart', 2, top - 2);

  // ---- opening beach (x 0-25) ----
  set(l, 6, top - 1, T.Foliage); set(l, 20, top - 1, T.Foliage);
  set(l, 10, 13, T.Question);
  set(l, 14, 13, T.Brick); set(l, 15, 13, T.Question); set(l, 16, 13, T.Brick);
  ent(l, 'beetle', 22, top - 1);

  // ---- first swim basin (x 26-41): learn the strokes ----
  basin(26, 16, 15);
  coinRow(l, 28, 18, 5);            // underwater trail
  coinRow(l, 30, 21, 4);            // deeper trail
  ent(l, 'swimfish', 32, 18);
  ent(l, 'swimfish', 37, 20);
  fill(l, 33, 12, 4, 1, T.Wood);    // mangrove platform over the middle
  coinRow(l, 33, 11, 4);
  ent(l, 'keyGold', 40, 21);        // temple key sunk in the deep corner (warp arrival from 1-1)

  // ---- island with the frog suit (x 42-47) ----
  fill(l, 43, 14, 4, 1, T.Wood);
  coinRow(l, 43, 13, 4);
  ent(l, 'frogSuit', 44, top - 2);
  ent(l, 'checkpoint', 46, top - 2);
  set(l, 47, top - 1, T.Foliage);

  // ---- sunken temple (x 48-100): deep water, ruins, swimfish schools ----
  basin(48, 53, 14);
  ent(l, 'piranha', 50, 16);        // leaps at the entry gap
  // drowned pillars
  for (const px of [56, 64, 84, 92]) fill(l, px, 17, 2, 5, T.Temple);
  // collapsed wall you swim UNDER (rows 20-21 stay open)
  fill(l, 72, 15, 6, 5, T.Temple);
  coinRow(l, 73, 20, 4);            // tunnel reward
  // schools
  ent(l, 'swimfish', 52, 17);
  ent(l, 'swimfish', 55, 19);
  ent(l, 'swimfish', 62, 16);
  ent(l, 'swimfish', 68, 19);
  ent(l, 'swimfish', 86, 17);
  ent(l, 'swimfish', 90, 19);
  // coin trails through the ruins
  coinRow(l, 50, 18, 5);
  coinRow(l, 58, 21, 6);
  coinRow(l, 66, 17, 4);
  coinRow(l, 80, 21, 6);
  coinRow(l, 94, 18, 4);
  // ledges above the surface
  fill(l, 52, 12, 4, 1, T.Wood);
  fill(l, 60, 12, 3, 1, T.Stone);
  ent(l, 'bloom', 61, 11);          // placed Spirit Bloom
  fill(l, 76, 11, 4, 1, T.Wood);
  coinRow(l, 76, 10, 4);
  fill(l, 86, 12, 3, 1, T.Stone);
  set(l, 87, 11, T.Question);
  ent(l, 'piranha', 96, 16);        // leaps at the exit gap

  // ---- exit beach (x 101-110) ----
  set(l, 104, top - 1, T.Foliage);
  stairs(l, 105, top - 1, 3, 1, T.Sand);
  set(l, 108, 13, T.Question);

  // ---- third basin (x 111-126): piranha + fish gauntlet ----
  basin(111, 16, 15);
  ent(l, 'swimfish', 114, 18);
  ent(l, 'swimfish', 118, 20);
  ent(l, 'swimfish', 122, 17);
  ent(l, 'piranha', 124, 16);
  coinRow(l, 112, 20, 6);
  fill(l, 116, 12, 4, 1, T.Wood);
  coinRow(l, 116, 11, 4);

  // ---- final stretch to the totem (x 127-149) ----
  ent(l, 'beetle', 129, top - 1);
  fill(l, 131, 15, 3, 1, T.Wood);
  fill(l, 135, 13, 3, 1, T.Wood);
  coinRow(l, 135, 12, 3);
  set(l, 140, 13, T.Question);
  set(l, 132, top - 1, T.Foliage);
  ent(l, 'goal', 145, top - 1);
  return l;
}

// ======================================================================
// 1-5 Idol's Sanctum (boss) — temple approach + Cursed Idol arena
// ======================================================================
function build14(): LevelData {
  const l = blank("1-5 Idol's Sanctum", 'boss', 110);
  const top = 18;
  const temple = (x: number, w: number, t = top) => ground(l, x, w, t, T.Temple, T.Stone);

  temple(0, 46);
  ent(l, 'playerStart', 2, top - 2);

  // approach: ruins + enemies
  set(l, 10, 13, T.Question);
  ent(l, 'armadillo', 14, top - 1);
  fill(l, 18, top - 3, 2, 3, T.Temple); // broken pillar
  fill(l, 24, top - 4, 2, 4, T.Temple);
  coinRow(l, 24, top - 6, 2);
  ent(l, 'tortoiseRed', 28, top - 2);
  set(l, 32, 13, T.Brick); set(l, 33, 13, T.Question); set(l, 34, 13, T.Brick);
  ent(l, 'beetle', 37, top - 1);
  ent(l, 'checkpoint', 42, top - 2);
  ent(l, 'emberChili', 30, top - 2); // a fighting chance before the idol
  fill(l, 44, top - 1, 2, 1, T.Foliage);

  // ---- arena: pit of lava from x=48 to x=100, crumbling bridge across ----
  fill(l, 46, top - 1, 2, H - top + 1, T.Temple); // arena entry ledge
  fill(l, 48, top + 3, 54, H - top - 3, T.Lava);
  // bridge deck at top-1 (reaches the axe platform so the idol won't suicide-hop into lava)
  fill(l, 48, top - 1, 52, 1, T.Bridge);
  // stone pillars poking out of lava (decor)
  fill(l, 56, top + 1, 3, 2, T.Temple);
  fill(l, 78, top + 1, 3, 2, T.Temple);

  // boss + arena end platform with the Jade Axe resting on the ground
  ent(l, 'boss', 70, top - 5);
  fill(l, 100, top - 1, 10, 1, T.Temple);
  fill(l, 100, top, 10, H - top, T.Temple);
  ent(l, 'axe', 104, top - 2);

  // torches (foliage accents as braziers)
  set(l, 47, top - 2, T.Foliage);
  set(l, 99, top - 2, T.Foliage);
  return l;
}

export const BUILTIN_LEVELS: LevelData[] = [build11(), build12(), build13(), buildLagoon(), build14()];

export const BUILTIN_WORLD: { name: string; levels: LevelData[] } = {
  name: 'The Rainforest Saga',
  levels: BUILTIN_LEVELS,
};
