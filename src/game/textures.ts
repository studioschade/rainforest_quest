// Procedural pixel-art texture generation — every asset in the game is painted
// here at runtime onto offscreen canvases (16x16 base grid). No external assets.

export type TexAtlas = {
  get(name: string): HTMLCanvasElement;
  bg(theme: string, layer: number): HTMLCanvasElement;
};

// ---------- helpers ----------
type Ctx = CanvasRenderingContext2D;

function mk(w: number, h: number, fn: (c: Ctx) => void): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  fn(c);
  return cv;
}

function px(c: Ctx, x: number, y: number, w: number, h: number, col: string): void {
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
}

// deterministic pseudo-random for texture noise
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noise(c: Ctx, w: number, h: number, seed: number, cols: string[], density: number): void {
  const rnd = mulberry32(seed);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (rnd() < density) px(c, x, y, 1, 1, cols[Math.floor(rnd() * cols.length)]);
  }
}

// ---------- palette ----------
const PAL = {
  grass: '#3fae4a', grassHi: '#6fd66f', grassDk: '#2a7d34',
  dirt: '#7a4a26', dirtDk: '#5c3619', dirtHi: '#96633a',
  moss: '#4c9e57', mossDk: '#367a41',
  stone: '#8a9a8b', stoneDk: '#5f7060', stoneHi: '#aebcaf', stoneMoss: '#6f9a72',
  gold: '#f2b632', goldHi: '#ffe07a', goldDk: '#b57e17',
  bark: '#6b4a2f', barkDk: '#4e331f', barkHi: '#8a6540',
  wood: '#a5722e', woodDk: '#7d5520',
  leaf: '#2f8f4e', leafHi: '#4fbf6a', leafDk: '#1f6b39',
  lava: '#ff5a1f', lavaHi: '#ffb02e', lavaDk: '#c22e0a',
  water: '#2ea3c7', waterHi: '#7fd8ef', waterDk: '#1b6f8c',
  spike: '#c7cfc4', spikeDk: '#7e8878',
  orchid: '#e05fd0', hibiscus: '#ff5d73',
  skin: '#f0c08a', skinDk: '#cf9a63',
  hat: '#c8a24a', hatDk: '#9a7a30',
  shirt: '#3e8f5a', shirtDk: '#2c6b42',
  pants: '#8a6a3a', boot: '#4e331f',
  eye: '#202020',
};

// ---------- tile painters (16x16) ----------

/** Grass-topped jungle ground. */
function tileGround(): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 0, 0, 16, 16, PAL.dirt);
    noise(c, 16, 16, 11, [PAL.dirtDk, PAL.dirtHi], 0.18);
    px(c, 0, 0, 16, 5, PAL.grass);
    px(c, 0, 0, 16, 1, PAL.grassHi);
    px(c, 0, 4, 16, 1, PAL.grassDk);
    const rnd = mulberry32(7);
    for (let x = 0; x < 16; x += 2) { // dangling grass blades
      if (rnd() < 0.6) px(c, x, 5, 1, 1 + Math.floor(rnd() * 2), PAL.grassDk);
    }
    px(c, 3, 1, 2, 1, PAL.grassHi); px(c, 11, 2, 2, 1, PAL.grassHi);
  });
}

/** Plain packed dirt. */
function tileDirt(): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 0, 0, 16, 16, PAL.dirt);
    noise(c, 16, 16, 21, [PAL.dirtDk, PAL.dirtHi], 0.22);
    px(c, 0, 0, 16, 1, PAL.dirtDk);
  });
}

/** Mossy stone brick — the bumpable/breakable block. */
function tileBrick(): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 0, 0, 16, 16, PAL.stone);
    // brick pattern
    px(c, 0, 4, 16, 1, PAL.stoneDk); px(c, 0, 9, 16, 1, PAL.stoneDk); px(c, 0, 14, 16, 1, PAL.stoneDk);
    px(c, 7, 0, 1, 4, PAL.stoneDk); px(c, 3, 5, 1, 4, PAL.stoneDk); px(c, 11, 5, 1, 4, PAL.stoneDk);
    px(c, 7, 10, 1, 4, PAL.stoneDk);
    px(c, 0, 0, 16, 1, PAL.stoneHi);
    noise(c, 16, 16, 31, [PAL.stoneMoss, PAL.mossDk], 0.14);
    px(c, 2, 6, 2, 1, PAL.moss); px(c, 12, 12, 2, 1, PAL.moss);
  });
}

/** Golden carved question block, 3-frame glow. */
function tileQuestion(frame: number): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    const glow = frame === 1 ? PAL.goldHi : frame === 2 ? PAL.gold : '#e8a828';
    px(c, 0, 0, 16, 16, PAL.goldDk);
    px(c, 1, 1, 14, 14, glow);
    px(c, 1, 1, 14, 1, PAL.goldHi);
    px(c, 1, 14, 14, 1, PAL.goldDk);
    // corner rivets
    px(c, 2, 2, 1, 1, PAL.goldDk); px(c, 13, 2, 1, 1, PAL.goldDk);
    px(c, 2, 13, 1, 1, PAL.goldDk); px(c, 13, 13, 1, 1, PAL.goldDk);
    // carved "?" (leaf-green inlay)
    const q = PAL.leafDk;
    px(c, 6, 4, 4, 1, q); px(c, 9, 5, 1, 2, q); px(c, 7, 7, 2, 1, q); px(c, 7, 8, 1, 2, q); px(c, 7, 11, 1, 2, q);
    if (frame === 1) { px(c, 0, 0, 16, 16, 'rgba(255,240,180,0.18)'); }
  });
}

/** Spent question block. */
function tileQuestionUsed(): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 0, 0, 16, 16, '#8a6a30');
    px(c, 1, 1, 14, 14, '#a3803c');
    px(c, 1, 1, 14, 1, '#c49c50');
    px(c, 6, 7, 4, 2, '#7d5e28');
  });
}

/** Solid ancient stone block. */
function tileStone(): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 0, 0, 16, 16, PAL.stoneDk);
    px(c, 1, 1, 14, 14, PAL.stone);
    px(c, 1, 1, 14, 1, PAL.stoneHi);
    px(c, 1, 14, 14, 1, PAL.stoneDk);
    noise(c, 16, 16, 41, [PAL.stoneMoss, PAL.stoneDk], 0.12);
  });
}

/** Hollow log top — dark opening a flytrap can emerge from. */
function tileLogTop(): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 0, 0, 16, 16, PAL.bark);
    px(c, 0, 0, 1, 16, PAL.barkHi); px(c, 15, 0, 1, 16, PAL.barkDk);
    // opening
    px(c, 3, 1, 10, 4, '#1c120a');
    px(c, 2, 0, 12, 1, PAL.barkHi);
    px(c, 3, 5, 10, 1, PAL.barkDk);
    px(c, 2, 1, 1, 4, PAL.barkHi); px(c, 13, 1, 1, 4, PAL.barkDk);
    noise(c, 16, 16, 51, [PAL.barkDk, PAL.mossDk], 0.1);
  });
}

/** Hollow log body segment. */
function tileLogBody(): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 0, 0, 16, 16, PAL.bark);
    px(c, 0, 0, 1, 16, PAL.barkHi); px(c, 15, 0, 1, 16, PAL.barkDk);
    px(c, 4, 0, 1, 16, PAL.barkDk); px(c, 9, 0, 1, 16, PAL.barkDk);
    noise(c, 16, 16, 55, [PAL.barkDk, PAL.mossDk], 0.12);
  });
}

/** Hanging vine (decorative, non-solid). */
function tileVine(): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 7, 0, 2, 16, PAL.leafDk);
    px(c, 7, 0, 1, 16, PAL.leaf);
    const rnd = mulberry32(61);
    for (let y = 1; y < 15; y += 3) {
      const side = rnd() < 0.5 ? -1 : 1;
      px(c, 7 + (side > 0 ? 2 : -2), y, 2, 1, PAL.leaf);
      px(c, 7 + (side > 0 ? 3 : -3), y + 1, 1, 1, PAL.leafHi);
    }
  });
}

/** Wooden platform (one-way). */
function tileWood(): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 0, 0, 16, 6, PAL.wood);
    px(c, 0, 0, 16, 1, '#c89555');
    px(c, 0, 5, 16, 1, PAL.woodDk);
    px(c, 5, 0, 1, 6, PAL.woodDk); px(c, 11, 0, 1, 6, PAL.woodDk);
    px(c, 2, 2, 2, 1, PAL.woodDk); px(c, 8, 3, 2, 1, PAL.woodDk);
  });
}

/** Cloud / mist platform for the canopy (one-way). */
function tileCloud(): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 1, 3, 14, 4, '#f4fbf7');
    px(c, 3, 1, 10, 2, '#f4fbf7');
    px(c, 2, 2, 12, 5, '#f4fbf7');
    px(c, 2, 6, 12, 1, '#cfe8dd');
    px(c, 4, 7, 8, 1, '#bcd9cc');
    px(c, 3, 2, 3, 1, '#ffffff');
  });
}

/** Lava surface, 2 animation frames. */
function tileLava(frame: number): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 0, 0, 16, 16, PAL.lavaDk);
    px(c, 0, 2, 16, 14, PAL.lava);
    const rnd = mulberry32(71 + frame * 13);
    for (let i = 0; i < 10; i++) px(c, Math.floor(rnd() * 15), 3 + Math.floor(rnd() * 12), 2, 1, PAL.lavaHi);
    // surface bubbles
    for (let x = 0; x < 16; x += 3) {
      const off = (x + frame * 2) % 4 === 0 ? 1 : 0;
      px(c, x, off, 2, 2, PAL.lavaHi);
    }
    px(c, 0, 0, 16, 1, PAL.lavaHi);
  });
}

/** Water surface, 2 animation frames. */
function tileWater(frame: number): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 0, 0, 16, 16, PAL.waterDk);
    px(c, 0, 2, 16, 14, PAL.water);
    for (let x = 0; x < 16; x += 4) {
      const off = ((x / 2 + frame) % 2) === 0 ? 0 : 1;
      px(c, x + off, 0, 3, 2, PAL.waterHi);
    }
    px(c, 2, 6, 2, 1, PAL.waterHi); px(c, 10, 10, 2, 1, PAL.waterHi);
    px(c, 0, 0, 16, 16, 'rgba(46,163,199,0.25)');
  });
}

/** Stone spikes. */
function tileSpikes(): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    for (let s = 0; s < 4; s++) {
      const bx = s * 4;
      px(c, bx + 1, 6, 2, 10, PAL.spike);
      px(c, bx + 1, 4, 1, 2, PAL.spike);
      px(c, bx + 2, 6, 1, 10, PAL.spikeDk);
      px(c, bx + 1, 4, 1, 1, '#ffffff');
    }
    px(c, 0, 15, 16, 1, PAL.spikeDk);
  });
}

/** Crumbling rope bridge. */
function tileBridge(): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 0, 2, 16, 3, PAL.wood);
    px(c, 0, 2, 16, 1, '#c89555');
    px(c, 0, 4, 16, 1, PAL.woodDk);
    px(c, 3, 2, 1, 3, PAL.woodDk); px(c, 8, 2, 1, 3, PAL.woodDk); px(c, 13, 2, 1, 3, PAL.woodDk);
    px(c, 0, 0, 16, 1, '#c9b184'); // rope
    px(c, 1, 0, 1, 2, '#c9b184'); px(c, 7, 0, 1, 2, '#c9b184'); px(c, 14, 0, 1, 2, '#c9b184');
    // cracks
    px(c, 5, 3, 2, 1, PAL.barkDk); px(c, 11, 3, 1, 1, PAL.barkDk);
  });
}

/** Dense canopy leaf block (solid). */
function tileLeaves(): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 0, 0, 16, 16, PAL.leaf);
    const rnd = mulberry32(81);
    for (let i = 0; i < 26; i++) {
      px(c, Math.floor(rnd() * 15), Math.floor(rnd() * 15), 2, 1, rnd() < 0.5 ? PAL.leafHi : PAL.leafDk);
    }
    px(c, 0, 0, 16, 1, PAL.leafHi);
  });
}

/** Decorative foliage, 2 variants (orchid / hibiscus accents). */
function tileFoliage(variant: number): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    const rnd = mulberry32(91 + variant);
    for (let i = 0; i < 14; i++) {
      px(c, Math.floor(rnd() * 15), 8 + Math.floor(rnd() * 8), 2, 2, rnd() < 0.5 ? PAL.leaf : PAL.leafDk);
    }
    // flower
    const col = variant === 0 ? PAL.orchid : PAL.hibiscus;
    px(c, 7, 4, 2, 2, col); px(c, 6, 5, 4, 1, col); px(c, 7, 3, 1, 4, col);
    px(c, 7, 5, 1, 1, PAL.goldHi);
    px(c, 8, 6, 1, 4, PAL.leafDk);
  });
}

/** Ancient carved temple block. */
function tileTemple(): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 0, 0, 16, 16, '#7d8a7a');
    px(c, 1, 1, 14, 14, '#95a293');
    px(c, 1, 1, 14, 1, '#b4c0b2');
    px(c, 1, 14, 14, 1, '#5a665a');
    // carved glyph
    px(c, 4, 4, 8, 1, '#5a665a'); px(c, 4, 4, 1, 8, '#5a665a'); px(c, 11, 4, 1, 8, '#5a665a');
    px(c, 4, 11, 8, 1, '#5a665a'); px(c, 7, 7, 2, 2, '#5a665a');
    noise(c, 16, 16, 95, [PAL.stoneMoss, PAL.mossDk], 0.15);
  });
}

/** Gong stand base block. */
function tileGongStand(): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 0, 0, 16, 16, PAL.bark);
    px(c, 0, 0, 16, 1, PAL.barkHi);
    px(c, 2, 0, 2, 16, PAL.barkDk); px(c, 12, 0, 2, 16, PAL.barkDk);
    px(c, 0, 14, 16, 2, PAL.barkDk);
    noise(c, 16, 16, 97, [PAL.barkDk], 0.1);
  });
}

// ---------- character sprite painters ----------

type ExplorerStyle = {
  hat?: string;
  shirt?: string;
  hood?: 'frog' | 'anvil' | null;
};

function drawExplorer(c: Ctx, ox: number, oy: number, big: boolean, frame: 'idle' | 'run1' | 'run2' | 'jump', flip: boolean, style: ExplorerStyle = {}): void {
  // jungle explorer kid: safari hat, green shirt, khaki shorts, boots
  const hatCol = style.hat ?? PAL.hat;
  const hatDk = style.hat ? style.hat : PAL.hatDk;
  const shirtCol = style.shirt ?? PAL.shirt;
  const shirtDk = style.shirt ? style.shirt : PAL.shirtDk;
  c.save();
  if (flip) { c.translate(ox * 2 + (big ? 14 : 12), 0); c.scale(-1, 1); }
  const s = big ? 1 : 1; // proportions handled by coords
  void s;
  if (!big) {
    // 12w x 14h sprite at ox,oy
    // hat
    px(c, ox + 2, oy + 0, 8, 2, hatCol); px(c, ox + 1, oy + 2, 10, 1, hatCol);
    px(c, ox + 3, oy + 0, 6, 1, hatDk);
    // head
    px(c, ox + 3, oy + 3, 6, 3, PAL.skin);
    px(c, ox + 7, oy + 4, 1, 1, PAL.eye);
    px(c, ox + 3, oy + 5, 6, 1, PAL.skinDk);
    // body (shirt)
    px(c, ox + 3, oy + 6, 6, 4, shirtCol);
    px(c, ox + 3, oy + 6, 6, 1, shirtDk);
    px(c, ox + 2, oy + 7, 1, 2, PAL.skin); px(c, ox + 9, oy + 7, 1, 2, PAL.skin); // arms
    // legs
    if (frame === 'run1') {
      px(c, ox + 2, oy + 10, 3, 2, PAL.pants); px(c, ox + 7, oy + 10, 3, 2, PAL.pants);
      px(c, ox + 1, oy + 12, 3, 2, PAL.boot); px(c, ox + 8, oy + 12, 3, 2, PAL.boot);
    } else if (frame === 'run2') {
      px(c, ox + 3, oy + 10, 2, 2, PAL.pants); px(c, ox + 7, oy + 10, 2, 2, PAL.pants);
      px(c, ox + 3, oy + 12, 2, 2, PAL.boot); px(c, ox + 7, oy + 12, 2, 2, PAL.boot);
    } else if (frame === 'jump') {
      px(c, ox + 2, oy + 10, 3, 2, PAL.pants); px(c, ox + 7, oy + 10, 3, 2, PAL.pants);
      px(c, ox + 2, oy + 12, 3, 1, PAL.boot); px(c, ox + 7, oy + 12, 3, 1, PAL.boot);
    } else {
      px(c, ox + 3, oy + 10, 2, 2, PAL.pants); px(c, ox + 7, oy + 10, 2, 2, PAL.pants);
      px(c, ox + 3, oy + 12, 2, 2, PAL.boot); px(c, ox + 7, oy + 12, 2, 2, PAL.boot);
    }
  } else {
    // big: 14w x 30h
    // hat
    px(c, ox + 3, oy + 0, 8, 3, hatCol); px(c, ox + 1, oy + 3, 12, 2, hatCol);
    px(c, ox + 3, oy + 2, 8, 1, hatDk);
    // head
    px(c, ox + 3, oy + 5, 8, 5, PAL.skin);
    px(c, ox + 8, oy + 6, 2, 2, PAL.eye);
    px(c, ox + 3, oy + 9, 8, 1, PAL.skinDk);
    px(c, ox + 4, oy + 10, 6, 1, '#8a5a2a'); // smile
    // torso
    px(c, ox + 2, oy + 11, 10, 8, shirtCol);
    px(c, ox + 2, oy + 11, 10, 1, shirtDk);
    px(c, ox + 6, oy + 12, 2, 6, shirtDk); // vest line
    // arms
    if (frame === 'jump') {
      px(c, ox + 0, oy + 10, 2, 5, PAL.skin); px(c, ox + 12, oy + 10, 2, 5, PAL.skin);
    } else {
      px(c, ox + 0, oy + 12, 2, 5, PAL.skin); px(c, ox + 12, oy + 12, 2, 5, PAL.skin);
    }
    // shorts
    px(c, ox + 2, oy + 19, 10, 3, PAL.pants);
    // legs
    if (frame === 'run1') {
      px(c, ox + 2, oy + 22, 4, 5, PAL.skin); px(c, ox + 8, oy + 22, 4, 5, PAL.skin);
      px(c, ox + 1, oy + 27, 5, 3, PAL.boot); px(c, ox + 9, oy + 27, 5, 3, PAL.boot);
    } else if (frame === 'run2') {
      px(c, ox + 4, oy + 22, 3, 5, PAL.skin); px(c, ox + 7, oy + 22, 3, 5, PAL.skin);
      px(c, ox + 4, oy + 27, 3, 3, PAL.boot); px(c, ox + 7, oy + 27, 3, 3, PAL.boot);
    } else if (frame === 'jump') {
      px(c, ox + 2, oy + 22, 4, 4, PAL.skin); px(c, ox + 8, oy + 22, 4, 4, PAL.skin);
      px(c, ox + 2, oy + 26, 4, 2, PAL.boot); px(c, ox + 8, oy + 26, 4, 2, PAL.boot);
    } else {
      px(c, ox + 3, oy + 22, 3, 5, PAL.skin); px(c, ox + 8, oy + 22, 3, 5, PAL.skin);
      px(c, ox + 3, oy + 27, 3, 3, PAL.boot); px(c, ox + 8, oy + 27, 3, 3, PAL.boot);
    }
  }
  // form hoods / helmets drawn over the head
  if (style.hood === 'frog') {
    const hy = big ? oy - 1 : oy - 1;
    const hx = big ? ox + 1 : ox + 1;
    const hw = big ? 12 : 10;
    px(c, hx, hy, hw, big ? 6 : 4, '#4fae4a'); // hood cap
    px(c, hx, hy, hw, 1, '#7fd66f');
    // frog eyes on top
    px(c, hx + 1, hy - 2, 3, 3, '#4fae4a'); px(c, hx + hw - 4, hy - 2, 3, 3, '#4fae4a');
    px(c, hx + 2, hy - 1, 1, 1, '#ffffff'); px(c, hx + hw - 3, hy - 1, 1, 1, '#ffffff');
    px(c, hx + 2, hy - 1, 1, 1, PAL.eye); px(c, hx + hw - 2, hy - 1, 1, 1, PAL.eye);
    // throat
    if (big) px(c, ox + 3, oy + 9, 8, 2, '#c9e8a0');
  } else if (style.hood === 'anvil') {
    const hy = big ? oy - 2 : oy - 1;
    const hx = big ? ox + 1 : ox + 1;
    const hw = big ? 12 : 10;
    // heavy kapok seed-pod helmet
    px(c, hx, hy, hw, big ? 5 : 4, '#6b4a2f');
    px(c, hx, hy, hw, 1, '#8a6540');
    px(c, hx + 2, hy - 2, hw - 4, 2, '#7d5a38'); // pod crest
    px(c, hx + 3, hy - 3, 2, 1, '#9a7a4a'); px(c, hx + hw - 5, hy - 3, 2, 1, '#9a7a4a');
    px(c, hx + 1, hy + (big ? 4 : 3), 2, 2, '#5a3a22'); px(c, hx + hw - 3, hy + (big ? 4 : 3), 2, 2, '#5a3a22');
  }
  c.restore();
}

function playerSprite(big: boolean, frame: 'idle' | 'run1' | 'run2' | 'jump', style: ExplorerStyle = {}): HTMLCanvasElement {
  const w = big ? 16 : 16, h = big ? 32 : 16;
  return mk(w, h, (c) => drawExplorer(c, big ? 1 : 2, big ? 1 : 1, big, frame, false, style));
}

/** Mossback Beetle (goomba analog): mossy round beetle. */
function beetleSprite(frame: number): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 2, 5, 12, 8, '#7a5a36'); // body
    px(c, 2, 5, 12, 2, '#96794c');
    px(c, 3, 3, 10, 4, PAL.moss); // mossy shell top
    px(c, 4, 2, 8, 2, PAL.mossDk);
    px(c, 5, 1, 2, 1, PAL.leafHi); px(c, 10, 1, 1, 1, PAL.leafHi);
    // angry eyes
    px(c, 4, 7, 2, 2, '#ffffff'); px(c, 10, 7, 2, 2, '#ffffff');
    px(c, 5, 8, 1, 1, PAL.eye); px(c, 10, 8, 1, 1, PAL.eye);
    // feet (alternate)
    if (frame === 0) { px(c, 2, 13, 4, 2, PAL.boot); px(c, 10, 13, 4, 2, PAL.boot); }
    else { px(c, 3, 13, 4, 2, PAL.boot); px(c, 9, 13, 4, 2, PAL.boot); }
  });
}

/** Shellback Tortoise walking (koopa analog). */
function tortoiseSprite(color: 'green' | 'red', frame: number): HTMLCanvasElement {
  const shell = color === 'green' ? '#3f9e4d' : '#c94f43';
  const shellDk = color === 'green' ? '#2a7a36' : '#96352c';
  return mk(16, 24, (c) => {
    // head
    px(c, 10, 2, 5, 5, '#d8c76a');
    px(c, 12, 3, 1, 1, PAL.eye);
    px(c, 14, 4, 1, 2, '#b8a74a'); // beak
    // body shell
    px(c, 2, 8, 11, 9, shell);
    px(c, 2, 8, 11, 2, shellDk);
    px(c, 4, 10, 7, 5, shellDk === '#2a7a36' ? '#54b565' : '#e0695d');
    px(c, 2, 15, 11, 2, shellDk);
    // belly
    px(c, 11, 9, 2, 7, '#e8dd9a');
    // legs
    if (frame === 0) { px(c, 4, 17, 3, 4, '#d8c76a'); px(c, 10, 17, 3, 4, '#d8c76a'); }
    else { px(c, 3, 17, 3, 4, '#d8c76a'); px(c, 11, 17, 3, 4, '#d8c76a'); }
    px(c, 4, 21, 3, 2, PAL.boot); px(c, 10, 21, 3, 2, PAL.boot);
  });
}

/** Shell (tortoise / armadillo). */
function shellSprite(kind: 'green' | 'red' | 'armadillo'): HTMLCanvasElement {
  const main = kind === 'green' ? '#3f9e4d' : kind === 'red' ? '#c94f43' : '#8a8f96';
  const dk = kind === 'green' ? '#2a7a36' : kind === 'red' ? '#96352c' : '#5d626a';
  return mk(16, 16, (c) => {
    px(c, 1, 5, 14, 9, main);
    px(c, 3, 2, 10, 4, main);
    px(c, 3, 2, 10, 1, dk);
    px(c, 5, 4, 6, 4, dk);
    px(c, 1, 12, 14, 2, dk);
    px(c, 0, 13, 16, 2, '#e8ddc0'); // rim
    if (kind === 'armadillo') { px(c, 2, 7, 2, 2, '#c9ced6'); px(c, 11, 6, 2, 2, '#c9ced6'); }
    px(c, 4, 3, 3, 1, 'rgba(255,255,255,0.5)');
  });
}

/** Snapjaw Flytrap (piranha plant) — 2 frames, drawn rising from a log. */
function flytrapSprite(frame: number): HTMLCanvasElement {
  return mk(16, 24, (c) => {
    // stem
    px(c, 7, 12, 2, 12, PAL.leafDk);
    px(c, 4, 16, 3, 2, PAL.leaf); px(c, 9, 19, 3, 2, PAL.leaf);
    // head
    const open = frame === 0;
    px(c, 3, 1, 10, 11, '#c0392b');
    px(c, 3, 1, 10, 2, '#e05a4a');
    px(c, 4, 3, 2, 2, '#ffffff'); px(c, 10, 6, 2, 2, '#ffffff'); // spots
    if (open) {
      px(c, 3, 6, 10, 3, '#6b1410'); // mouth
      px(c, 4, 6, 2, 1, '#ffffff'); px(c, 8, 6, 2, 1, '#ffffff'); px(c, 11, 7, 1, 1, '#ffffff'); // teeth
      px(c, 5, 8, 2, 1, '#ffffff'); px(c, 9, 8, 2, 1, '#ffffff');
    } else {
      px(c, 3, 6, 10, 1, '#6b1410');
    }
  });
}

/** Coconut Monkey (hammer bro analog). */
function monkeySprite(frame: number): HTMLCanvasElement {
  return mk(16, 24, (c) => {
    // tail
    px(c, 1, 14, 2, 2, '#7a5a36'); px(c, 0, 12, 2, 2, '#7a5a36');
    // body
    px(c, 4, 9, 9, 9, '#8a6a42');
    px(c, 5, 11, 7, 6, '#c9a76a'); // belly
    // head
    px(c, 4, 2, 9, 8, '#8a6a42');
    px(c, 5, 5, 7, 5, '#c9a76a'); // face
    px(c, 6, 6, 1, 1, PAL.eye); px(c, 10, 6, 1, 1, PAL.eye);
    px(c, 7, 8, 3, 1, '#6b4a2a'); // mouth
    px(c, 3, 3, 2, 3, '#8a6a42'); px(c, 12, 3, 2, 3, '#8a6a42'); // ears
    // throwing arm
    if (frame === 1) { px(c, 11, 6, 4, 2, '#8a6a42'); px(c, 14, 4, 2, 2, '#5d4028'); }
    else { px(c, 11, 10, 4, 2, '#8a6a42'); }
    // feet
    px(c, 4, 18, 4, 3, '#5d4028'); px(c, 9, 18, 4, 3, '#5d4028');
  });
}

/** Coconut projectile. */
function coconutSprite(): HTMLCanvasElement {
  return mk(8, 8, (c) => {
    px(c, 1, 1, 6, 6, '#6b4a2f');
    px(c, 2, 0, 4, 8, '#6b4a2f'); px(c, 0, 2, 8, 4, '#6b4a2f');
    px(c, 2, 2, 2, 1, '#8a6540');
    px(c, 3, 3, 1, 1, '#3a2716'); px(c, 5, 4, 1, 1, '#3a2716');
  });
}

/** Harpy Eagle (lakitu analog) — flying raptor. */
function eagleSprite(frame: number): HTMLCanvasElement {
  return mk(24, 16, (c) => {
    // wings
    if (frame === 0) { px(c, 2, 2, 7, 4, '#4a4e57'); px(c, 15, 2, 7, 4, '#4a4e57'); px(c, 3, 1, 5, 1, '#6a6f7a'); px(c, 16, 1, 5, 1, '#6a6f7a'); }
    else { px(c, 2, 7, 7, 4, '#4a4e57'); px(c, 15, 7, 7, 4, '#4a4e57'); px(c, 3, 10, 5, 1, '#3a3e47'); px(c, 16, 10, 5, 1, '#3a3e47'); }
    // body
    px(c, 8, 4, 8, 8, '#5d626c');
    px(c, 9, 7, 6, 5, '#e8e4da'); // chest
    // head
    px(c, 9, 1, 6, 5, '#f0ede4');
    px(c, 10, 3, 1, 1, PAL.eye); px(c, 13, 3, 1, 1, PAL.eye);
    px(c, 11, 4, 2, 2, PAL.gold); // beak
    // talons clutching a durian
    px(c, 10, 12, 1, 2, PAL.gold); px(c, 13, 12, 1, 2, PAL.gold);
  });
}

/** Spiky Durian (spiny analog). */
function durianSprite(): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 2, 6, 12, 8, '#7a8c3a');
    px(c, 3, 4, 10, 3, '#8a9c46');
    // spikes
    for (let x = 1; x < 15; x += 3) { px(c, x, 2, 1, 4, '#c9d48a'); px(c, x + 1, 3, 1, 3, '#a8b86a'); }
    px(c, 2, 6, 12, 1, '#5d6e2a');
    // face
    px(c, 5, 9, 2, 2, '#ffffff'); px(c, 10, 9, 2, 2, '#ffffff');
    px(c, 5, 10, 1, 1, PAL.eye); px(c, 11, 10, 1, 1, PAL.eye);
    px(c, 7, 12, 3, 1, '#3a4a1a');
    // feet
    px(c, 3, 14, 3, 2, '#4a5a20'); px(c, 10, 14, 3, 2, '#4a5a20');
  });
}

/** Armadillo (buzzy beetle analog). */
function armadilloSprite(frame: number): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 1, 5, 14, 9, '#8a8f96'); // shell body
    px(c, 3, 2, 10, 4, '#8a8f96');
    px(c, 3, 2, 10, 1, '#5d626a');
    px(c, 4, 4, 8, 1, '#5d626a'); px(c, 3, 7, 10, 1, '#5d626a'); px(c, 3, 10, 10, 1, '#5d626a'); // bands
    px(c, 1, 13, 14, 1, '#5d626a');
    // head poking out
    px(c, 12, 8, 4, 4, '#c9a76a');
    px(c, 14, 9, 1, 1, PAL.eye);
    // feet
    if (frame === 0) { px(c, 3, 14, 3, 2, '#5d626a'); px(c, 9, 14, 3, 2, '#5d626a'); }
    else { px(c, 4, 14, 3, 2, '#5d626a'); px(c, 8, 14, 3, 2, '#5d626a'); }
  });
}

/** Leaping Piranha (cheep cheep analog). */
function piranhaSprite(frame: number): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 2, 4, 11, 8, '#e05a3a'); // body
    px(c, 2, 4, 11, 2, '#f0826a');
    px(c, 3, 9, 9, 3, '#f0e0d0'); // belly
    // tail
    if (frame === 0) { px(c, 13, 3, 3, 4, '#c0392b'); px(c, 13, 9, 3, 4, '#c0392b'); }
    else { px(c, 13, 5, 3, 6, '#c0392b'); }
    // eye + teeth
    px(c, 4, 6, 2, 2, '#ffffff'); px(c, 4, 6, 1, 1, PAL.eye);
    px(c, 2, 8, 3, 2, '#6b1410');
    px(c, 2, 8, 1, 1, '#ffffff'); px(c, 4, 9, 1, 1, '#ffffff');
    // dorsal fin
    px(c, 7, 2, 3, 2, '#c0392b');
  });
}

/** Spirit Bloom powerup flower — glowing jungle bloom. */
function bloomSprite(frame: number): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    // stem + leaves
    px(c, 7, 9, 2, 7, PAL.leafDk);
    px(c, 4, 11, 3, 2, PAL.leaf); px(c, 9, 12, 3, 2, PAL.leaf);
    // petals
    const petal = frame === 0 ? PAL.orchid : '#f07fe0';
    px(c, 5, 1, 6, 8, petal);
    px(c, 3, 3, 10, 4, petal);
    px(c, 6, 0, 4, 2, '#f0a0e8');
    // glowing heart
    px(c, 6, 3, 4, 4, PAL.goldHi);
    px(c, 7, 4, 2, 2, '#ffffff');
    if (frame === 1) px(c, 0, 0, 16, 16, 'rgba(255,220,250,0.15)');
  });
}

/** Gold sun-disc coin, 4-frame spin. */
function coinSprite(frame: number): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    const widths = [10, 6, 2, 6];
    const w = widths[frame % 4];
    const x = 8 - Math.floor(w / 2);
    px(c, x, 3, w, 10, PAL.gold);
    px(c, x, 4, w, 1, PAL.goldHi);
    px(c, x, 12, w, 1, PAL.goldDk);
    if (w > 4) {
      px(c, x + 2, 5, w - 4, 6, PAL.goldDk);
      px(c, x + 2, 5, w - 4, 1, PAL.goldHi);
      px(c, x + Math.floor(w / 2) - 1, 6, 2, 4, PAL.gold); // sun ray carving
    }
  });
}

/** Checkpoint marker — carved wooden idol post, glows when active. */
function checkpointSprite(active: boolean): HTMLCanvasElement {
  return mk(16, 32, (c) => {
    px(c, 6, 8, 4, 24, PAL.bark);
    px(c, 6, 8, 1, 24, PAL.barkHi);
    // carved head
    px(c, 3, 1, 10, 9, PAL.bark);
    px(c, 3, 1, 10, 1, PAL.barkHi);
    px(c, 5, 4, 2, 2, active ? PAL.goldHi : '#3a2a18');
    px(c, 9, 4, 2, 2, active ? PAL.goldHi : '#3a2a18');
    px(c, 6, 7, 4, 1, '#3a2a18');
    // feather
    px(c, 11, 0, 2, 4, active ? PAL.hibiscus : PAL.mossDk);
    if (active) px(c, 0, 0, 16, 32, 'rgba(255,220,120,0.12)');
  });
}

/** Goal totem — tall carved totem with pennant flag (2 tiles wide, 3 tall). */
function goalSprite(): HTMLCanvasElement {
  return mk(32, 48, (c) => {
    // pole
    px(c, 8, 0, 16, 48, PAL.bark);
    px(c, 8, 0, 2, 48, PAL.barkHi); px(c, 22, 0, 2, 48, PAL.barkDk);
    // carved faces
    const face = (y: number, eye: string) => {
      px(c, 10, y, 4, 3, eye); px(c, 18, y, 4, 3, eye);
      px(c, 11, y + 1, 2, 1, PAL.eye); px(c, 19, y + 1, 2, 1, PAL.eye);
      px(c, 12, y + 4, 8, 2, PAL.barkDk);
    };
    face(6, PAL.goldHi); face(22, PAL.orchid); face(38, PAL.waterHi);
    px(c, 8, 16, 16, 2, PAL.barkDk); px(c, 8, 32, 16, 2, PAL.barkDk);
    // pennant flag
    px(c, 24, 2, 8, 6, PAL.hibiscus);
    px(c, 24, 2, 8, 1, '#ff8a9a');
    px(c, 30, 4, 2, 2, PAL.hibiscus);
    // moss
    px(c, 9, 14, 3, 1, PAL.mossDk); px(c, 20, 30, 3, 1, PAL.moss);
  });
}

/** Sacred Gong — the boss-defeating switch. */
function gongSprite(frame: number): HTMLCanvasElement {
  return mk(24, 24, (c) => {
    // frame
    px(c, 2, 0, 3, 24, PAL.bark); px(c, 19, 0, 3, 24, PAL.bark);
    px(c, 0, 0, 24, 3, PAL.bark); px(c, 0, 0, 24, 1, PAL.barkHi);
    // gong disc
    px(c, 6, 5, 12, 12, PAL.gold);
    px(c, 7, 6, 10, 2, PAL.goldHi);
    px(c, 9, 9, 6, 6, PAL.goldDk);
    px(c, 10, 10, 4, 4, PAL.goldHi);
    if (frame === 1) px(c, 4, 3, 16, 16, 'rgba(255,230,140,0.25)');
    px(c, 0, 21, 24, 3, PAL.barkDk);
  });
}

/** Jade Axe — ceremonial axe pickup that fells the Cursed Idol (16x22). */
function axeSprite(frame: number): HTMLCanvasElement {
  return mk(16, 22, (c) => {
    // handle
    px(c, 7, 6, 3, 16, PAL.bark);
    px(c, 7, 6, 1, 16, PAL.barkHi);
    px(c, 7, 20, 3, 2, PAL.barkDk);
    // jade blade — double-winged crescent at the top
    px(c, 4, 1, 9, 3, '#3fae8a');
    px(c, 2, 3, 13, 4, '#3fae8a');
    px(c, 1, 4, 2, 5, '#3fae8a'); // left wing
    px(c, 14, 4, 2, 5, '#3fae8a'); // right wing
    px(c, 2, 3, 13, 1, '#7fe0bd'); // top edge highlight
    px(c, 1, 4, 1, 5, '#7fe0bd');
    px(c, 15, 4, 1, 5, '#1f6e55'); // right shadow
    px(c, 3, 7, 11, 1, '#2c8a6c'); // bottom shade
    // gold wrap where blade meets handle
    px(c, 6, 7, 5, 3, PAL.gold);
    px(c, 6, 7, 5, 1, PAL.goldHi);
    // carved eye in the blade
    px(c, 7, 3, 3, 3, '#175843');
    px(c, 8, 4, 1, 1, '#9df2d4');
    if (frame === 1) { px(c, 2, 1, 2, 2, '#eafff6'); px(c, 12, 0, 2, 2, 'rgba(234,255,246,0.8)'); }
  });
}

/** The Cursed Idol — giant evil stone statue boss (64x64). */
function bossSprite(frame: number): HTMLCanvasElement {
  return mk(64, 64, (c) => {
    // body mass
    px(c, 8, 8, 48, 52, '#7d8a7a');
    px(c, 8, 8, 48, 2, '#9aa79a');
    px(c, 8, 58, 48, 2, '#4a554a');
    noise(c, 64, 64, 131, ['#6a7669', '#8d9a8a', PAL.mossDk], 0.06);
    // headdress
    px(c, 4, 0, 56, 10, '#5f6b5c');
    px(c, 4, 0, 56, 2, '#7d8a72');
    for (let x = 6; x < 58; x += 6) px(c, x, 2, 2, 6, PAL.goldDk);
    // glowing eyes
    const eye = frame === 1 ? '#ff3a2a' : '#ff7a3a';
    px(c, 18, 18, 10, 6, '#2a2a22'); px(c, 36, 18, 10, 6, '#2a2a22');
    px(c, 20, 19, 6, 4, eye); px(c, 38, 19, 6, 4, eye);
    px(c, 22, 20, 2, 2, '#ffe0a0'); px(c, 40, 20, 2, 2, '#ffe0a0');
    // nose + mouth
    px(c, 29, 26, 6, 8, '#5f6b5c');
    px(c, 18, 40, 28, 8, '#2a2a22'); // mouth
    for (let x = 20; x < 44; x += 4) px(c, x, 40, 2, 3, '#c9cfc0'); // teeth
    px(c, 20, 46, 24, 2, frame === 1 ? '#ff5a3a' : '#3a3a30'); // inner glow
    // arms
    px(c, 0, 24, 8, 20, '#6a7669'); px(c, 56, 24, 8, 20, '#6a7669');
    px(c, 0, 40, 10, 8, '#7d8a7a'); px(c, 54, 40, 10, 8, '#7d8a7a'); // fists
    // gold chest glyph
    px(c, 26, 50, 12, 8, PAL.goldDk); px(c, 28, 51, 8, 6, PAL.gold);
    // moss patches
    px(c, 10, 12, 5, 3, PAL.mossDk); px(c, 48, 34, 6, 3, PAL.moss); px(c, 12, 52, 4, 2, PAL.mossDk);
  });
}

/** Idol fireball/dart projectile, 2 frames. */
function fireballSprite(frame: number): HTMLCanvasElement {
  return mk(10, 10, (c) => {
    px(c, 1, 1, 8, 8, frame === 0 ? PAL.lava : PAL.lavaHi);
    px(c, 2, 2, 6, 6, frame === 0 ? PAL.lavaHi : '#ffe07a');
    px(c, 4, 4, 2, 2, '#ffffff');
  });
}

// ---------- powerup item sprites (16x16 unless noted) ----------

/** Ember Chili — glowing orange chili pepper (FORM). */
function emberChiliSprite(frame: number): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    // stem
    px(c, 7, 1, 2, 3, PAL.leafDk); px(c, 8, 0, 3, 2, PAL.leaf);
    // pepper body
    px(c, 4, 4, 8, 9, '#e8491f');
    px(c, 4, 4, 8, 2, '#ff7a3a');
    px(c, 3, 6, 2, 5, '#e8491f');
    px(c, 11, 5, 2, 6, '#c22e0a');
    px(c, 5, 12, 5, 2, '#c22e0a');
    // ember glow spots
    const g = frame === 0 ? '#ffb02e' : '#ffe07a';
    px(c, 5, 6, 2, 2, g); px(c, 8, 9, 2, 2, g); px(c, 6, 11, 1, 1, g);
    if (frame === 1) px(c, 2, 2, 12, 12, 'rgba(255,140,60,0.15)');
  });
}

/** Tree Frog Suit — green frog hood (FORM). */
function frogSuitSprite(): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    // hood
    px(c, 2, 5, 12, 9, '#4fae4a');
    px(c, 2, 5, 12, 2, '#7fd66f');
    // frog eyes on top
    px(c, 3, 1, 4, 4, '#4fae4a'); px(c, 9, 1, 4, 4, '#4fae4a');
    px(c, 4, 2, 2, 2, '#ffffff'); px(c, 10, 2, 2, 2, '#ffffff');
    px(c, 4, 2, 1, 1, PAL.eye); px(c, 11, 2, 1, 1, PAL.eye);
    // face opening
    px(c, 5, 7, 6, 5, '#f0e8c9');
    px(c, 6, 9, 4, 1, '#c9b184');
    // webbed feet
    px(c, 1, 13, 4, 2, '#3a8a36'); px(c, 11, 13, 4, 2, '#3a8a36');
  });
}

/** Kapok Anvil — heavy seed-pod helmet (FORM). */
function kapokAnvilSprite(): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    // pod body
    px(c, 3, 4, 10, 9, '#6b4a2f');
    px(c, 3, 4, 10, 2, '#8a6540');
    px(c, 2, 6, 2, 5, '#5a3a22'); px(c, 12, 6, 2, 5, '#5a3a22');
    // ridges
    px(c, 5, 5, 1, 7, '#5a3a22'); px(c, 8, 5, 1, 7, '#5a3a22'); px(c, 11, 5, 1, 7, '#5a3a22');
    // crest
    px(c, 6, 1, 4, 3, '#7d5a38');
    px(c, 7, 0, 2, 1, '#9a7a4a');
    // base anvil edge
    px(c, 2, 13, 12, 2, '#4e331f');
    px(c, 2, 13, 12, 1, '#6b4a2f');
  });
}

/** Macaw Wings — bright feathered wings (TIMED). */
function macawWingsSprite(frame: number): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    const up = frame === 0;
    // left wing
    px(c, 1, up ? 3 : 6, 6, 3, '#e03a3a');
    px(c, 1, up ? 5 : 8, 5, 2, '#3a7ae0');
    px(c, 2, up ? 7 : 10, 4, 2, '#f2b632');
    // right wing
    px(c, 9, up ? 3 : 6, 6, 3, '#e03a3a');
    px(c, 10, up ? 5 : 8, 5, 2, '#3a7ae0');
    px(c, 10, up ? 7 : 10, 4, 2, '#f2b632');
    // body
    px(c, 6, 5, 4, 7, '#c0392b');
    px(c, 7, 4, 2, 2, '#f0f0f0');
    px(c, 7, 12, 2, 3, '#3a7ae0'); // tail
  });
}

/** Jaguar Pelt — golden pelt with rosettes (TIMED). */
function jaguarPeltSprite(): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 2, 3, 12, 11, '#e8a83a');
    px(c, 2, 3, 12, 2, '#f5c96a');
    px(c, 1, 5, 2, 6, '#d89a2a'); px(c, 13, 5, 2, 6, '#d89a2a');
    // rosettes
    const r = '#7a4a16';
    px(c, 4, 5, 2, 2, r); px(c, 9, 4, 2, 2, r); px(c, 6, 8, 2, 2, r);
    px(c, 11, 8, 2, 2, r); px(c, 4, 11, 2, 2, r); px(c, 9, 12, 2, 2, r);
    px(c, 4, 5, 1, 1, '#f5e0a0'); px(c, 9, 4, 1, 1, '#f5e0a0');
    // tail
    px(c, 13, 12, 2, 3, '#e8a83a'); px(c, 14, 14, 1, 1, r);
  });
}

/** Rainbow Orchid — cycling rainbow star-flower (TIMED). */
function rainbowOrchidSprite(hueStep: number): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    const cols = ['#ff5d73', '#ffb02e', '#f5e85a', '#6fd66f', '#5ac8f0', '#b78af0'];
    const col = cols[hueStep % cols.length];
    const col2 = cols[(hueStep + 2) % cols.length];
    // petals
    px(c, 6, 1, 4, 6, col); px(c, 6, 9, 4, 6, col2);
    px(c, 1, 5, 6, 4, col2); px(c, 9, 5, 6, 4, col);
    px(c, 3, 3, 3, 3, col); px(c, 10, 3, 3, 3, col2);
    px(c, 3, 10, 3, 3, col2); px(c, 10, 10, 3, 3, col);
    // glowing heart
    px(c, 6, 6, 4, 4, '#ffffff');
    px(c, 7, 7, 2, 2, col);
    // stem sparkle
    px(c, 2, 1, 1, 1, '#ffffff'); px(c, 13, 13, 1, 1, '#ffffff');
  });
}

/** Grasshopper Legs — springy green leg braces (TIMED). */
function grasshopperLegsSprite(frame: number): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    const spring = frame === 0 ? 0 : 1;
    // two spring-brase legs
    for (const bx of [3, 9]) {
      px(c, bx, 2, 4, 3, '#4fae4a'); // brace cuff
      px(c, bx, 2, 4, 1, '#7fd66f');
      // zigzag spring
      px(c, bx, 5, 2, 2, '#8ad65a'); px(c, bx + 2, 7, 2, 2, '#8ad65a');
      px(c, bx, 9, 2, 2, '#8ad65a'); px(c, bx + 2, 11, 2, 2, '#8ad65a');
      // foot pad
      px(c, bx - 1, 13 - spring, 6, 2, '#2a7d34');
    }
  });
}

/** Shrinkberry — tiny glowing purple berry (TIMED). */
function shrinkberrySprite(frame: number): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    // leaf
    px(c, 8, 2, 4, 2, PAL.leaf); px(c, 7, 3, 2, 1, PAL.leafDk);
    // berry
    px(c, 4, 5, 8, 8, '#8a5ad6');
    px(c, 4, 5, 8, 2, '#b78af0');
    px(c, 3, 7, 2, 4, '#8a5ad6'); px(c, 11, 7, 2, 4, '#6a3ab0');
    px(c, 5, 12, 6, 1, '#6a3ab0');
    // sparkle
    const s = frame === 0 ? '#ffffff' : '#e0c9ff';
    px(c, 6, 7, 2, 2, s); px(c, 9, 10, 1, 1, s);
    if (frame === 1) px(c, 2, 3, 12, 12, 'rgba(190,140,255,0.15)');
  });
}

/** Coin Capuchin — tiny monkey clutching a coin (TIMED). */
function coinCapuchinSprite(): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    // tiny monkey
    px(c, 2, 6, 7, 7, '#8a6a42'); // body+head
    px(c, 3, 8, 5, 4, '#c9a76a'); // face
    px(c, 4, 9, 1, 1, PAL.eye); px(c, 6, 9, 1, 1, PAL.eye);
    px(c, 1, 7, 1, 2, '#8a6a42'); px(c, 9, 7, 1, 2, '#8a6a42'); // ears
    px(c, 2, 13, 2, 2, '#5d4028'); px(c, 6, 13, 2, 2, '#5d4028'); // feet
    px(c, 0, 11, 2, 1, '#7a5a36'); // tail
    // coin
    px(c, 11, 3, 5, 5, PAL.gold);
    px(c, 11, 3, 5, 1, PAL.goldHi);
    px(c, 12, 5, 3, 2, PAL.goldDk);
    px(c, 13, 4, 1, 3, PAL.goldHi);
  });
}

/** Golden Banana — legendary curved banana (INSTANT). */
function goldenBananaSprite(frame: number): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    // curved banana
    px(c, 3, 3, 3, 4, PAL.gold);
    px(c, 4, 6, 3, 3, PAL.gold);
    px(c, 6, 8, 4, 3, PAL.gold);
    px(c, 9, 9, 4, 3, PAL.gold);
    px(c, 12, 8, 2, 3, PAL.goldDk);
    px(c, 3, 3, 2, 2, PAL.goldHi);
    px(c, 6, 8, 3, 1, PAL.goldHi);
    px(c, 2, 2, 2, 2, '#6b4a0e'); // stem
    // shine
    const s = frame === 0 ? '#ffffff' : '#fff5c9';
    px(c, 4, 4, 1, 1, s); px(c, 10, 10, 1, 1, s);
    if (frame === 1) px(c, 1, 1, 14, 12, 'rgba(255,230,140,0.18)');
  });
}

/** Thunder Mango — crackling mango with lightning (INSTANT). */
function thunderMangoSprite(frame: number): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    // mango
    px(c, 3, 4, 9, 10, '#f0a03a');
    px(c, 3, 4, 9, 2, '#ffd977');
    px(c, 2, 6, 2, 6, '#e07a3a'); px(c, 11, 6, 2, 6, '#c2591f');
    px(c, 4, 13, 7, 1, '#c2591f');
    px(c, 7, 1, 2, 3, PAL.leafDk); px(c, 8, 2, 4, 2, PAL.leaf); // stem+leaf
    // lightning bolt
    const b = frame === 0 ? '#f5f0ff' : '#c9e8ff';
    px(c, 8, 5, 2, 3, b); px(c, 6, 7, 4, 2, b); px(c, 6, 9, 2, 3, b); px(c, 5, 11, 3, 2, b);
    if (frame === 1) px(c, 1, 1, 14, 14, 'rgba(200,220,255,0.15)');
  });
}

/** Ember seed projectile (8x8, 2 frames). */
function emberSeedSprite(frame: number): HTMLCanvasElement {
  return mk(8, 8, (c) => {
    px(c, 1, 1, 6, 6, frame === 0 ? '#e8491f' : '#ff7a3a');
    px(c, 2, 2, 4, 4, frame === 0 ? '#ffb02e' : '#ffe07a');
    px(c, 3, 3, 2, 2, '#fff5c9');
  });
}

/** Macaw wings worn on the player's back (16x16 overlay, 2 flap frames). */
function wingsOverlaySprite(frame: number): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    const up = frame === 0;
    px(c, 0, up ? 2 : 6, 8, 3, '#e03a3a');
    px(c, 0, up ? 4 : 8, 7, 2, '#3a7ae0');
    px(c, 1, up ? 6 : 10, 6, 2, '#f2b632');
    px(c, 2, up ? 8 : 12, 4, 2, '#e03a3a');
  });
}

/** Capuchin buddy riding the player's shoulder (12x12). */
function capuchinBuddySprite(): HTMLCanvasElement {
  return mk(12, 12, (c) => {
    px(c, 3, 4, 7, 6, '#8a6a42');
    px(c, 4, 6, 5, 3, '#c9a76a');
    px(c, 5, 7, 1, 1, PAL.eye); px(c, 8, 7, 1, 1, PAL.eye);
    px(c, 2, 5, 1, 2, '#8a6a42'); px(c, 10, 5, 1, 2, '#8a6a42');
    px(c, 3, 10, 2, 2, '#5d4028'); px(c, 8, 10, 2, 2, '#5d4028');
    px(c, 1, 9, 2, 1, '#7a5a36'); // tail
    px(c, 4, 2, 5, 2, '#8a6a42'); // head tuft
  });
}

/** Swimmable lagoon water — translucent body + animated crest, 2 frames. */
function tileSwimWater(frame: number): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    // translucent body (alpha baked in so it renders over the background)
    px(c, 0, 3, 16, 13, 'rgba(38,190,205,0.45)');
    px(c, 0, 6, 16, 10, 'rgba(24,150,185,0.4)');
    // wave crest
    for (let x = 0; x < 16; x += 4) {
      const off = ((x / 4 + frame) % 2) === 0 ? 0 : 1;
      px(c, x + off, 0, 3, 2, 'rgba(220,250,255,0.9)');
    }
    // shimmer
    const rnd = mulberry32(77 + frame * 5);
    for (let i = 0; i < 4; i++) px(c, Math.floor(rnd() * 14), 5 + Math.floor(rnd() * 9), 2, 1, 'rgba(200,245,255,0.5)');
  });
}

/** Sandy lagoon ground. */
function tileSand(): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 0, 0, 16, 16, '#e0c98a');
    noise(c, 16, 16, 87, ['#c9b176', '#f0dcb0', '#b89c5e'], 0.2);
    px(c, 0, 0, 16, 2, '#f0e0b0');
    px(c, 0, 2, 16, 1, '#d0b878');
    // little shells
    px(c, 4, 8, 2, 2, '#f0e8d8'); px(c, 5, 9, 1, 1, '#c9a88a');
    px(c, 11, 12, 2, 1, '#e8d8c0');
  });
}

/** Swimfish — turquoise/orange river fish, 2 frames. */
function swimfishSprite(frame: number): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    px(c, 2, 5, 10, 7, '#2ea3c7'); // body
    px(c, 2, 5, 10, 2, '#6fd0e8');
    px(c, 3, 9, 8, 3, '#f08a3a'); // orange belly
    // tail
    if (frame === 0) { px(c, 12, 4, 3, 3, '#f08a3a'); px(c, 12, 9, 3, 3, '#f08a3a'); }
    else { px(c, 12, 5, 3, 6, '#f08a3a'); }
    // dorsal fin
    px(c, 6, 3, 4, 2, '#f08a3a');
    // eye + gill
    px(c, 4, 6, 2, 2, '#ffffff'); px(c, 4, 7, 1, 1, PAL.eye);
    px(c, 8, 6, 1, 5, '#1b6f8c');
  });
}

/** Static Starfruit — glitch fruit with magenta/cyan channel split, 2 jitter frames. */
function starfruitSprite(frame: number): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    const j = frame === 0 ? 0 : 1;
    // star shape (5-point starfruit)
    const star = (ox: number, col: string) => {
      px(c, 7 + ox, 1, 3, 4, col);
      px(c, 7 + ox, 11, 3, 4, col);
      px(c, 1 + ox, 5, 5, 4, col);
      px(c, 10 + ox, 5, 5, 4, col);
      px(c, 4 + ox, 3, 3, 3, col); px(c, 10 + ox, 10, 3, 3, col);
      px(c, 10 + ox, 3, 3, 3, col); px(c, 4 + ox, 10, 3, 3, col);
      px(c, 5 + ox, 5, 6, 6, col);
    };
    // channel-split ghosts
    star(-1 - j, 'rgba(255,0,220,0.55)');
    star(1 + j, 'rgba(0,240,255,0.55)');
    star(0, frame === 0 ? '#d8e84a' : '#c9f05a');
    px(c, 6, 6, 4, 4, '#f5ffc9');
    // static pixels
    const rnd = mulberry32(900 + frame * 7);
    for (let i = 0; i < 8; i++) px(c, Math.floor(rnd() * 16), Math.floor(rnd() * 16), 1, 1, rnd() < 0.5 ? '#ff00dc' : '#00f0ff');
  });
}

/** Mayan warp jar — terracotta ceremonial jar with jade/gold glyphs (20x26). */
function warpJarSprite(): HTMLCanvasElement {
  return mk(20, 26, (c) => {
    // body
    px(c, 3, 4, 14, 20, '#b56a3a');
    px(c, 3, 4, 14, 2, '#d88a54');
    px(c, 2, 8, 2, 12, '#9a5428'); px(c, 16, 8, 2, 12, '#9a5428');
    px(c, 4, 23, 12, 2, '#8a4820');
    // rim
    px(c, 2, 1, 16, 4, '#8a4820');
    px(c, 2, 1, 16, 1, '#d88a54');
    px(c, 4, 2, 12, 2, '#2a180c'); // mouth
    // jade band + glyphs
    px(c, 3, 9, 14, 5, '#2e8a6a');
    px(c, 3, 9, 14, 1, '#5ac8a0');
    px(c, 5, 10, 2, 3, '#f2b632'); px(c, 9, 10, 2, 3, '#f2b632'); px(c, 13, 10, 2, 3, '#f2b632');
    px(c, 5, 11, 2, 1, '#2e8a6a'); px(c, 9, 11, 2, 1, '#2e8a6a'); px(c, 13, 11, 2, 1, '#2e8a6a');
    // gold sun disc
    px(c, 8, 16, 4, 4, PAL.gold);
    px(c, 9, 17, 2, 2, PAL.goldHi);
    // feet
    px(c, 4, 24, 4, 2, '#6b3418'); px(c, 12, 24, 4, 2, '#6b3418');
  });
}

// ---------- key / seal / Aztec-enemy sprites ----------

/** Ornate Aztec key pendant (16x16). color: jade / gold / obsidian. */
function keySprite(main: string, hi: string, dk: string): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    // bow (ornate ring with glyph notches)
    px(c, 5, 1, 6, 6, main);
    px(c, 6, 2, 4, 4, hi);
    px(c, 7, 3, 2, 2, 'rgba(0,0,0,0.55)'); // ring hole
    px(c, 4, 2, 1, 2, dk); px(c, 11, 2, 1, 2, dk); // side knobs
    px(c, 7, 0, 2, 1, hi); // top glint
    // shaft
    px(c, 7, 7, 2, 6, main);
    px(c, 7, 7, 1, 6, hi);
    // stepped bit (Aztec steps)
    px(c, 9, 10, 3, 2, main); px(c, 9, 12, 5, 2, main);
    px(c, 9, 10, 3, 1, hi); px(c, 9, 12, 5, 1, hi);
    px(c, 13, 12, 1, 2, dk);
  });
}

/** Stone padlock / glyph seal overlay for locked goals (16x16). */
function lockSprite(main: string, hi: string, dk: string): HTMLCanvasElement {
  return mk(16, 16, (c) => {
    // stone body
    px(c, 2, 6, 12, 9, '#5a665a');
    px(c, 2, 6, 12, 1, '#8d9a8a');
    px(c, 2, 14, 12, 1, '#3a443a');
    // shackle
    px(c, 5, 2, 2, 5, main); px(c, 9, 2, 2, 5, main); px(c, 5, 2, 6, 2, main);
    px(c, 5, 2, 6, 1, hi);
    // glyph seal
    px(c, 6, 9, 4, 4, main);
    px(c, 7, 10, 2, 2, dk);
    px(c, 4, 8, 1, 1, hi); px(c, 11, 12, 1, 1, hi);
  });
}

/** Jaguar Warrior — obsidian-spotted Aztec jaguar knight (16x24, 2 frames). */
function jaguarWarriorSprite(frame: number): HTMLCanvasElement {
  return mk(16, 24, (c) => {
    // feathered headdress
    px(c, 3, 0, 2, 4, '#3fae4a'); px(c, 6, 0, 2, 5, '#f2b632'); px(c, 9, 0, 2, 5, '#e05a3a'); px(c, 12, 0, 2, 4, '#3fae4a');
    px(c, 3, 4, 10, 1, '#b57e17'); // headband
    // jaguar head
    px(c, 4, 5, 9, 6, '#e8a83a');
    px(c, 4, 5, 9, 1, '#f5c96a');
    px(c, 5, 7, 2, 2, '#ffffff'); px(c, 10, 7, 2, 2, '#ffffff');
    px(c, 5, 7, 1, 1, PAL.eye); px(c, 11, 7, 1, 1, PAL.eye);
    px(c, 7, 9, 3, 2, '#c98a4a'); // muzzle
    px(c, 8, 9, 1, 1, PAL.eye);
    px(c, 4, 5, 2, 2, '#7a4a16'); px(c, 11, 5, 2, 2, '#7a4a16'); // ears
    // spots
    px(c, 5, 5, 1, 1, '#3a2a16'); px(c, 9, 6, 1, 1, '#3a2a16'); px(c, 12, 8, 1, 1, '#3a2a16');
    // body — obsidian-studded armor
    px(c, 3, 11, 10, 7, '#c98a2a');
    px(c, 3, 11, 10, 1, '#e8b85a');
    px(c, 5, 13, 2, 2, '#2a2a30'); px(c, 9, 14, 2, 2, '#2a2a30'); px(c, 12, 12, 1, 1, '#2a2a30'); // obsidian studs
    px(c, 6, 16, 4, 2, '#7a4a16'); // belt
    // arms
    if (frame === 0) { px(c, 1, 11, 2, 5, '#e8a83a'); px(c, 13, 11, 2, 5, '#e8a83a'); }
    else { px(c, 1, 12, 2, 5, '#e8a83a'); px(c, 13, 12, 2, 5, '#e8a83a'); }
    // legs
    if (frame === 0) { px(c, 4, 18, 3, 4, '#e8a83a'); px(c, 9, 18, 3, 4, '#e8a83a'); }
    else { px(c, 3, 18, 3, 4, '#e8a83a'); px(c, 10, 18, 3, 4, '#e8a83a'); }
    px(c, 4, 22, 3, 2, '#5d4028'); px(c, 9, 22, 3, 2, '#5d4028'); // sandals
  });
}

/** Feathered Serpent — bright quetzal flying snake (20x12, 2 frames). */
function serpentSprite(frame: number): HTMLCanvasElement {
  return mk(20, 12, (c) => {
    // undulating body
    const lift = frame === 0 ? 0 : 1;
    px(c, 3, 5 - lift, 12, 4, '#2fae6a');
    px(c, 3, 5 - lift, 12, 1, '#6fe0a0');
    px(c, 3, 8 - lift, 12, 1, '#1f7a4a');
    px(c, 15, 4 + lift, 3, 3, '#2fae6a'); // tail tip
    px(c, 17, 3 + lift, 2, 2, '#6fe0a0');
    // feather ruffs along the back
    px(c, 5, 2 - lift, 2, 3, '#3ac8f0'); px(c, 8, 1 - lift, 2, 4, '#f2b632'); px(c, 11, 2 - lift, 2, 3, '#3ac8f0');
    // head
    px(c, 0, 3 - lift, 5, 5, '#2fae6a');
    px(c, 0, 3 - lift, 5, 1, '#6fe0a0');
    px(c, 1, 4 - lift, 2, 2, '#ffffff'); px(c, 1, 5 - lift, 1, 1, PAL.eye);
    px(c, 0, 7 - lift, 3, 1, '#e05a3a'); // jaw
    // head plumes
    px(c, 2, 0 - lift, 2, 3, '#3ac8f0'); px(c, 4, 0 - lift, 2, 2, '#f2b632');
    // belly scales
    px(c, 5, 7 - lift, 1, 1, '#e8e08a'); px(c, 8, 7 - lift, 1, 1, '#e8e08a'); px(c, 11, 7 - lift, 1, 1, '#e8e08a');
  });
}

/** Sun Stone Sentinel — carved calendar-stone turret on a pedestal (24x24, 2 frames). */
function sentinelSprite(frame: number): HTMLCanvasElement {
  return mk(24, 24, (c) => {
    // pedestal
    px(c, 6, 18, 12, 6, '#5a665a');
    px(c, 6, 18, 12, 1, '#8d9a8a');
    px(c, 8, 20, 8, 1, '#4a554a');
    // calendar-stone disc
    px(c, 3, 2, 18, 16, '#95a293');
    px(c, 3, 2, 18, 2, '#b4c0b2');
    px(c, 3, 16, 18, 2, '#5a665a');
    // carved rings
    px(c, 5, 4, 14, 1, '#5a665a'); px(c, 5, 15, 14, 1, '#5a665a');
    px(c, 5, 4, 1, 12, '#5a665a'); px(c, 18, 4, 1, 12, '#5a665a');
    // sun face
    const eye = frame === 0 ? '#f2b632' : '#ffe07a';
    px(c, 8, 6, 2, 2, eye); px(c, 14, 6, 2, 2, eye);
    px(c, 9, 10, 6, 2, '#5a665a'); // mouth slot (dart muzzle)
    px(c, 10, 11, 4, 1, frame === 0 ? '#ffb02e' : '#3a443a'); // glow when charging
    // sun rays
    px(c, 11, 0, 2, 2, '#f2b632'); px(c, 0, 9, 3, 2, '#f2b632'); px(c, 21, 9, 3, 2, '#f2b632');
    px(c, 2, 3, 2, 2, '#b57e17'); px(c, 20, 3, 2, 2, '#b57e17');
  });
}

/** Sun-dart projectile (10x6, 2 frames). */
function sunDartSprite(frame: number): HTMLCanvasElement {
  return mk(10, 6, (c) => {
    px(c, 2, 2, 7, 2, frame === 0 ? '#ffb02e' : '#f2b632'); // shaft
    px(c, 0, 1, 3, 4, '#ffe07a'); // head
    px(c, 0, 2, 1, 2, '#ffffff');
    px(c, 7, 0, 2, 1, '#e05a3a'); px(c, 7, 5, 2, 1, '#e05a3a'); // fletching
  });
}

/** EXTREME crown mark drawn above extreme enemies (12x6). */
function extremeCrownSprite(): HTMLCanvasElement {
  return mk(12, 6, (c) => {
    px(c, 1, 2, 10, 3, '#f2b632');
    px(c, 1, 2, 10, 1, '#ffe07a');
    px(c, 1, 0, 2, 3, '#f2b632'); px(c, 5, 0, 2, 3, '#f2b632'); px(c, 9, 0, 2, 3, '#f2b632');
    px(c, 2, 3, 2, 1, '#e03a3a'); px(c, 8, 3, 2, 1, '#e03a3a'); // ruby studs
  });
}

// ---------- parallax backgrounds (512x288 each layer) ----------

/** Stepped Aztec pyramid silhouette with hanging vines + optional summit shrine smoke. */
function drawPyramid(c: Ctx, bx: number, baseY: number, w: number, steps: number, col: string, vineCol: string | null, smoke: boolean): void {
  const stepH = Math.max(6, Math.floor(w / (steps * 2.2)));
  c.fillStyle = col;
  for (let s = 0; s < steps; s++) {
    const sw = w * (1 - s / (steps + 0.5));
    c.fillRect(Math.round(bx - sw / 2), baseY - (s + 1) * stepH, Math.round(sw), stepH);
  }
  const topW = w * (1 - (steps - 1) / (steps + 0.5));
  const topY = baseY - steps * stepH;
  // summit shrine
  c.fillRect(Math.round(bx - topW * 0.22), topY - Math.round(stepH * 0.9), Math.round(topW * 0.44), Math.round(stepH * 0.9));
  c.fillRect(Math.round(bx - topW * 0.28), topY - Math.round(stepH * 0.9) - 2, Math.round(topW * 0.56), 2);
  // central stair groove
  c.fillRect(Math.round(bx - topW * 0.08), topY, Math.round(topW * 0.16), baseY - topY);
  // hanging vines on the steps
  if (vineCol) {
    c.fillStyle = vineCol;
    const rnd = mulberry32(Math.round(bx + baseY));
    for (let i = 0; i < steps * 2; i++) {
      const vy = baseY - Math.floor(rnd() * steps * stepH);
      const vx = Math.round(bx - w / 2 + rnd() * w);
      c.fillRect(vx, vy, 2, 4 + Math.floor(rnd() * 10));
    }
  }
  // smoking summit
  if (smoke) {
    const rnd = mulberry32(Math.round(bx * 3));
    for (let i = 0; i < 6; i++) {
      const sy = topY - stepH - 6 - i * 9;
      const sx = bx + Math.sin(i * 1.3) * (4 + i * 2.5) + rnd() * 4;
      c.fillStyle = `rgba(200,190,200,${(0.28 - i * 0.04).toFixed(2)})`;
      c.beginPath(); c.arc(sx, sy, 4 + i * 1.6, 0, Math.PI * 2); c.fill();
    }
  }
}

function bgOverworld(layer: number): HTMLCanvasElement {
  return mk(512, 288, (c) => {
    if (layer === 0) {
      const g = c.createLinearGradient(0, 0, 0, 288);
      g.addColorStop(0, '#bfe8c9'); g.addColorStop(0.6, '#8fd0a8'); g.addColorStop(1, '#6bb98e');
      c.fillStyle = g; c.fillRect(0, 0, 512, 288);
      // god rays
      c.fillStyle = 'rgba(255,255,220,0.16)';
      for (let i = 0; i < 5; i++) {
        const x = 40 + i * 110;
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 46, 0); c.lineTo(x + 130, 288); c.lineTo(x + 60, 288); c.fill();
      }
      // distant waterfall
      px(c, 380, 90, 26, 198, 'rgba(210,240,255,0.55)');
      px(c, 386, 90, 6, 198, 'rgba(255,255,255,0.5)');
    } else if (layer === 1) {
      // distant stepped pyramids rising over the canopy (muted, hazy)
      drawPyramid(c, 130, 288, 150, 5, 'rgba(70,120,96,0.5)', 'rgba(46,110,74,0.45)', false);
      drawPyramid(c, 420, 288, 110, 4, 'rgba(76,126,100,0.42)', 'rgba(46,110,74,0.4)', false);
      // atmospheric haze between pyramids and jungle
      c.fillStyle = 'rgba(160,220,190,0.14)';
      c.fillRect(0, 120, 512, 168);
      // distant jungle silhouettes
      c.fillStyle = 'rgba(46,110,74,0.55)';
      const rnd = mulberry32(201);
      for (let x = 0; x < 512; x += 24) {
        const h = 60 + rnd() * 70;
        c.fillRect(x, 288 - h - 60, 30, h + 60);
        c.beginPath(); c.arc(x + 15, 288 - h - 60, 22 + rnd() * 14, 0, Math.PI * 2); c.fill();
      }
    } else {
      c.fillStyle = 'rgba(24,80,50,0.8)';
      const rnd = mulberry32(202);
      for (let x = 0; x < 512; x += 40) {
        const h = 40 + rnd() * 50;
        c.fillRect(x, 288 - h - 20, 46, h + 20);
        c.beginPath(); c.arc(x + 23, 288 - h - 20, 30 + rnd() * 16, 0, Math.PI * 2); c.fill();
      }
    }
  });
}

function bgUnderworld(layer: number): HTMLCanvasElement {
  return mk(512, 288, (c) => {
    if (layer === 0) {
      const g = c.createLinearGradient(0, 0, 0, 288);
      g.addColorStop(0, '#0e1a1c'); g.addColorStop(0.75, '#14262a'); g.addColorStop(1, '#3a1e10');
      c.fillStyle = g; c.fillRect(0, 0, 512, 288);
      // lava glow at bottom
      const g2 = c.createLinearGradient(0, 220, 0, 288);
      g2.addColorStop(0, 'rgba(255,90,31,0)'); g2.addColorStop(1, 'rgba(255,110,40,0.4)');
      c.fillStyle = g2; c.fillRect(0, 220, 512, 68);
    } else if (layer === 1) {
      // glowing crystals
      const rnd = mulberry32(301);
      for (let i = 0; i < 10; i++) {
        const x = rnd() * 500, y = 40 + rnd() * 180, s = 6 + rnd() * 12;
        const col = rnd() < 0.5 ? 'rgba(90,220,230,0.5)' : 'rgba(190,120,240,0.45)';
        c.fillStyle = col;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + s, y + s * 2); c.lineTo(x + s * 0.4, y + s * 2.6); c.lineTo(x - s * 0.4, y + s * 1.4); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.fillRect(x, y + 2, 2, s);
      }
      // stalactites
      c.fillStyle = 'rgba(30,48,52,0.85)';
      for (let x = 0; x < 512; x += 28) {
        const h = 20 + mulberry32(x)() * 50;
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 22, 0); c.lineTo(x + 11, h); c.fill();
      }
    } else {
      c.fillStyle = 'rgba(10,20,22,0.9)';
      const rnd = mulberry32(302);
      for (let x = 0; x < 512; x += 44) {
        const h = 30 + rnd() * 60;
        c.beginPath(); c.moveTo(x, 288); c.lineTo(x + 40, 288); c.lineTo(x + 20, 288 - h); c.fill();
      }
    }
  });
}

function bgCanopy(layer: number): HTMLCanvasElement {
  return mk(512, 288, (c) => {
    if (layer === 0) {
      const g = c.createLinearGradient(0, 0, 0, 288);
      g.addColorStop(0, '#7ec8f0'); g.addColorStop(0.7, '#aee0f8'); g.addColorStop(1, '#d8f0e8');
      c.fillStyle = g; c.fillRect(0, 0, 512, 288);
      // sun
      c.fillStyle = 'rgba(255,246,200,0.9)';
      c.beginPath(); c.arc(400, 54, 30, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,246,200,0.3)';
      c.beginPath(); c.arc(400, 54, 46, 0, Math.PI * 2); c.fill();
    } else if (layer === 1) {
      // clouds
      c.fillStyle = 'rgba(255,255,255,0.85)';
      const rnd = mulberry32(401);
      for (let i = 0; i < 7; i++) {
        const x = rnd() * 480, y = 20 + rnd() * 120;
        c.beginPath();
        c.arc(x, y, 16, 0, Math.PI * 2); c.arc(x + 18, y - 6, 20, 0, Math.PI * 2); c.arc(x + 38, y, 16, 0, Math.PI * 2);
        c.fill();
      }
    } else {
      // sea of treetops below
      c.fillStyle = 'rgba(38,120,70,0.75)';
      const rnd = mulberry32(402);
      for (let x = 0; x < 512; x += 18) {
        const y = 200 + rnd() * 30;
        c.beginPath(); c.arc(x + 9, y + 20, 20 + rnd() * 12, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = 'rgba(20,90,52,0.85)';
      for (let x = 8; x < 512; x += 26) {
        const y = 230 + rnd() * 26;
        c.beginPath(); c.arc(x + 9, y + 20, 22 + rnd() * 12, 0, Math.PI * 2); c.fill();
      }
    }
  });
}

function bgBoss(layer: number): HTMLCanvasElement {
  return mk(512, 288, (c) => {
    if (layer === 0) {
      const g = c.createLinearGradient(0, 0, 0, 288);
      g.addColorStop(0, '#1a141e'); g.addColorStop(0.7, '#2c2030'); g.addColorStop(1, '#54280f');
      c.fillStyle = g; c.fillRect(0, 0, 512, 288);
      const g2 = c.createLinearGradient(0, 200, 0, 288);
      g2.addColorStop(0, 'rgba(255,90,31,0)'); g2.addColorStop(1, 'rgba(255,100,30,0.5)');
      c.fillStyle = g2; c.fillRect(0, 200, 512, 88);
    } else if (layer === 1) {
      // the great stepped pyramid of the Cursed Idol, summit shrine smoking
      drawPyramid(c, 256, 288, 300, 7, 'rgba(58,64,58,0.85)', 'rgba(50,100,58,0.5)', true);
      // overgrown ruin pillars
      c.fillStyle = 'rgba(70,84,66,0.7)';
      for (let x = 20; x < 512; x += 90) {
        c.fillRect(x, 60, 26, 228);
        c.fillRect(x - 6, 52, 38, 12);
        c.fillStyle = 'rgba(60,120,70,0.6)';
        c.fillRect(x + 4, 60, 5, 100);
        c.fillStyle = 'rgba(70,84,66,0.7)';
      }
    } else {
      // torches
      const rnd = mulberry32(501);
      for (let x = 40; x < 512; x += 120) {
        px(c, x, 150, 6, 60, 'rgba(60,48,36,0.9)');
        c.fillStyle = 'rgba(255,150,50,0.85)';
        c.beginPath(); c.arc(x + 3, 144, 8 + rnd() * 3, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,220,120,0.9)';
        c.beginPath(); c.arc(x + 3, 146, 4, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = 'rgba(30,40,30,0.85)';
      c.fillRect(0, 250, 512, 38);
    }
  });
}

function bgLagoon(layer: number): HTMLCanvasElement {
  return mk(512, 288, (c) => {
    if (layer === 0) {
      // sunlit shallows gradient
      const g = c.createLinearGradient(0, 0, 0, 288);
      g.addColorStop(0, '#9fe8e0'); g.addColorStop(0.35, '#5ecfc8'); g.addColorStop(1, '#2a9ab0');
      c.fillStyle = g; c.fillRect(0, 0, 512, 288);
      // god rays through the water
      c.fillStyle = 'rgba(240,255,240,0.18)';
      for (let i = 0; i < 6; i++) {
        const x = 20 + i * 90;
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 36, 0); c.lineTo(x + 110, 288); c.lineTo(x + 50, 288); c.fill();
      }
      // sun glitter at the surface
      c.fillStyle = 'rgba(255,255,230,0.35)';
      for (let x = 0; x < 512; x += 14) c.fillRect(x, 4 + (x % 3), 8, 2);
    } else if (layer === 1) {
      // faint submerged pyramid ruins on the lagoon floor
      drawPyramid(c, 120, 288, 170, 5, 'rgba(20,100,105,0.4)', 'rgba(24,120,110,0.35)', false);
      drawPyramid(c, 400, 288, 120, 4, 'rgba(18,92,98,0.35)', 'rgba(24,120,110,0.3)', false);
      // distant mangrove roots
      c.fillStyle = 'rgba(22,90,80,0.5)';
      const rnd = mulberry32(601);
      for (let x = 0; x < 512; x += 46) {
        c.fillRect(x, 40, 10, 150);
        c.beginPath(); c.moveTo(x - 8, 288); c.quadraticCurveTo(x + 5, 200, x + 5, 160); c.lineTo(x + 12, 160); c.quadraticCurveTo(x + 16, 220, x + 26, 288); c.fill();
        c.beginPath(); c.arc(x + 5, 46, 26 + rnd() * 16, 0, Math.PI * 2); c.fill();
      }
      // distant coral
      c.fillStyle = 'rgba(240,140,110,0.4)';
      for (let x = 20; x < 512; x += 80) {
        c.fillRect(x, 240, 6, 30); c.fillRect(x - 6, 250, 4, 20); c.fillRect(x + 8, 246, 4, 24);
      }
    } else {
      // nearer coral + plants
      const rnd = mulberry32(602);
      for (let x = 0; x < 512; x += 60) {
        c.fillStyle = 'rgba(30,120,100,0.65)';
        c.fillRect(x, 250, 4, 38); c.fillRect(x + 6, 256, 4, 32);
        c.fillStyle = 'rgba(230,110,90,0.6)';
        c.beginPath(); c.arc(x + 22, 268, 10 + rnd() * 6, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(240,190,120,0.5)';
        c.beginPath(); c.arc(x + 40, 276, 7, 0, Math.PI * 2); c.fill();
      }
    }
  });
}

// ---------- public API ----------

export function generateTextures(): TexAtlas {
  const map = new Map<string, HTMLCanvasElement>();
  const put = (name: string, cv: HTMLCanvasElement) => map.set(name, cv);

  // tiles
  put('ground', tileGround());
  put('dirt', tileDirt());
  put('brick', tileBrick());
  for (let f = 0; f < 3; f++) put(`question:${f}`, tileQuestion(f));
  put('questionUsed', tileQuestionUsed());
  put('stone', tileStone());
  put('logTop', tileLogTop());
  put('logBody', tileLogBody());
  put('vine', tileVine());
  put('wood', tileWood());
  put('cloud', tileCloud());
  for (let f = 0; f < 2; f++) { put(`lava:${f}`, tileLava(f)); put(`water:${f}`, tileWater(f)); put(`swimWater:${f}`, tileSwimWater(f)); }
  put('sand', tileSand());
  for (let f = 0; f < 2; f++) { put(`swimfish:${f}`, swimfishSprite(f)); put(`staticStarfruit:${f}`, starfruitSprite(f)); }
  put('warpJar', warpJarSprite());
  put('spikes', tileSpikes());
  put('bridge', tileBridge());
  put('leaves', tileLeaves());
  put('foliage:0', tileFoliage(0));
  put('foliage:1', tileFoliage(1));
  put('temple', tileTemple());
  put('gongStand', tileGongStand());

  // player (normal + FORM variants, big-only for forms)
  for (const fr of ['idle', 'run1', 'run2', 'jump'] as const) {
    put(`playerSmall:${fr}`, playerSprite(false, fr));
    put(`playerBig:${fr}`, playerSprite(true, fr));
    put(`playerEmber:${fr}`, playerSprite(true, fr, { shirt: '#e8491f', hat: '#ff7a3a' }));
    put(`playerFrog:${fr}`, playerSprite(true, fr, { shirt: '#4fae4a', hood: 'frog' }));
    put(`playerAnvil:${fr}`, playerSprite(true, fr, { shirt: '#8a6a3a', hood: 'anvil' }));
  }

  // powerup items
  for (let f = 0; f < 2; f++) {
    put(`emberChili:${f}`, emberChiliSprite(f));
    put(`macawWings:${f}`, macawWingsSprite(f));
    put(`grasshopperLegs:${f}`, grasshopperLegsSprite(f));
    put(`shrinkberry:${f}`, shrinkberrySprite(f));
    put(`goldenBanana:${f}`, goldenBananaSprite(f));
    put(`thunderMango:${f}`, thunderMangoSprite(f));
    put(`emberSeed:${f}`, emberSeedSprite(f));
    put(`wingsOverlay:${f}`, wingsOverlaySprite(f));
  }
  for (let f = 0; f < 6; f++) put(`rainbowOrchid:${f}`, rainbowOrchidSprite(f));
  put('frogSuit', frogSuitSprite());
  put('kapokAnvil', kapokAnvilSprite());
  put('jaguarPelt', jaguarPeltSprite());
  put('coinCapuchin', coinCapuchinSprite());
  put('capuchinBuddy', capuchinBuddySprite());

  // enemies & friends
  for (let f = 0; f < 2; f++) {
    put(`beetle:${f}`, beetleSprite(f));
    put(`tortoiseGreen:${f}`, tortoiseSprite('green', f));
    put(`tortoiseRed:${f}`, tortoiseSprite('red', f));
    put(`flytrap:${f}`, flytrapSprite(f));
    put(`monkey:${f}`, monkeySprite(f));
    put(`eagle:${f}`, eagleSprite(f));
    put(`armadillo:${f}`, armadilloSprite(f));
    put(`piranha:${f}`, piranhaSprite(f));
    put(`bloom:${f}`, bloomSprite(f));
    put(`fireball:${f}`, fireballSprite(f));
  }
  put('shell:green', shellSprite('green'));
  put('shell:red', shellSprite('red'));
  put('shell:armadillo', shellSprite('armadillo'));
  put('coconut', coconutSprite());
  put('durian', durianSprite());
  // colored keys + goal seals
  put('keyJade', keySprite('#3fae8a', '#7fe0bd', '#1f6e55'));
  put('keyGold', keySprite('#f2b632', '#ffe07a', '#b57e17'));
  put('keyObsidian', keySprite('#8a5ad6', '#b78af0', '#4a2a80'));
  put('lock:jade', lockSprite('#3fae8a', '#7fe0bd', '#1f6e55'));
  put('lock:gold', lockSprite('#f2b632', '#ffe07a', '#b57e17'));
  put('lock:obsidian', lockSprite('#8a5ad6', '#b78af0', '#4a2a80'));
  // Aztec enemies + EXTREME crown
  for (let f = 0; f < 2; f++) {
    put(`jaguarWarrior:${f}`, jaguarWarriorSprite(f));
    put(`serpent:${f}`, serpentSprite(f));
    put(`sentinel:${f}`, sentinelSprite(f));
    put(`sunDart:${f}`, sunDartSprite(f));
  }
  put('extremeCrown', extremeCrownSprite());
  for (let f = 0; f < 4; f++) put(`coin:${f}`, coinSprite(f));
  put('checkpoint:0', checkpointSprite(false));
  put('checkpoint:1', checkpointSprite(true));
  put('goal', goalSprite());
  put('gong:0', gongSprite(0));
  put('gong:1', gongSprite(1));
  put('axe:0', axeSprite(0));
  put('axe:1', axeSprite(1));
  put('boss:0', bossSprite(0));
  put('boss:1', bossSprite(1));

  const bgs = new Map<string, HTMLCanvasElement>();
  const themes: [string, (l: number) => HTMLCanvasElement][] = [
    ['overworld', bgOverworld], ['underworld', bgUnderworld], ['canopy', bgCanopy], ['boss', bgBoss],
    ['lagoon', bgLagoon],
  ];
  for (const [t, fn] of themes) for (let l = 0; l < 3; l++) bgs.set(`${t}:${l}`, fn(l));

  return {
    get(name: string): HTMLCanvasElement {
      const cv = map.get(name);
      if (!cv) throw new Error('missing texture: ' + name);
      return cv;
    },
    bg(theme: string, layer: number): HTMLCanvasElement {
      return bgs.get(`${theme}:${layer}`)!;
    },
  };
}
