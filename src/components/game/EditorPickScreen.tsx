import { useState } from 'react';
import { useRQ } from './useRQ';
import { BUILTIN_LEVELS } from '@/game/builtinLevels';
import { THEMES } from '@/game/types';
import type { Theme } from '@/game/types';
import { listCustomLevels, pickJsonFile, validateLevel } from '@/game/storage';
import type { LevelData } from '@/game/types';

export function EditorPickScreen() {
  const ctl = useRQ();
  const [name, setName] = useState('My Level');
  const [theme, setTheme] = useState<Theme>('overworld');
  const [width, setWidth] = useState(120);
  const [msg, setMsg] = useState('');
  const custom = listCustomLevels();

  const openFile = () => {
    pickJsonFile<LevelData>((data) => {
      if (!validateLevel(data)) { setMsg('Not a valid level file'); return; }
      ctl.openEditorWithLevel(data);
    }, setMsg);
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#04140b]/95 p-4">
      <div className="panel-jungle w-full max-w-3xl max-h-[90vh] overflow-y-auto dnd-list p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-retro text-2xl text-amber-300 text-glow-gold">Level Editor</h2>
          <button className="btn-jungle !px-3 !py-1 text-sm" onClick={() => { ctl.screen = 'title'; ctl.bump(); }}>Back</button>
        </div>
        <p className="text-emerald-200/70 text-sm mb-3">Edit an existing level, start a blank one, or press B during any game.</p>
        {msg && <div className="hud-chip text-rose-300 inline-block mb-2">{msg}</div>}
        <div className="leaf-divider mb-4" />

        <h3 className="font-retro text-emerald-300 text-sm mb-2">New Blank Level</h3>
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <input className="jungle-input text-sm w-44" value={name} onChange={(e) => setName(e.target.value)} placeholder="Level name" />
          <select className="jungle-select text-sm" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
            {THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <label className="text-emerald-100 text-sm flex items-center gap-2">
            Width
            <input
              className="jungle-input text-sm w-20"
              type="number" min={40} max={400} value={width}
              onChange={(e) => setWidth(parseInt(e.target.value || '120', 10))}
            />
          </label>
          <button className="btn-jungle btn-gold !py-1.5 !px-4 text-sm" onClick={() => ctl.openEditorWithLevel(ctl.createBlankLevel(name, theme, width))}>
            + Create & Edit
          </button>
          <button className="btn-jungle !py-1.5 !px-3 text-sm" onClick={openFile}>Open .json File</button>
        </div>

        <h3 className="font-retro text-emerald-300 text-sm mb-2">Built-in Levels</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-5">
          {BUILTIN_LEVELS.map((l) => (
            <button key={l.id} className="palette-item px-3 py-2 text-left" onClick={() => ctl.openEditorWithLevel(l)}>
              <span className="font-bold text-sm">{l.name}</span>
              <span className="block text-emerald-200/50 text-xs">{l.theme} · {l.width} tiles — edits stay in-session unless you Save</span>
            </button>
          ))}
        </div>

        {custom.length > 0 && (
          <>
            <h3 className="font-retro text-emerald-300 text-sm mb-2">Your Levels</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {custom.map((l) => (
                <button key={l.name} className="palette-item px-3 py-2 text-left" onClick={() => ctl.openEditorWithLevel(l)}>
                  <span className="font-bold text-sm">{l.name}</span>
                  <span className="block text-emerald-200/50 text-xs">{l.theme} · {l.width} tiles</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
