# 🌿 Rainforest Quest

A Super Mario Bros.-style platformer reimagined deep in the rainforest — with a glitch-physics playground, a full level editor, warp jars, colored keys, and procedurally generated everything: pixel-art textures, chiptune music, and sound effects. No external assets, no image files, no audio files — it's all code.

Built with **React + TypeScript + Vite + Tailwind CSS**, rendered on HTML5 Canvas.

---

## 🎮 The Game

Play as a jungle explorer across the five-level **Rainforest Saga**:

| # | Level | Theme |
|---|-------|-------|
| 1-1 | Emerald Floor | Overworld rainforest |
| 1-2 | Sunken Grotto | Underworld lava caves |
| 1-3 | Canopy Heights | Treetop platforms |
| 1-4 | Azure Lagoon | Swimming + sunken ruins |
| 1-5 | Idol's Sanctum | Boss: The Cursed Idol |

Faithful SMB1 physics: acceleration/friction, variable jump height, coyote time, jump buffering, stomp bounces, question blocks, breakable bricks, checkpoints, and 100-coins-for-a-1UP.

## 👾 Enemies

The SMB1 roster, rainforest-reskinned — Mossback Beetles (Goombas), Shellback Tortoises with full shell-kick mechanics (Koopas), Snapjaw Flytraps (Piranha Plants), Coconut Monkeys (Hammer Bros), a Harpy Eagle dropping Spiky Durians (Lakitu + Spinies), bump-proof Armadillos (Buzzy Beetles), and Leaping Piranhas (Cheep Cheeps).

Plus three original Aztec threats — the lunging **Jaguar Warrior**, the sine-flying **Sun Serpent**, and the dart-spitting **Sun Stone Sentinel** — and every enemy has an **EXTREME variant** (bigger, faster, crowned, 3× score, extra HP, weird new tricks).

The boss is **The Cursed Idol**, a stone statue with floaty, dodgeable jumps. Grab the **Jade Axe** behind it to drop the bridge — or land 3 shell/ember hits.

## ⭐ Powerups (12!)

- **Spirit Bloom** — grow big, smash bricks (the mushroom)
- **Ember Chili** — spit bouncing ember seeds
- **Tree Frog Suit** — wall-cling + wall-jump
- **Kapok Anvil** — mid-air ground pound
- **Macaw Wings** · **Jaguar Pelt** · **Rainbow Orchid** · **Grasshopper Legs** · **Shrinkberry** · **Coin Capuchin** (timed)
- **Golden Banana** — every on-screen enemy becomes a coin
- **Thunder Mango** — screen-clearing lightning
- **Static Starfruit** — chaos! Randomly forces a glitch ON for 10 s or scrambles the physics sliders for 5 s, with trippy (but tasteful) screen effects — then restores everything

## 🧪 Glitch Menu — press `G`

8 live physics sliders (gravity, jump power, run speed, acceleration, friction, bounce, enemy speed, time scale) plus 17 toggleable glitches: Moon Gravity, Infinite/Double Jump, Wall Jump, Super Bounce, Ice Physics, Trampoline Ground, Ghost Walk, Invincible, Tiny/Giant Player, Big Head, Rainbow Trail, Slow-Mo, Reversed Controls, Enemy Confetti, Springy Shells. Persists to `localStorage`.

## 🛠️ Level Editor — press `B`

Full tile/enemy/item placement with ghost preview, pan, and test-play. Place EXTREME enemies, locked goals, warp jars with destination dropdowns, and every powerup. Save levels as downloadable `.json` files or named `localStorage` slots, and chain levels into **Worlds** with a drag-and-drop sequencer (self-contained export/import).

Extra mechanics for builders: **Mayan warp jars** (round-trip warps that return you to the jar), **colored keys** (jade/gold/obsidian) with matching **locked goals**, and swimmable water.

## 🎵 Audio

Fully procedural WebAudio chiptune: a per-theme square/triangle-wave music loop (the lagoon waltz is a personal favorite) and 20+ synthesized SFX. Volume slider in the pause menu, `M` to mute — persisted between sessions.

## ⌨️ Controls

| Input | Action |
|---|---|
| Arrows / WASD | Move |
| Space / Z (hold) | Jump (stroke while swimming) |
| X | Run / fire embers |
| ↓ (mid-air) | Ground pound (Kapok Anvil) |
| ↓ (on a warp jar) | Warp |
| `G` / `B` | Glitch menu / Build mode |
| Esc / P | Pause |
| `M` | Mute |

## 🚀 Run It

```bash
npm install
npm run dev      # dev server with HMR
npm run build    # production build → dist/
```

Requires Node.js 20+.

## 🧪 Tests

A headless smoke suite (167 assertions) simulates the engine without a browser — physics, enemies, powerups, warp round-trips, keys, editor round-trips, soft-lock guards, and more:

```bash
npx esbuild test/smoke.ts --bundle --platform=node --format=esm --outfile=test/smoke.mjs
node test/smoke.mjs
```

## 📁 Structure

```
src/
  game/          engine, physics config, textures, audio, levels, controller
  components/    React shell: title, HUD, pause, glitch menu, editor, worlds
test/smoke.ts    headless engine test suite
```

---

*All art, music, and sound are generated at runtime. No assets were harmed (or used) in the making of this game.* 🐸
