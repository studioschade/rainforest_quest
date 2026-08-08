// localStorage persistence for custom levels and worlds + import/export helpers.
import type { LevelData, WorldData } from './types';

const LEVELS_KEY = 'rq_custom_levels_v1';
const WORLDS_KEY = 'rq_custom_worlds_v1';

function readMap<T>(key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as Record<string, T>;
  } catch { /* ignore */ }
  return {};
}

function writeMap<T>(key: string, m: Record<string, T>): void {
  try { localStorage.setItem(key, JSON.stringify(m)); } catch { /* ignore */ }
}

export function listCustomLevels(): LevelData[] {
  return Object.values(readMap<LevelData>(LEVELS_KEY));
}

export function saveCustomLevel(level: LevelData): void {
  const m = readMap<LevelData>(LEVELS_KEY);
  m[level.name] = level;
  writeMap(LEVELS_KEY, m);
}

export function deleteCustomLevel(name: string): void {
  const m = readMap<LevelData>(LEVELS_KEY);
  delete m[name];
  writeMap(LEVELS_KEY, m);
}

export function listWorlds(): WorldData[] {
  return Object.values(readMap<WorldData>(WORLDS_KEY));
}

export function saveWorld(world: WorldData): void {
  const m = readMap<WorldData>(WORLDS_KEY);
  m[world.name] = world;
  writeMap(WORLDS_KEY, m);
}

export function deleteWorld(name: string): void {
  const m = readMap<WorldData>(WORLDS_KEY);
  delete m[name];
  writeMap(WORLDS_KEY, m);
}

// ---------- file import/export ----------

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function pickJsonFile<T>(onLoad: (data: T) => void, onError?: (msg: string) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onLoad(JSON.parse(String(reader.result)) as T);
      } catch {
        onError?.('That file is not valid JSON.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

export function validateLevel(d: unknown): d is LevelData {
  const l = d as LevelData;
  return !!l && typeof l.name === 'string' && typeof l.width === 'number' &&
    typeof l.height === 'number' && Array.isArray(l.tiles) && Array.isArray(l.entities) &&
    typeof l.theme === 'string';
}

export function validateWorld(d: unknown): d is WorldData {
  const w = d as WorldData;
  return !!w && typeof w.name === 'string' && Array.isArray(w.levels) && w.levels.every(validateLevel);
}

/** Deep clone so engine/editor never mutate shared data. */
export function cloneLevel(l: LevelData): LevelData {
  return JSON.parse(JSON.stringify(l)) as LevelData;
}
