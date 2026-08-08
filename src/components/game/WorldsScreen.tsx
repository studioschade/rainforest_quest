import { useRef, useState } from 'react';
import { useRQ } from './useRQ';
import { BUILTIN_LEVELS } from '@/game/builtinLevels';
import type { LevelData, WorldData } from '@/game/types';
import { listCustomLevels, listWorlds, saveWorld, deleteWorld, downloadJson, pickJsonFile, validateWorld } from '@/game/storage';

interface DragRef { src: 'avail' | 'seq'; index: number }

export function WorldsScreen() {
  const ctl = useRQ();
  const [seq, setSeq] = useState<LevelData[]>([]);
  const [worldName, setWorldName] = useState('My World');
  const [msg, setMsg] = useState('');
  const [overZone, setOverZone] = useState(false);
  const drag = useRef<DragRef | null>(null);
  const [, force] = useState(0);

  const available = [...BUILTIN_LEVELS, ...listCustomLevels()];
  const savedWorlds = listWorlds();

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const onDropToSeq = (e: React.DragEvent, insertAt?: number) => {
    e.preventDefault();
    setOverZone(false);
    const d = drag.current;
    if (!d) return;
    setSeq((prev) => {
      const next = [...prev];
      let item: LevelData | undefined;
      if (d.src === 'avail') item = available[d.index];
      else item = next.splice(d.index, 1)[0];
      if (!item) return prev;
      const at = insertAt === undefined ? next.length : Math.min(insertAt, next.length);
      next.splice(at, 0, item);
      return next;
    });
    drag.current = null;
  };

  const removeAt = (i: number) => setSeq((prev) => prev.filter((_, k) => k !== i));

  const doSave = () => {
    if (seq.length === 0) { flash('Add at least one level first'); return; }
    const w: WorldData = { name: worldName.trim() || 'My World', levels: seq };
    saveWorld(w);
    force((v) => v + 1);
    flash(`World "${w.name}" saved to browser`);
  };

  const doExport = () => {
    if (seq.length === 0) { flash('Add at least one level first'); return; }
    downloadJson(`${(worldName.trim() || 'world').replace(/[^\w\- ]+/g, '')}.world.json`, { name: worldName, levels: seq });
    flash('World exported as self-contained .json');
  };

  const doImport = () => {
    pickJsonFile<WorldData>((data) => {
      if (!validateWorld(data)) { flash('Not a valid world file'); return; }
      setWorldName(data.name);
      setSeq(data.levels);
      flash(`Imported "${data.name}" (${data.levels.length} levels)`);
    }, (m) => flash(m));
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#04140b]/95 p-4">
      <div className="panel-jungle w-full max-w-4xl max-h-[90vh] overflow-y-auto dnd-list p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-retro text-2xl text-amber-300 text-glow-gold">World Sequencer</h2>
          <button className="btn-jungle !px-3 !py-1 text-sm" onClick={() => { ctl.screen = 'title'; ctl.bump(); }}>Back</button>
        </div>
        <p className="text-emerald-200/70 text-sm mb-3">Drag levels into your world sequence. Click a sequenced level to remove it.</p>
        {msg && <div className="hud-chip text-amber-200 inline-block mb-2">{msg}</div>}
        <div className="leaf-divider mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* available */}
          <div>
            <h3 className="font-retro text-emerald-300 text-sm mb-2">Available Levels</h3>
            <div className="dnd-list max-h-72 overflow-y-auto pr-1">
              {available.map((l, i) => (
                <div
                  key={l.id + l.name}
                  className="dnd-item px-3 py-2 mb-1.5"
                  draggable
                  onDragStart={() => { drag.current = { src: 'avail', index: i }; }}
                  onDoubleClick={() => setSeq((p) => [...p, l])}
                  title="Drag to sequence, or double-click to add"
                >
                  <span className="text-emerald-100 font-bold text-sm">{l.name}</span>
                  <span className="block text-emerald-200/50 text-xs">{l.theme} · {l.width} tiles{l.builtin ? ' · built-in' : ''}</span>
                </div>
              ))}
            </div>
          </div>

          {/* sequence */}
          <div>
            <h3 className="font-retro text-emerald-300 text-sm mb-2">World Sequence ({seq.length})</h3>
            <div
              className={`dnd-dropzone min-h-72 max-h-72 overflow-y-auto dnd-list rounded-lg border-2 border-dashed border-emerald-800 p-2 ${overZone ? 'dragover' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setOverZone(true); }}
              onDragLeave={() => setOverZone(false)}
              onDrop={(e) => onDropToSeq(e)}
            >
              {seq.length === 0 && <p className="text-emerald-200/40 text-sm text-center mt-8">Drop levels here</p>}
              {seq.map((l, i) => (
                <div
                  key={l.id + i}
                  className="dnd-item px-3 py-2 mb-1.5 flex items-center gap-2"
                  draggable
                  onDragStart={() => { drag.current = { src: 'seq', index: i }; }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.stopPropagation(); onDropToSeq(e, i); }}
                  onClick={() => removeAt(i)}
                  title="Click to remove · drag to reorder"
                >
                  <span className="text-amber-300 font-mono text-xs w-6">{i + 1}.</span>
                  <span className="text-emerald-100 font-bold text-sm flex-1 truncate">{l.name}</span>
                  <span className="text-emerald-200/40 text-xs">✕</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input className="jungle-input text-sm w-52" value={worldName} onChange={(e) => setWorldName(e.target.value)} placeholder="World name" />
          <button className="btn-jungle !py-1.5 !px-3 text-sm" onClick={doSave}>Save World</button>
          <button className="btn-jungle !py-1.5 !px-3 text-sm" onClick={doExport}>Export .json</button>
          <button className="btn-jungle !py-1.5 !px-3 text-sm" onClick={doImport}>Import .json</button>
          <button className="btn-jungle btn-gold !py-1.5 !px-4 text-sm" disabled={seq.length === 0} onClick={() => ctl.startWorld({ name: worldName.trim() || 'My World', levels: seq })}>
            ▶ Play World
          </button>
        </div>

        {savedWorlds.length > 0 && (
          <>
            <h3 className="font-retro text-emerald-300 text-sm mb-2">Saved Worlds</h3>
            <div className="flex flex-wrap gap-2">
              {savedWorlds.map((w) => (
                <div key={w.name} className="palette-item px-3 py-1.5 flex items-center gap-2 text-sm">
                  <button className="font-bold hover:text-amber-300" onClick={() => { setWorldName(w.name); setSeq(w.levels); }}>
                    {w.name} ({w.levels.length})
                  </button>
                  <button className="btn-jungle btn-gold !px-2 !py-0.5 text-xs" onClick={() => ctl.startWorld(w)}>▶</button>
                  <button className="text-rose-300 hover:text-rose-200 text-xs" onClick={() => { deleteWorld(w.name); force((v) => v + 1); }}>✕</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
