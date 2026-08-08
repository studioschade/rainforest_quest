import { useRQ } from './useRQ';
import { BUILTIN_WORLD } from '@/game/builtinLevels';
import { audio } from '@/game/audio';

export function TitleScreen() {
  const ctl = useRQ();
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-b from-[#04140b] via-[#072615] to-[#04140b] overflow-hidden">
      {/* sound toggle */}
      <button
        className="absolute top-4 right-4 btn-jungle !px-3 !py-2 text-base z-40"
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

      {/* logo */}
      <div className="text-center mb-2 select-none">
        <div
          className="font-retro leading-none"
          style={{
            fontSize: 'clamp(38px, 7vw, 84px)',
            background: 'linear-gradient(180deg, #d8f7b0 15%, #6fd66f 45%, #2a8a3d 75%, #ffd977 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            filter: 'drop-shadow(0 4px 0 rgba(6,40,16,0.9)) drop-shadow(0 8px 18px rgba(0,0,0,0.6))',
          }}
        >
          RAINFOREST
        </div>
        <div
          className="font-retro leading-none mt-1"
          style={{
            fontSize: 'clamp(30px, 5.4vw, 64px)',
            color: '#ffd977',
            textShadow: '0 0 18px rgba(255,214,100,0.5), 0 4px 0 #6b4a0e, 0 8px 18px rgba(0,0,0,0.6)',
          }}
        >
          ★ QUEST ★
        </div>
        <div className="leaf-divider w-72 mx-auto mt-4" />
      </div>

      <div className="flex flex-col gap-3 w-64 mt-6">
        <button className="btn-jungle btn-gold text-lg" onClick={() => ctl.startWorld(BUILTIN_WORLD)}>
          ▶ Play
        </button>
        <button className="btn-jungle" onClick={() => { ctl.screen = 'worlds'; ctl.bump(); }}>
          Worlds
        </button>
        <button className="btn-jungle" onClick={() => { ctl.screen = 'editorPick'; ctl.bump(); }}>
          Level Editor
        </button>
        <button className="btn-jungle" onClick={() => { ctl.screen = 'howto'; ctl.bump(); }}>
          How to Play
        </button>
      </div>

      <div className="mt-8 text-emerald-200/60 text-xs text-center leading-relaxed">
        Arrows / WASD — move · Space / Z — jump · X — run<br />
        G — glitches · B — build mode · Esc / P — pause · M — sound
      </div>
    </div>
  );
}
