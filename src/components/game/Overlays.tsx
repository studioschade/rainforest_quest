import { useRQ } from './useRQ';
import { audio } from '@/game/audio';

// throttle the slider's audible feedback so dragging doesn't machine-gun blips
let lastVolBlip = 0;
function volTestBlip(): void {
  const now = performance.now();
  if (now - lastVolBlip < 150) return;
  lastVolBlip = now;
  audio.resume();
  audio.sfx('coin');
}

/** Blur after activation so Space/Enter can't re-fire the button mid-game. */
function blurOf(e: React.MouseEvent<HTMLButtonElement>): void {
  e.currentTarget.blur();
}

export function Overlays() {
  const ctl = useRQ();
  const ov = ctl.overlay;
  if (ov === 'none') return null;
  const s = ctl.session;
  const inEditor = !!ctl.engine?.editorMode;

  if (ov === 'transition') {
    return (
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#04140b]">
        <div className="font-retro text-emerald-300/70 text-sm mb-2">{ctl.worldName}</div>
        <div className="font-retro text-3xl text-amber-300 text-glow-gold mb-4">{ctl.transitionText}</div>
        <div className="hud-chip">Lives × {Math.max(0, s.lives)} · Score {s.score}</div>
        <div className="text-emerald-200/40 text-xs mt-6">Esc / Enter — skip</div>
      </div>
    );
  }

  if (ov === 'pause') {
    const volPct = Math.round(audio.volume * 100);
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60">
        <div className="panel-jungle panel-jungle-gold p-8 w-80 text-center">
          <h2 className="font-retro text-2xl text-amber-300 text-glow-gold mb-5">Paused</h2>
          <div className="flex flex-col gap-3">
            <button className="btn-jungle btn-gold" onClick={(e) => { blurOf(e); ctl.overlay = 'none'; ctl.bump(); }}>Resume</button>
            {!ctl.testPlay && <button className="btn-jungle" onClick={(e) => { blurOf(e); ctl.restartLevel(); }}>Restart Level</button>}
            <button className="btn-jungle" onClick={(e) => { blurOf(e); ctl.overlay = 'glitch'; ctl.bump(); }}>Glitches [G]</button>
            <div className="panel-jungle !p-2.5" title="Game volume (your system volume is unaffected)">
              <label className="flex items-center gap-2 text-sm text-emerald-100">
                <span className="whitespace-nowrap">
                  {audio.muted || volPct === 0 ? '🔇' : volPct <= 50 ? '🔉' : '🔊'} VOL
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={volPct}
                  className="jungle-range flex-1"
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    audio.setVolume(v / 100);
                    if (v > 0 && audio.muted) audio.setMuted(false); // raising volume wakes the sound
                    if (v > 0) volTestBlip();
                    ctl.bump();
                  }}
                  onPointerUp={(e) => e.currentTarget.blur()}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') e.currentTarget.blur();
                    e.stopPropagation(); // slider keys never reach the game
                  }}
                />
                <span className="w-10 text-right font-mono text-amber-300">{volPct}%</span>
              </label>
              {audio.muted && (
                <p className="text-[11px] text-amber-200/70 mt-1">Muted — press M to unmute, or raise the volume</p>
              )}
            </div>
            <button className="btn-jungle btn-danger-jungle" onClick={(e) => { blurOf(e); ctl.quitToTitle(); }}>Quit to Title</button>
          </div>
        </div>
      </div>
    );
  }

  if (ov === 'levelComplete') {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60">
        <div className="panel-jungle panel-jungle-gold p-8 w-96 text-center">
          <h2 className="font-retro text-2xl text-amber-300 text-glow-gold mb-1">Level Clear!</h2>
          <p className="text-emerald-200/70 text-sm mb-4">{s.levelName}</p>
          <div className="flex justify-center gap-2 mb-5 flex-wrap">
            <span className="hud-chip">Score {s.score}</span>
            <span className="hud-chip">Coins {s.coins}</span>
            <span className="hud-chip">Lives {Math.max(0, s.lives)}</span>
          </div>
          <div className="flex flex-col gap-3">
            <button className="btn-jungle btn-gold" onClick={(e) => { blurOf(e); ctl.nextLevel(); }}>Next Level ▶ [Enter]</button>
            <button className="btn-jungle" onClick={(e) => { blurOf(e); ctl.quitToTitle(); }}>Quit to Title [Esc]</button>
          </div>
        </div>
      </div>
    );
  }

  if (ov === 'worldComplete') {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70">
        <div className="panel-jungle panel-jungle-gold p-8 w-[30rem] text-center">
          <div className="text-5xl mb-2">🌺</div>
          <h2 className="font-retro text-3xl text-amber-300 text-glow-gold mb-1">World Complete!</h2>
          <p className="text-emerald-200/80 text-sm mb-1">The rainforest is safe… for now.</p>
          <p className="text-emerald-200/70 text-sm mb-4">{ctl.worldName}</p>
          <div className="flex justify-center gap-2 mb-5 flex-wrap">
            <span className="hud-chip">Final Score {s.score}</span>
            <span className="hud-chip">Coins {s.coins}</span>
            <span className="hud-chip">Lives {Math.max(0, s.lives)}</span>
          </div>
          <div className="flex flex-col gap-3">
            <button className="btn-jungle btn-gold" onClick={(e) => { blurOf(e); ctl.quitToTitle(); }}>Back to Title [Enter]</button>
          </div>
        </div>
      </div>
    );
  }

  if (ov === 'gameOver') {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70">
        <div className="panel-jungle p-8 w-96 text-center" style={{ borderColor: '#a8433a' }}>
          <h2 className="font-retro text-3xl mb-1" style={{ color: '#ff8a7a', textShadow: '0 0 12px rgba(255,80,60,0.5), 0 3px 0 #4a1512' }}>Game Over</h2>
          <p className="text-emerald-200/70 text-sm mb-4">The jungle claims another explorer.</p>
          <div className="flex justify-center gap-2 mb-5">
            <span className="hud-chip">Score {s.score}</span>
          </div>
          <div className="flex flex-col gap-3">
            {!inEditor && ctl.world && (
              <button className="btn-jungle btn-gold" onClick={(e) => { blurOf(e); ctl.startWorld(ctl.world!); }}>Retry World [Enter]</button>
            )}
            <button className="btn-jungle" onClick={(e) => { blurOf(e); ctl.quitToTitle(); }}>Quit to Title [Esc]</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
