import { useState } from 'react';
import { useRQ } from './useRQ';
import { TILE } from '@/game/types';
import type { LevelData } from '@/game/types';
import { saveCustomLevel, downloadJson, pickJsonFile, validateLevel, listCustomLevels, listWorlds } from '@/game/storage';
import { BUILTIN_LEVELS } from '@/game/builtinLevels';

type Cat = 'tiles' | 'enemies' | 'items' | 'special';

const TILE_ITEMS: { name: string; tile: number }[] = [
  { name: 'Ground', tile: TILE.Ground },
  { name: 'Dirt', tile: TILE.Dirt },
  { name: 'Brick', tile: TILE.Brick },
  { name: '? Block', tile: TILE.Question },
  { name: 'Stone', tile: TILE.Stone },
  { name: 'Log Top', tile: TILE.LogTop },
  { name: 'Log Body', tile: TILE.LogBody },
  { name: 'Vine', tile: TILE.Vine },
  { name: 'Wood Plank', tile: TILE.Wood },
  { name: 'Cloud', tile: TILE.Cloud },
  { name: 'Lava', tile: TILE.Lava },
  { name: 'Water', tile: TILE.Water },
  { name: 'Spikes', tile: TILE.Spikes },
  { name: 'Bridge', tile: TILE.Bridge },
  { name: 'Leaves', tile: TILE.Leaves },
  { name: 'Foliage', tile: TILE.Foliage },
  { name: 'Temple', tile: TILE.Temple },
  { name: 'Gong Stand', tile: TILE.GongTile },
  { name: 'Swim Water', tile: TILE.SwimWater },
  { name: 'Sand', tile: TILE.Sand },
];

const ENEMY_ITEMS: { name: string; entity: string }[] = [
  { name: 'Mossback Beetle', entity: 'beetle' },
  { name: 'Tortoise (G)', entity: 'tortoiseGreen' },
  { name: 'Tortoise (R)', entity: 'tortoiseRed' },
  { name: 'Tan Koopa', entity: 'tortoiseTan' },
  { name: 'Snapjaw Flytrap', entity: 'flytrap' },
  { name: 'Coconut Monkey', entity: 'monkey' },
  { name: 'Harpy Eagle', entity: 'eagle' },
  { name: 'Spiky Durian', entity: 'durian' },
  { name: 'Armadillo', entity: 'armadillo' },
  { name: 'Leaping Piranha', entity: 'piranha' },
  { name: 'Swimfish', entity: 'swimfish' },
  { name: 'Jaguar Warrior', entity: 'jaguarWarrior' },
  { name: 'Sun Serpent', entity: 'serpent' },
  { name: 'Sun Stone Sentinel', entity: 'sentinel' },
  { name: 'CURSED IDOL', entity: 'boss' },
];

const ENEMY_ENTITY_SET = new Set(ENEMY_ITEMS.map((i) => i.entity));

const ITEM_ITEMS: { name: string; entity: string }[] = [
  { name: 'Spirit Bloom', entity: 'bloom' },
  { name: 'Ember Chili (Form)', entity: 'emberChili' },
  { name: 'Tree Frog Suit (Form)', entity: 'frogSuit' },
  { name: 'Kapok Anvil (Form)', entity: 'kapokAnvil' },
  { name: 'Macaw Wings (12s)', entity: 'macawWings' },
  { name: 'Jaguar Pelt (10s)', entity: 'jaguarPelt' },
  { name: 'Rainbow Orchid (8s)', entity: 'rainbowOrchid' },
  { name: 'Grasshopper Legs (14s)', entity: 'grasshopperLegs' },
  { name: 'Shrinkberry (15s)', entity: 'shrinkberry' },
  { name: 'Coin Capuchin (20s)', entity: 'coinCapuchin' },
  { name: 'Golden Banana', entity: 'goldenBanana' },
  { name: 'Thunder Mango', entity: 'thunderMango' },
  { name: 'Static Starfruit', entity: 'staticStarfruit' },
  { name: 'Coin', entity: 'coin' },
  { name: 'Checkpoint', entity: 'checkpoint' },
  { name: 'Jade Key', entity: 'keyJade' },
  { name: 'Gold Key', entity: 'keyGold' },
  { name: 'Obsidian Key', entity: 'keyObsidian' },
];

const SPECIAL_ITEMS: { name: string; entity: string }[] = [
  { name: 'Goal Totem', entity: 'goal' },
  { name: 'Jade Axe', entity: 'axe' },
  { name: 'Warp Jar', entity: 'warpJar' },
  { name: 'Player Start', entity: 'playerStart' },
];

/** Items that can be placed inside a ? Block as fixed loot. */
const QUESTION_LOOT_ITEMS: { name: string; entity: string }[] = [
  { name: '🎲 Random', entity: '' },
  { name: '💰 Coin', entity: 'coin' },
  { name: '🍄 Spirit Bloom', entity: 'bloom' },
  { name: '🔥 Ember Chili', entity: 'emberChili' },
  { name: '🐸 Tree Frog Suit', entity: 'frogSuit' },
  { name: '🪨 Kapok Anvil', entity: 'kapokAnvil' },
  { name: '🪶 Macaw Wings', entity: 'macawWings' },
  { name: '🐆 Jaguar Pelt', entity: 'jaguarPelt' },
  { name: '🌈 Rainbow Orchid', entity: 'rainbowOrchid' },
  { name: '🦗 Grasshopper Legs', entity: 'grasshopperLegs' },
  { name: '🫐 Shrinkberry', entity: 'shrinkberry' },
  { name: '🐒 Coin Capuchin', entity: 'coinCapuchin' },
  { name: '🍌 Golden Banana', entity: 'goldenBanana' },
  { name: '🥭 Thunder Mango', entity: 'thunderMango' },
  { name: '⭐ Static Starfruit', entity: 'staticStarfruit' },
  { name: '🔑 Jade Key', entity: 'keyJade' },
  { name: '🔑 Gold Key', entity: 'keyGold' },
  { name: '🔑 Obsidian Key', entity: 'keyObsidian' },
  { name: '🚩 Checkpoint', entity: 'checkpoint' },
];

const QUESTION_CONTENT_SET = new Set(QUESTION_LOOT_ITEMS.map((i) => i.entity).filter(Boolean));

export function EditorPanel() {
  const ctl = useRQ();
  const eng = ctl.engine!;
  const [cat, setCat] = useState<Cat>('tiles');
  const [selLabel, setSelLabel] = useState('Ground');
  const [msg, setMsg] = useState('');
  const [showSlots, setShowSlots] = useState(false);
  const hover = eng.editorHover;
  const level = eng.getLevel();

  const select = (label: string, sel: typeof eng.editorSel) => {
    eng.editorSel = sel;
    setSelLabel(label);
    ctl.bump();
  };

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 2500);
  };

  const doSave = () => {
    const lvl = eng.getLevel();
    if (!lvl) return;
    lvl.name = ctl.editorLevelName || lvl.name;
    saveCustomLevel(lvl);
    downloadJson(`${lvl.name.replace(/[^\w\- ]+/g, '').trim() || 'level'}.json`, lvl);
    flash('Saved to browser slot + downloaded .json');
  };

  const doLoadFile = () => {
    pickJsonFile<LevelData>((data) => {
      if (!validateLevel(data)) { flash('Not a valid level file'); return; }
      ctl.editorLevelName = data.name;
      ctl.openEditorWithLevel(data);
      flash(`Loaded "${data.name}"`);
    }, (m) => flash(m));
  };

  const items =
    cat === 'tiles' ? TILE_ITEMS.map((i) => ({ label: i.name, sel: { kind: 'tile', tile: i.tile } as const })) :
    cat === 'enemies' ? ENEMY_ITEMS.map((i) => ({ label: i.name, sel: { kind: 'entity', entity: i.entity } as const })) :
    cat === 'items' ? ITEM_ITEMS.map((i) => ({ label: i.name, sel: { kind: 'entity', entity: i.entity } as const })) :
    SPECIAL_ITEMS.map((i) => ({ label: i.name, sel: { kind: 'entity', entity: i.entity } as const }));

  return (
    <>
      {/* left palette */}
      <div className="absolute left-3 top-3 bottom-3 w-56 panel-jungle p-3 z-20 flex flex-col gap-2 overflow-hidden">
        <h3 className="font-retro text-amber-300 text-glow-gold text-center">Build Mode</h3>
        <div className="grid grid-cols-2 gap-1 text-xs">
          {(['tiles', 'enemies', 'items', 'special'] as Cat[]).map((k) => (
            <button
              key={k}
              className={`palette-item px-2 py-1 font-bold uppercase ${cat === k ? 'selected' : ''}`}
              onClick={() => setCat(k)}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto dnd-list flex flex-col gap-1 pr-1">
          {items.map((i) => (
            <button
              key={i.label}
              className={`palette-item px-2 py-1.5 text-left text-sm ${selLabel === i.label ? 'selected' : ''}`}
              onClick={() => select(i.label, i.sel)}
            >
              {i.label}
            </button>
          ))}
          <button
            className={`palette-item px-2 py-1.5 text-left text-sm ${selLabel === 'Eraser' ? 'selected' : ''}`}
            onClick={() => select('Eraser', { kind: 'erase' })}
          >
            ⌫ Eraser
          </button>
        </div>
        <div className="text-xs text-emerald-200/70 leading-relaxed border-t border-emerald-800 pt-2">
          <div>L-click: place · R-click: erase</div>
          <div>R-drag / WASD: pan</div>
          <div className="text-amber-200/90 font-mono">
            {hover ? `tile (${hover.x}, ${hover.y})` : 'tile (–, –)'}
          </div>
          <div className="truncate">sel: <span className="text-amber-300">{selLabel}</span></div>
        </div>
        {eng.editorSel.kind === 'tile' && eng.editorSel.tile === TILE.Question && (
          <div className="border-t border-emerald-800 pt-2">
            <label className="block text-xs text-fuchsia-300 font-bold mb-1">? Block loot</label>
            <select
              className="jungle-input text-xs w-full"
              value={eng.editorQuestionContent}
              onChange={(e) => { eng.editorQuestionContent = e.target.value; ctl.bump(); }}
            >
              {QUESTION_LOOT_ITEMS.map((i) => <option key={i.entity} value={i.entity}>{i.name}</option>)}
            </select>
            <p className="text-[10px] text-emerald-200/50 mt-1">Pick “Random” for normal surprise blocks, or choose a fixed item/key/coin.</p>
          </div>
        )}
        {eng.editorSel.kind === 'entity' && QUESTION_CONTENT_SET.has(eng.editorSel.entity) && (
          <div className="border-t border-emerald-800 pt-2 text-xs text-amber-200">
            <span className="font-bold">Tip:</span> Click a ? Block with this item selected to put it inside.
          </div>
        )}
        {eng.editorSel.kind === 'entity' && eng.editorSel.entity === 'warpJar' && (
          <div className="border-t border-emerald-800 pt-2">
            <label className="block text-xs text-fuchsia-300 font-bold mb-1">Warp Jar target</label>
            <select
              className="jungle-input text-xs w-full"
              value={eng.editorWarpTarget}
              onChange={(e) => { eng.editorWarpTarget = e.target.value; ctl.bump(); }}
            >
              <option value="">(Auto: next saga level)</option>
              <optgroup label="Saga levels">
                {BUILTIN_LEVELS.map((l) => <option key={l.name} value={l.name}>{l.name}</option>)}
              </optgroup>
              {listCustomLevels().length > 0 && (
                <optgroup label="My levels">
                  {listCustomLevels().map((l) => <option key={l.name} value={l.name}>{l.name}</option>)}
                </optgroup>
              )}
              {listWorlds().length > 0 && (
                <optgroup label="Worlds (fresh run)">
                  {listWorlds().map((w) => <option key={w.name} value={`world:${w.name}`}>{w.name}</option>)}
                </optgroup>
              )}
            </select>
            <p className="text-[10px] text-emerald-200/50 mt-1">Applies to the next jar you place. Stand on a jar + press ↓ in-game to warp. Level targets are round-trips (max 3 deep); World targets are one-way.</p>
          </div>
        )}
        {eng.editorSel.kind === 'entity' && eng.editorSel.entity === 'goal' && (
          <div className="border-t border-emerald-800 pt-2">
            <label className="block text-xs text-fuchsia-300 font-bold mb-1">Goal seal (needs key)</label>
            <select
              className="jungle-input text-xs w-full"
              value={eng.editorGoalLock}
              onChange={(e) => { eng.editorGoalLock = e.target.value as typeof eng.editorGoalLock; ctl.bump(); }}
            >
              <option value="">(No seal)</option>
              <option value="jade">Jade seal</option>
              <option value="gold">Gold seal</option>
              <option value="obsidian">Obsidian seal</option>
            </select>
            <p className="text-[10px] text-emerald-200/50 mt-1">Applies to the next goal you place. Players must carry the matching key; keys are not consumed.</p>
          </div>
        )}
        {eng.editorSel.kind === 'entity' && ENEMY_ENTITY_SET.has(eng.editorSel.entity) && (
          <div className="border-t border-emerald-800 pt-2">
            <label className="flex items-center gap-2 text-xs text-orange-300 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={eng.editorExtreme}
                onChange={(e) => { eng.editorExtreme = e.target.checked; ctl.bump(); }}
              />
              EXTREME variant
            </label>
            <p className="text-[10px] text-emerald-200/50 mt-1">Applies to the next enemy you place: bigger, faster, meaner, 3× score.</p>
          </div>
        )}
      </div>

      {/* top bar */}
      <div className="absolute top-3 left-60 right-3 z-20 flex items-center gap-2 flex-wrap">
        <input
          className="jungle-input text-sm w-48"
          value={ctl.editorLevelName}
          placeholder="Level name"
          onChange={(e) => { ctl.editorLevelName = e.target.value; if (level) level.name = e.target.value; ctl.bump(); }}
        />
        <button className="btn-jungle !py-1.5 !px-3 text-sm" onClick={doSave}>Save</button>
        <button className="btn-jungle !py-1.5 !px-3 text-sm" onClick={() => setShowSlots(!showSlots)}>Slots</button>
        <button className="btn-jungle !py-1.5 !px-3 text-sm" onClick={doLoadFile}>Load File</button>
        <button className="btn-jungle btn-gold !py-1.5 !px-3 text-sm" onClick={() => ctl.toggleEditor()}>▶ Test Play [B]</button>
        <button className="btn-jungle btn-danger-jungle !py-1.5 !px-3 text-sm" onClick={() => ctl.quitToTitle()}>Exit</button>
        {msg && <span className="hud-chip text-amber-200">{msg}</span>}
      </div>

      {/* slots dropdown */}
      {showSlots && (
        <div className="absolute top-16 left-60 z-30 panel-jungle p-3 w-72 max-h-80 overflow-y-auto dnd-list">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-retro text-emerald-300 text-sm">Saved Levels</h4>
            <button className="text-emerald-200/60 hover:text-white text-xs" onClick={() => setShowSlots(false)}>close</button>
          </div>
          {listCustomLevels().length === 0 && <p className="text-emerald-200/50 text-sm">No saved levels yet.</p>}
          {listCustomLevels().map((l) => (
            <button
              key={l.name}
              className="palette-item w-full text-left px-2 py-1.5 mb-1 text-sm"
              onClick={() => { ctl.editorLevelName = l.name; ctl.openEditorWithLevel(l); setShowSlots(false); }}
            >
              {l.name} <span className="text-emerald-200/50 text-xs">({l.theme}, {l.width}w)</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
