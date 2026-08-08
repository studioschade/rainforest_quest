import { useRQ } from './useRQ';
import { Engine } from '@/game/engine';

const iconCache = new Map<string, string>();

/** Data-URL icon for a powerup/form/effect kind, rendered from the procedural atlas. */
function useIcon(kind: string): string {
  const ctl = useRQ();
  const key = Engine.itemIcon(kind);
  let url = iconCache.get(key);
  if (!url && ctl.tex) {
    try {
      url = ctl.tex.get(key).toDataURL();
      iconCache.set(key, url);
    } catch { url = ''; }
  }
  return url ?? '';
}

function FxIcon({ kind, size = 18 }: { kind: string; size?: number }) {
  const url = useIcon(kind);
  if (!url) return null;
  return <img src={url} width={size} height={size} className="pixelated inline-block" alt={kind} draggable={false} />;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function Hud() {
  const ctl = useRQ();
  const s = ctl.session;
  const inEditor = !!ctl.engine?.editorMode;
  const fx = ctl.engine?.getFx() ?? { form: 'none', timers: [], static: null };
  const stats = ctl.engine?.getLevelStats();
  if (inEditor) return null;
  return (
    <div className="absolute top-3 left-0 right-0 pointer-events-none z-20 px-4">
      <div className="flex items-start justify-center gap-3 flex-wrap">
        <div className="hud-chip">Score <span className="text-amber-300">{String(s.score).padStart(6, '0')}</span></div>
        <div className="hud-chip">Coins <span className="text-amber-300">{String(s.coins).padStart(2, '0')}</span></div>
        <div className="hud-chip flex items-center gap-1.5">
          Lives <span className="text-rose-300">{Math.max(0, s.lives)}</span>
          {fx.form !== 'none' && (
            <span className="flex items-center gap-1 border-l border-emerald-700 pl-1.5">
              <FxIcon kind={fx.form} />
            </span>
          )}
        </div>
        {(s.keys?.length ?? 0) > 0 && (
          <div className="hud-chip flex items-center gap-1.5" title="Temple keys — they open matching sealed goals">
            Keys
            {s.keys!.map((k, i) => (
              <FxIcon key={`${k}-${i}`} kind={`key${k[0].toUpperCase()}${k.slice(1)}`} size={16} />
            ))}
          </div>
        )}
        <div className="hud-chip hidden md:block max-w-[280px] truncate">{s.levelName}</div>
        {fx.static && (
          <div className="hud-chip rq-blink flex items-center gap-1.5" style={{ borderColor: '#e05fd0', color: '#f7b8ee' }}
            title={fx.static.kind === 'surge' ? 'Glitch Surge: a random glitch is forced ON' : 'Physics Scramble: physics sliders are randomized'}>
            <FxIcon kind="staticStarfruit" size={16} />
            STATIC! <span className="font-mono">{fx.static.seconds}s</span>
          </div>
        )}
        {ctl.glitchActive && (
          <div className="hud-chip rq-blink" style={{ borderColor: '#e05fd0', color: '#f7b8ee' }}>
            GLITCH ACTIVE
          </div>
        )}
        {stats && stats.total > 0 && (
          <div className={`hud-chip flex items-center gap-1.5 ${stats.collected >= stats.total ? 'rq-blink' : ''}`} title="Aztec Relics — find all 3 for the map piece">
            <FxIcon kind="relic" size={16} />
            <span className={stats.collected >= stats.total ? 'text-amber-300' : 'text-emerald-100'}>
              {stats.collected}/{stats.total}
            </span>
          </div>
        )}
        {stats && stats.parTime !== undefined && (
          <div className={`hud-chip font-mono ${stats.time > stats.parTime ? 'text-rose-300' : 'text-emerald-100'}`} title="Par time">
            ⏱ {fmtTime(stats.time)} / {fmtTime(stats.parTime)}
          </div>
        )}
      </div>
      {fx.timers.length > 0 && (
        <div className="flex justify-center gap-2 mt-2 flex-wrap">
          {fx.timers.map((t) => (
            <div key={t.key} className="hud-chip flex items-center gap-2 !py-1" title={t.label}>
              <FxIcon kind={t.key} size={16} />
              <span className="text-xs text-emerald-100 w-5 text-right font-mono">{t.seconds}s</span>
              <span className="block w-14 h-2 rounded bg-emerald-950 overflow-hidden border border-emerald-800">
                <span
                  className="block h-full rounded"
                  style={{
                    width: `${Math.round(t.frac * 100)}%`,
                    background: t.frac > 0.3 ? 'linear-gradient(90deg,#3f9e5a,#6fd66f)' : 'linear-gradient(90deg,#c2591f,#ffb02e)',
                  }}
                />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
