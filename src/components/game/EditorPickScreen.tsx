import { useState } from 'react';
import { useRQ } from './useRQ';
import { BUILTIN_LEVELS } from '@/game/builtinLevels';
import { THEMES } from '@/game/types';
import type { Theme, LevelData } from '@/game/types';
import { listCustomLevels, pickJsonFile, validateLevel, deleteCustomLevel } from '@/game/storage';

export function EditorPickScreen() {
  const ctl = useRQ();
  const [name, setName] = useState('My Level');
  const [theme, setTheme] = useState<Theme>('overworld');
  const [width, setWidth] = useState(120);
  const [msg, setMsg] = useState('');
  const [copyFrom, setCopyFrom] = useState<LevelData | null>(null);
  const [copyName, setCopyName] = useState('');
  const custom = listCustomLevels();

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const openFile = () => {
    pickJsonFile<LevelData>((data) => {
      if (!validateLevel(data)) { flash('That file is not a valid level'); return; }
      ctl.openEditorWithLevel(data);
    }, flash);
  };

  const startCopy = (level: LevelData) => {
    setCopyFrom(level);
    setCopyName(`${level.name} Copy`);
  };

  const confirmCopy = () => {
    if (!copyFrom) return;
    const newName = copyName.trim();
    if (!newName) { flash('Type a name for the copy'); return; }
    const copy: LevelData = JSON.parse(JSON.stringify(copyFrom));
    copy.name = newName;
    copy.id = 'lvl_' + Math.random().toString(36).slice(2, 10);
    copy.builtin = false;
    ctl.openEditorWithLevel(copy);
    setCopyFrom(null);
  };

  const doDelete = (name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    deleteCustomLevel(name);
    flash(`Deleted "${name}"`);
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#04140b]/95 p-4">
      <div className="panel-jungle w-full max-w-4xl max-h-[92vh] overflow-y-auto dnd-list p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-retro text-2xl text-amber-300 text-glow-gold">🛠️ Make Levels</h2>
          <button className="btn-jungle !px-4 !py-2 text-sm" onClick={() => { ctl.screen = 'title'; ctl.bump(); }}>← Back</button>
        </div>
        <p className="text-emerald-200/70 text-sm mb-4">Build your own levels, copy the built-in ones to remix them, or load a saved level.</p>
        {msg && <div className="hud-chip text-amber-200 inline-block mb-3">{msg}</div>}
        <div className="leaf-divider mb-5" />

        {/* New blank level */}
        <div className="panel-jungle-gold p-4 mb-6">
          <h3 className="font-retro text-emerald-100 text-sm mb-3">✨ Start a Blank Level</h3>
          <div className="flex flex-wrap items-center gap-3">
            <input className="jungle-input text-sm w-48" value={name} onChange={(e) => setName(e.target.value)} placeholder="Level name" />
            <select className="jungle-select text-sm" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
              {THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <label className="text-emerald-100 text-sm flex items-center gap-2">
              Width
              <input className="jungle-input text-sm w-20" type="number" min={40} max={400} value={width} onChange={(e) => setWidth(parseInt(e.target.value || '120', 10))} />
            </label>
            <button className="btn-jungle btn-gold !py-2 !px-5 text-sm" onClick={() => ctl.openEditorWithLevel(ctl.createBlankLevel(name, theme, width))}>
              + Create
            </button>
            <button className="btn-jungle !py-2 !px-4 text-sm" onClick={openFile}>📁 Open File</button>
          </div>
        </div>

        {/* Built-in levels */}
        <h3 className="font-retro text-emerald-300 text-sm mb-3">🏛️ Built-in Levels (copy only)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {BUILTIN_LEVELS.map((l) => (
            <div key={l.id} className="palette-item p-3 flex flex-col gap-2">
              <div>
                <span className="font-bold text-emerald-100 text-sm block">{l.name}</span>
                <span className="text-emerald-200/50 text-xs">{l.theme} · {l.width} tiles</span>
              </div>
              <button className="btn-jungle btn-gold !py-1.5 !px-3 text-xs self-start" onClick={() => startCopy(l)}>
                📋 Copy
              </button>
            </div>
          ))}
        </div>

        {/* Custom levels */}
        <h3 className="font-retro text-emerald-300 text-sm mb-3">🎨 Your Levels</h3>
        {custom.length === 0 && (
          <p className="text-emerald-200/50 text-sm mb-4">You have not made any levels yet. Copy a built-in level or create a blank one!</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {custom.map((l) => (
            <div key={l.id || l.name} className="palette-item p-3 flex flex-col gap-2">
              <div>
                <span className="font-bold text-emerald-100 text-sm block">{l.name}</span>
                <span className="text-emerald-200/50 text-xs">{l.theme} · {l.width} tiles</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-jungle !py-1.5 !px-3 text-xs" onClick={() => ctl.openEditorWithLevel(l)}>✏️ Edit</button>
                <button className="btn-jungle !py-1.5 !px-3 text-xs" onClick={() => startCopy(l)}>📋 Copy</button>
                <button className="btn-jungle btn-danger-jungle !py-1.5 !px-3 text-xs" onClick={() => doDelete(l.name)}>🗑️ Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Copy name modal */}
      {copyFrom && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="panel-jungle-gold p-6 w-full max-w-sm">
            <h3 className="font-retro text-amber-300 text-lg mb-2">Copy Level</h3>
            <p className="text-emerald-200/80 text-sm mb-3">What do you want to name your copy of <strong>{copyFrom.name}</strong>?</p>
            <input className="jungle-input text-sm w-full mb-4" value={copyName} onChange={(e) => setCopyName(e.target.value)} placeholder="New level name" />
            <div className="flex gap-2 justify-end">
              <button className="btn-jungle !py-2 !px-4 text-sm" onClick={() => setCopyFrom(null)}>Cancel</button>
              <button className="btn-jungle btn-gold !py-2 !px-4 text-sm" onClick={confirmCopy}>Copy & Edit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
