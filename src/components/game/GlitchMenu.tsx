import { useRQ } from './useRQ';
import { PHYSICS_SLIDERS, GLITCH_META, DEFAULT_PHYSICS } from '@/game/config';

/** Blur after activation so Space/Enter can't re-fire the control mid-game. */
function blurOf(e: React.MouseEvent<HTMLElement>): void {
  e.currentTarget.blur();
}

/** Sliders: swallow keys (arrows adjust natively, Escape returns focus to the game). */
function sliderKeys(e: React.KeyboardEvent<HTMLInputElement>): void {
  if (e.key === 'Escape') e.currentTarget.blur();
  e.stopPropagation();
}

export function GlitchMenu() {
  const ctl = useRQ();
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
      <div className="panel-jungle panel-jungle-gold w-full max-w-3xl max-h-[88vh] overflow-y-auto dnd-list p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-retro text-2xl text-amber-300 text-glow-gold">Glitch Caverns</h2>
          <button className="btn-jungle btn-danger-jungle !px-3 !py-1 text-sm" onClick={(e) => { blurOf(e); ctl.overlay = 'none'; ctl.bump(); }}>
            Close [G]
          </button>
        </div>
        <p className="text-emerald-200/70 text-sm mb-4">Twist the laws of the rainforest. Changes apply live.</p>
        <div className="leaf-divider mb-4" />

        <h3 className="font-retro text-emerald-300 text-glow-green mb-3">Physics Sliders</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 mb-6">
          {PHYSICS_SLIDERS.map((s) => (
            <div key={s.key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-emerald-100 font-bold">{s.label}</span>
                <span className="text-amber-300 font-mono">{ctl.physics[s.key].toFixed(2)}</span>
              </div>
              <input
                type="range"
                className="jungle-range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={ctl.physics[s.key]}
                onChange={(e) => ctl.setPhysics(s.key, parseFloat(e.target.value))}
                onDoubleClick={(e) => { ctl.setPhysics(s.key, DEFAULT_PHYSICS[s.key]); blurOf(e); }}
                onPointerUp={(e) => e.currentTarget.blur()}
                onKeyDown={sliderKeys}
              />
            </div>
          ))}
        </div>

        <h3 className="font-retro text-emerald-300 text-glow-green mb-3">Glitch Toggles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6">
          {GLITCH_META.map((g) => (
            <button
              key={g.key}
              className="flex items-center gap-3 text-left palette-item px-3 py-2"
              onClick={(e) => { blurOf(e); ctl.setGlitch(g.key, !ctl.glitches[g.key]); }}
            >
              <span className={`glitch-toggle ${ctl.glitches[g.key] ? 'on' : ''}`} />
              <span>
                <span className="block font-bold text-sm">{g.label}</span>
                <span className="block text-xs text-emerald-200/60 normal-case">{g.desc}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="flex justify-between items-center">
          <button className="btn-jungle btn-gold" onClick={(e) => { blurOf(e); ctl.resetGlitches(); }}>
            Reset All to Defaults
          </button>
          <span className="text-emerald-200/50 text-xs">Settings persist between sessions</span>
        </div>
      </div>
    </div>
  );
}
