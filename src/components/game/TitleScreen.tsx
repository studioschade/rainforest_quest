import { useRQ } from './useRQ';
import { BUILTIN_WORLD } from '@/game/builtinLevels';
import { audio } from '@/game/audio';
import { GlitchLogo } from './GlitchLogo';

export function TitleScreen() {
  const ctl = useRQ();
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-b from-[#04140b] via-[#072615] to-[#04140b] overflow-hidden">
      {/* sound toggle */}
      <button
        className="absolute top-4 right-4 btn-jungle !px-4 !py-3 text-2xl z-40 rounded-full"
        onClick={() => { audio.resume(); audio.toggleMute(); ctl.bump(); }}
        title="Toggle sound (M)"
      >
        {audio.muted ? '🔇' : '🔊'}
      </button>

      {/* decorative floating leaves */}
      {Array.from({ length: 14 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full rq-float pointer-events-none"
          style={{
            left: `${(i * 67) % 100}%`,
            top: `${(i * 37) % 100}%`,
            width: 10 + (i % 4) * 6,
            height: 6 + (i % 3) * 4,
            background: i % 3 === 0 ? '#3f9e5a' : i % 3 === 1 ? '#2a7d34' : '#c9a13b',
            opacity: 0.25 + (i % 3) * 0.1,
            animationDelay: `${i * 0.4}s`,
            transform: `rotate(${i * 40}deg)`,
          }}
        />
      ))}

      {/* animated glitch logo */}
      <div className="mb-6 mt-4">
        <GlitchLogo />
      </div>

      <div className="flex flex-col gap-4 w-72 sm:w-80 mt-2">
        <button className="btn-jungle btn-gold text-xl py-4 flex items-center justify-center gap-3" onClick={() => ctl.startWorld(BUILTIN_WORLD)}>
          <span>▶</span> Play Adventure
        </button>
        <button className="btn-jungle text-lg py-3 flex items-center justify-center gap-3" onClick={() => { ctl.screen = 'worlds'; ctl.bump(); }}>
          <span>🌍</span> Make Worlds
        </button>
        <button className="btn-jungle text-lg py-3 flex items-center justify-center gap-3" onClick={() => { ctl.screen = 'editorPick'; ctl.bump(); }}>
          <span>🛠️</span> Make Levels
        </button>
        <button className="btn-jungle text-lg py-3 flex items-center justify-center gap-3" onClick={() => { ctl.screen = 'howto'; ctl.bump(); }}>
          <span>❓</span> How to Play
        </button>
      </div>

      <div className="mt-8 text-emerald-200/60 text-sm text-center leading-relaxed max-w-md px-4">
        Arrows / WASD — move · Space / Z — jump · X — run/fire<br />
        G — glitches · B — build mode · Esc / P — pause · M — sound
      </div>
    </div>
  );
}
