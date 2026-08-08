export function GlitchLogo() {
  return (
    <div className="relative select-none mx-auto" style={{ width: 'clamp(300px, 80vw, 520px)' }}>
      <svg viewBox="0 0 400 150" className="w-full drop-shadow-2xl">
        {/* temple silhouette */}
        <path
          d="M60 130 L110 130 L110 95 L140 95 L140 70 L170 70 L170 50 L200 35 L230 50 L230 70 L260 70 L260 95 L290 95 L290 130 L340 130 L340 140 L60 140 Z"
          fill="#143620"
          stroke="#2f7a48"
          strokeWidth="2"
        />
        <path d="M185 50 L185 70 L215 70 L215 50 L200 42 Z" fill="#0d2818" />
        {/* temple door glow */}
        <path d="M190 95 L190 130 L210 130 L210 95 L200 85 Z" fill="#c9a13b" opacity="0.35" />

        {/* SUPER */}
        <text x="200" y="28" textAnchor="middle" className="font-retro fill-[#d8f7b0]" style={{ fontSize: 22, letterSpacing: 6 }}>
          SUPER
        </text>

        {/* GLITCH — duplicated for chromatic aberration */}
        <g className="glitch-text">
          <text x="202" y="78" textAnchor="middle" className="font-retro fill-[#ff5a8a]" style={{ fontSize: 52, letterSpacing: 2 }}>
            GLITCH
          </text>
          <text x="198" y="78" textAnchor="middle" className="font-retro fill-[#5af7ff]" style={{ fontSize: 52, letterSpacing: 2 }}>
            GLITCH
          </text>
          <text x="200" y="78" textAnchor="middle" className="font-retro fill-[#ffd977]" style={{ fontSize: 52, letterSpacing: 2 }}>
            GLITCH
          </text>
        </g>

        {/* WORLD */}
        <text x="200" y="112" textAnchor="middle" className="font-retro fill-[#6fd66f]" style={{ fontSize: 26, letterSpacing: 4 }}>
          WORLD
        </text>
      </svg>
    </div>
  );
}
