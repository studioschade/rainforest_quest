import { useRQ } from './useRQ';

const ROWS: { keys: string; action: string }[] = [
  { keys: '← → ↑ ↓ or W A S D', action: 'Move / climb menus' },
  { keys: 'Space or Z', action: 'Jump (hold for higher, release to cut short)' },
  { keys: 'Space or Z (in water)', action: 'Swim stroke — tap repeatedly to paddle upward' },
  { keys: '↓ (on a Warp Jar)', action: 'Dive in: warp to the target — finish that level to pop back out at the jar' },
  { keys: 'X (hold)', action: 'Run faster' },
  { keys: 'G', action: 'Open the Glitch Caverns menu (physics + cheats)' },
  { keys: 'B', action: 'Toggle Build Mode (level editor) / Test Play' },
  { keys: 'Esc or P', action: 'Pause' },
  { keys: 'M', action: 'Toggle sound / music' },
];

const TIPS: string[] = [
  'Stomp Mossback Beetles and Shellback Tortoises. Kicked shells smash bricks and other enemies.',
  'Golden ? blocks hide coins — and some hide a Spirit Bloom that makes you grow.',
  'Big explorers can smash mossy brick blocks by headbutting them from below.',
  'Snapjaw Flytraps and Spiky Durians cannot be stomped. Seriously. Do not try.',
  'Red tortoises turn around at ledges; green ones march straight off.',
  'In the idol\'s arena, dash past the Cursed Idol and grab the Jade Axe on the far platform — it fells the idol and drops the bridge.',
  'Touch the Goal Totem to finish a level. Checkpoints (carved posts) save your respawn spot.',
  'Swimming: bright blue Swim Water is safe — tap jump to stroke upward, hold a direction to drift. Dark Water still bites. There is no breath meter; take your time.',
  'Swimfish patrol the lagoons. You can stomp them from above, but never touch them while you are swimming too.',
  'Warp Jars are ancient Mayan portals. Stand on one and press DOWN to warp. Level targets are round-trips: finish the target level and you pop back out beside the jar, score and lives intact (up to 3 nested trips). Jars aimed at a World are one-way. If the jar is sealed (no valid target, or the stack is full) it just rattles.',
  'Temple keys (jade, gold, obsidian) open the matching sealed Goal Totem. Keys are never used up — one key opens every matching seal, and they show in the HUD.',
  'Jaguar Warriors crouch, then lunge — hop over them or stomp mid-walk. Sun Serpents patrol in a sine wave, ignoring walls. Sun Stone Sentinels are ember-proof; their arcing sun darts burn — stomp the statue itself.',
  'Enemies wearing a tiny crown are EXTREME variants: bigger, faster, with nastier tricks — but worth 3x score. Some need two stomps; the first only cracks them.',
];

const POWERUPS: { name: string; desc: string }[] = [
  { name: 'Spirit Bloom', desc: 'Grows you big. Big explorers smash bricks and survive one hit.' },
  { name: 'Ember Chili (form)', desc: 'Press X to spit bouncing ember seeds. Armadillos are fireproof!' },
  { name: 'Tree Frog Suit (form)', desc: '+25% jump. Hold toward a wall to cling, then jump to wall-jump away.' },
  { name: 'Kapok Anvil (form)', desc: 'Press DOWN in mid-air to ground pound: crushes neighbors and bricks below.' },
  { name: 'Macaw Wings (12s)', desc: 'Hold jump to flap upward, release to glide gently down.' },
  { name: 'Jaguar Pelt (10s)', desc: '1.8x speed, lightning acceleration, enemies burst on contact.' },
  { name: 'Rainbow Orchid (8s)', desc: 'Full invincibility and kill-on-touch. Pits and lava still bite.' },
  { name: 'Grasshopper Legs (14s)', desc: '1.6x jump power and super-high stomp bounces.' },
  { name: 'Shrinkberry (15s)', desc: 'Shrink to half size and slip through 1-tile gaps.' },
  { name: 'Coin Capuchin (20s)', desc: 'A tiny monkey rides you and vacuums up nearby coins.' },
  { name: 'Golden Banana', desc: 'Instant: every enemy on screen turns into a coin.' },
  { name: 'Thunder Mango', desc: 'Instant: lightning clears the screen and shatters nearby bricks.' },
  { name: 'Static Starfruit', desc: 'Instant CHAOS: 50% Glitch Surge (a random glitch forced ON for 10s) or 50% Physics Scramble (every physics slider randomized for 5s). The screen will not survive unscathed. Always restores itself — never writes to your saved settings.' },
];

export function HowToPlay() {
  const ctl = useRQ();
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#04140b]/95 p-4">
      <div className="panel-jungle w-full max-w-2xl max-h-[88vh] overflow-y-auto dnd-list p-6">
        <h2 className="font-retro text-2xl text-amber-300 text-glow-gold mb-4">How to Play</h2>
        <div className="mb-5">
          {ROWS.map((r) => (
            <div key={r.keys} className="flex justify-between gap-4 py-1.5 border-b border-emerald-900/60">
              <span className="text-amber-200 font-mono text-sm whitespace-nowrap">{r.keys}</span>
              <span className="text-emerald-100 text-sm text-right">{r.action}</span>
            </div>
          ))}
        </div>
        <h3 className="font-retro text-emerald-300 text-glow-green mb-2">Powerups</h3>
        <div className="mb-5">
          {POWERUPS.map((p) => (
            <div key={p.name} className="py-1.5 border-b border-emerald-900/60">
              <span className="text-amber-200 font-bold text-sm">{p.name}</span>
              <span className="block text-emerald-100/85 text-sm">{p.desc}</span>
            </div>
          ))}
        </div>
        <h3 className="font-retro text-emerald-300 text-glow-green mb-2">Field Notes</h3>
        <ul className="list-disc list-inside text-emerald-100/85 text-sm space-y-1.5 mb-6">
          {TIPS.map((t) => <li key={t}>{t}</li>)}
        </ul>
        <button className="btn-jungle w-full" onClick={() => { ctl.screen = 'title'; ctl.bump(); }}>
          Back
        </button>
      </div>
    </div>
  );
}
