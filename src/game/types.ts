// Rainforest Quest — shared type definitions
// (No TS enums: project builds with erasableSyntaxOnly, so we use const objects + union types.)

export const TILE = {
  Empty: 0,
  Ground: 1, // grass-topped ground
  Dirt: 2,
  Brick: 3, // mossy stone brick (bump / break when big)
  Question: 4, // golden carved "?" block
  QuestionUsed: 5,
  Stone: 6, // solid stone block
  LogTop: 7, // hollow log opening (flytrap emerges)
  LogBody: 8, // hollow log segment
  Vine: 9, // decorative climbable-look vine (non-solid)
  Wood: 10, // wooden one-way platform
  Cloud: 11, // canopy one-way platform
  Lava: 12, // deadly, animated
  Water: 13, // deadly to fall into (piranha pools)
  Spikes: 14, // deadly
  Bridge: 15, // crumbling bridge
  Leaves: 16, // solid canopy leaf block
  Foliage: 17, // decorative background foliage (non-solid)
  Temple: 18, // ancient carved temple block (solid)
  GongTile: 19, // decorative gong stand block (solid) — visual base under gong entity
  SwimWater: 20, // swimmable water (NOT lethal — distinct from Water)
  Sand: 21, // sandy lagoon ground (solid)
} as const;
export type TileId = (typeof TILE)[keyof typeof TILE];

export const SOLID_TILES: ReadonlySet<number> = new Set([
  TILE.Ground, TILE.Dirt, TILE.Brick, TILE.Question, TILE.QuestionUsed,
  TILE.Stone, TILE.LogTop, TILE.LogBody, TILE.Bridge, TILE.Leaves, TILE.Temple, TILE.GongTile,
  TILE.Sand,
]);
export const ONEWAY_TILES: ReadonlySet<number> = new Set([TILE.Wood, TILE.Cloud]);
// NOTE: plain Water stays LETHAL (1-2 depends on it). SwimWater is the safe one.
export const HAZARD_TILES: ReadonlySet<number> = new Set([TILE.Lava, TILE.Water, TILE.Spikes]);

export type Theme = 'overworld' | 'underworld' | 'canopy' | 'boss' | 'lagoon';

export const THEMES: { id: Theme; label: string }[] = [
  { id: 'overworld', label: 'Emerald Overworld' },
  { id: 'underworld', label: 'Sunken Grotto' },
  { id: 'canopy', label: 'Canopy Heights' },
  { id: 'lagoon', label: 'Azure Lagoon' },
  { id: 'boss', label: "Idol's Sanctum" },
];

// Entity types placeable in levels / spawned at runtime
export type EntityType =
  | 'playerStart'
  | 'beetle' // Mossback Beetle (goomba)
  | 'tortoiseGreen' // Shellback Tortoise (koopa, walks off ledges)
  | 'tortoiseRed' // turns at ledges
  | 'flytrap' // Snapjaw Flytrap (piranha plant, sits on a log)
  | 'monkey' // Coconut Monkey (hammer bro)
  | 'eagle' // Harpy Eagle (lakitu)
  | 'durian' // Spiky Durian (spiny)
  | 'armadillo' // Armadillo (buzzy beetle)
  | 'piranha' // Leaping Piranha (cheep cheep)
  | 'bloom' // Spirit Bloom powerup
  | 'coin'
  | 'checkpoint'
  | 'goal' // goal totem
  | 'gong' // sacred gong (legacy boss win switch)
  | 'axe' // jade axe pickup — fells the boss on touch
  | 'boss' // The Cursed Idol
  // FORM powerups
  | 'emberChili'
  | 'frogSuit'
  | 'kapokAnvil'
  // TIMED powerups
  | 'macawWings'
  | 'jaguarPelt'
  | 'rainbowOrchid'
  | 'grasshopperLegs'
  | 'shrinkberry'
  | 'coinCapuchin'
  // INSTANT powerups
  | 'goldenBanana'
  | 'thunderMango'
  // lagoon + warp + glitch powerup additions
  | 'swimfish' // River Cheep analog — swims in SwimWater
  | 'staticStarfruit' // glitch fruit powerup
  | 'warpJar' // Mayan warp jar — stand on top + press DOWN
  // colored keys (session inventory, unlock matching goal seals)
  | 'keyJade'
  | 'keyGold'
  | 'keyObsidian'
  // Aztec enemies
  | 'jaguarWarrior' // patrols, crouches, lunges
  | 'serpent' // Feathered Serpent — flying sine patrol
  | 'sentinel'; // Sun Stone Sentinel — stationary dart turret

/** Key/seal colors for colored keys + locked goals. */
export type KeyColor = 'jade' | 'gold' | 'obsidian';
export const KEY_INFO: Record<KeyColor, { label: string; color: string }> = {
  jade: { label: 'Jade Key', color: '#3fae8a' },
  gold: { label: 'Gold Key', color: '#f2b632' },
  obsidian: { label: 'Obsidian Key', color: '#8a5ad6' },
};

export type FormType = 'none' | 'ember' | 'frog' | 'anvil';

/** Timed effect keys and their durations in frames (60fps). */
export const TIMED_EFFECTS = {
  wings: { label: 'Macaw Wings', duration: 720 },
  jaguar: { label: 'Jaguar Pelt', duration: 600 },
  orchid: { label: 'Rainbow Orchid', duration: 480 },
  legs: { label: 'Grasshopper Legs', duration: 840 },
  shrink: { label: 'Shrinkberry', duration: 900 },
  capuchin: { label: 'Coin Capuchin', duration: 1200 },
} as const;
export type TimedKey = keyof typeof TIMED_EFFECTS;

/** Entity type -> pickup effect mapping for the 11 powerups + bloom. */
export const POWERUP_INFO: Record<string, { name: string; category: 'form' | 'timed' | 'instant' }> = {
  bloom: { name: 'Spirit Bloom', category: 'form' },
  emberChili: { name: 'Ember Chili', category: 'form' },
  frogSuit: { name: 'Tree Frog Suit', category: 'form' },
  kapokAnvil: { name: 'Kapok Anvil', category: 'form' },
  macawWings: { name: 'Macaw Wings', category: 'timed' },
  jaguarPelt: { name: 'Jaguar Pelt', category: 'timed' },
  rainbowOrchid: { name: 'Rainbow Orchid', category: 'timed' },
  grasshopperLegs: { name: 'Grasshopper Legs', category: 'timed' },
  shrinkberry: { name: 'Shrinkberry', category: 'timed' },
  coinCapuchin: { name: 'Coin Capuchin', category: 'timed' },
  goldenBanana: { name: 'Golden Banana', category: 'instant' },
  thunderMango: { name: 'Thunder Mango', category: 'instant' },
  staticStarfruit: { name: 'Static Starfruit', category: 'instant' },
};

export interface EntitySpawn {
  type: EntityType;
  x: number; // tile coords
  y: number;
  target?: string; // warpJar destination: level name, or "world:<name>" (missing -> default)
  lockColor?: KeyColor; // goal seal: requires the matching key to finish (missing -> unlocked)
  extreme?: boolean; // EXTREME enemy variant: bigger, faster, tougher, weirder
}

export interface LevelData {
  id: string;
  name: string;
  theme: Theme;
  width: number; // tiles
  height: number; // tiles
  tiles: number[][]; // [row][col], row 0 = top
  entities: EntitySpawn[];
  builtin?: boolean;
}

export interface WorldData {
  name: string;
  levels: LevelData[];
}

export const LEVEL_HEIGHT = 24; // all levels share this height (view shows 18 rows)

export function emptyLevel(name: string, theme: Theme, width: number): LevelData {
  const tiles: number[][] = [];
  for (let r = 0; r < LEVEL_HEIGHT; r++) tiles.push(new Array<number>(width).fill(TILE.Empty));
  return {
    id: 'lvl_' + Math.random().toString(36).slice(2, 10),
    name,
    theme,
    width,
    height: LEVEL_HEIGHT,
    tiles,
    entities: [{ type: 'playerStart', x: 3, y: LEVEL_HEIGHT - 4 }],
  };
}

export function tileAt(level: LevelData, tx: number, ty: number): number {
  if (tx < 0 || tx >= level.width) return TILE.Stone; // world sides are solid
  if (ty < 0 || ty >= level.height) return TILE.Empty;
  return level.tiles[ty][tx];
}
