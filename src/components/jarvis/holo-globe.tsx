

/* ─── Color palette (JARVIS cyan) ─── */
const CYAN = "oklch(0.85 0.19 193)";
const CYAN_DIM = "oklch(0.85 0.19 193 / 25%)";
const CYAN_MED = "oklch(0.85 0.19 193 / 45%)";
const CYAN_GLOW = "oklch(0.85 0.19 193 / 50%)";

/* ─── Static geometry (module-level, no per-render cost) ─── */

/** Latitude angles (degrees from equator) — every 15° */
const LAT_DEGS = [-75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75] as const;

/** Longitude angles (degrees) — every 30° */
const LON_DEGS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as const;

/** World-city nodes [lat, lon] for connection points */
const NODES: readonly [number, number][] = [
  [40.7, -74],    // New York
  [51.5, -0.1],   // London
  [35.7, 139.7],  // Tokyo
  [-33.9, 151.2], // Sydney
  [55.8, 37.6],   // Moscow
  [28.6, 77.2],   // New Delhi
  [-23.5, -46.6], // São Paulo
  [1.3, 103.8],   // Singapore
] as const;

/** Arc pairs (indices into NODES) */
const LINKS: readonly [number, number][] = [
  [0, 1], // NY → London
  [1, 4], // London → Moscow
  [2, 7], // Tokyo → Singapore
  [7, 5], // Singapore → New Delhi
  [0, 6], // NY → São Paulo
  [3, 7], // Sydney → Singapore
  [1, 5], // London → New Delhi
  [4, 2], // Moscow → Tokyo
] as const;

/** Pre-computed outer-ring tick directions (36 ticks every 10°) */
const RING_TICKS = Array.from({ length: 36 }, (_, i) => {
  const a = (i * 10) * Math.PI / 180 - Math.PI / 2;
  const major = i % 9 === 0;
  return { cos: Math.cos(a), sin: Math.sin(a), major };
});

/* ─── Helpers ─── */

/** Convert lat/lon (degrees) to 3-D Cartesian [x, y, z] on a sphere of radius r.
 *  CSS convention: +X right, +Y down, +Z toward viewer. */
function sph2xyz(lat: number, lon: number, r: number): [number, number, number] {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return [
    r * Math.cos(la) * Math.sin(lo),
    -r * Math.sin(la), // CSS Y inverted
    r * Math.cos(la) * Math.cos(lo),
  ];
}

/* ─── Component ─── */
export function HoloGlobe({ size = 280 }: { size?: number }) {
  const R = size / 2;

  /* Connection-point 3-D positions (depend on R, so computed per render) */
  const pts = NODES.map(([lat, lon]) => sph2xyz(lat, lon, R));

  return (
    <div className="relative flex flex-col items-center" style={{ width: size }}>
      {/* ── Inline keyframes (self-contained, no globals.css dependency) ── */}
      <style>{`
        @keyframes hg-rotate {
          from { transform: rotateY(0deg); }
          to   { transform: rotateY(360deg); }
        }
        @keyframes hg-sweep {
          0%   { left: -40%; opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { left: 140%; opacity: 0; }
        }
        @keyframes hg-ring-pulse {
          0%, 100% { opacity: 0.12; }
          50%      { opacity: 0.22; }
        }
      `}</style>

      {/* ── Perspective wrapper ── */}
      <div
        className="relative"
        style={{ width: size, height: size, perspective: `${size * 1.5}px` }}
      >
        {/* ── Ambient glow halo (behind everything) ── */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: size * 1.25,
            height: size * 1.25,
            top: `calc(50% - ${size * 0.625}px)`,
            left: `calc(50% - ${size * 0.625}px)`,
            background: `radial-gradient(circle, ${CYAN_GLOW} 0%, ${CYAN_MED} 28%, ${CYAN_DIM} 52%, transparent 74%)`,
            animation: "jarvis-pulse-glow 4s ease-in-out infinite",
          }}
        />

        {/* ── Tilt wrapper (cinematic 20° forward tilt) ── */}
        <div
          className="absolute inset-0"
          style={{ transformStyle: "preserve-3d", transform: "rotateX(-20deg)" }}
        >
          {/* ── Rotating container (Y-axis spin) ── */}
          <div
            className="absolute inset-0"
            style={{
              transformStyle: "preserve-3d",
              animation: "hg-rotate 30s linear infinite",
            }}
          >
            {/* ═══════ Latitude lines (horizontal circles) ═══════ */}
            {LAT_DEGS.map((lat) => {
              const rad = (lat * Math.PI) / 180;
              const r = R * Math.cos(rad);
              const h = R * Math.sin(rad);
              const isEq = lat === 0;
              const isMajor = lat % 30 === 0;
              const op = isEq ? 0.5 : isMajor ? 0.22 : 0.13;
              const sw = isEq ? 1.2 : 0.5;
              return (
                <div
                  key={`la${lat}`}
                  className="absolute"
                  style={{
                    width: r * 2,
                    height: r * 2,
                    top: `calc(50% - ${r}px)`,
                    left: `calc(50% - ${r}px)`,
                    transform: `rotateX(90deg) translateZ(${h}px)`,
                    transformStyle: "preserve-3d",
                  }}
                >
                  <svg
                    viewBox={`0 0 ${r * 2} ${r * 2}`}
                    width={r * 2}
                    height={r * 2}
                    style={{ filter: `drop-shadow(0 0 2px ${CYAN_GLOW})` }}
                  >
                    <circle
                      cx={r}
                      cy={r}
                      r={r}
                      fill="none"
                      stroke={CYAN}
                      strokeOpacity={op}
                      strokeWidth={sw}
                    />
                  </svg>
                </div>
              );
            })}

            {/* ═══════ Longitude lines (vertical great circles) ═══════ */}
            {LON_DEGS.map((lon) => {
              const isCardinal = lon % 90 === 0;
              const isMajor = lon % 30 === 0;
              return (
                <div
                  key={`lo${lon}`}
                  className="absolute inset-0"
                  style={{
                    transform: `rotateY(${lon}deg)`,
                    transformStyle: "preserve-3d",
                  }}
                >
                  <svg
                    viewBox={`0 0 ${size} ${size}`}
                    width={size}
                    height={size}
                    style={{ filter: `drop-shadow(0 0 2px ${CYAN_GLOW})` }}
                  >
                    <circle
                      cx={R}
                      cy={R}
                      r={R}
                      fill="none"
                      stroke={CYAN}
                      strokeOpacity={isCardinal ? 0.38 : isMajor ? 0.18 : 0.1}
                      strokeWidth={isCardinal ? 1.2 : 0.5}
                    />
                  </svg>
                </div>
              );
            })}

            {/* ═══════ Front-face: connection arcs + glowing dots ═══════ */}
            <svg
              viewBox={`0 0 ${size} ${size}`}
              width={size}
              height={size}
              className="absolute inset-0"
              style={{ backfaceVisibility: "hidden" }}
            >
              <defs>
                <filter id="hg-dot-glow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="hg-arc-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Connection arcs (dashed, animated flow) */}
              <g filter="url(#hg-arc-glow)">
                {LINKS.map(([a, b], i) => {
                  const [x1, y1] = pts[a];
                  const [x2, y2] = pts[b];
                  const mx = (x1 + x2) / 2;
                  const my = (y1 + y2) / 2;
                  const dx = x2 - x1;
                  const dy = y2 - y1;
                  const len = Math.sqrt(dx * dx + dy * dy);
                  const nx = len > 0.01 ? -dy / len : 0;
                  const ny = len > 0.01 ? dx / len : 0;
                  const elev = len * 0.28;
                  return (
                    <path
                      key={`arc${i}`}
                      d={`M${R + x1} ${R + y1} Q${R + mx + nx * elev} ${R + my + ny * elev} ${R + x2} ${R + y2}`}
                      fill="none"
                      stroke={CYAN}
                      strokeOpacity="0.55"
                      strokeWidth="0.8"
                      strokeDasharray="4 3"
                      strokeLinecap="round"
                    >
                      <animate
                        attributeName="stroke-dashoffset"
                        from="0"
                        to="-14"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </path>
                  );
                })}
              </g>

              {/* Glowing connection dots */}
              <g filter="url(#hg-dot-glow)">
                {pts.map(([x, y], i) => (
                  <circle
                    key={`dot${i}`}
                    cx={R + x}
                    cy={R + y}
                    r={2.5}
                    fill={CYAN}
                  >
                    <animate
                      attributeName="r"
                      values="2;3.5;2"
                      dur="2.5s"
                      repeatCount="indefinite"
                      begin={`${i * 0.35}s`}
                    />
                    <animate
                      attributeName="opacity"
                      values="0.7;1;0.7"
                      dur="2.5s"
                      repeatCount="indefinite"
                      begin={`${i * 0.35}s`}
                    />
                  </circle>
                ))}
              </g>
            </svg>

            {/* ═══════ Back-face dots (dimmer, mirrored 180°) ═══════ */}
            <svg
              viewBox={`0 0 ${size} ${size}`}
              width={size}
              height={size}
              className="absolute inset-0"
              style={{
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
              }}
            >
              {pts.map(([x, y], i) => (
                <circle
                  key={`bdot${i}`}
                  cx={R + x}
                  cy={R + y}
                  r={1.5}
                  fill={CYAN}
                  fillOpacity="0.15"
                />
              ))}
            </svg>
          </div>
        </div>

        {/* ═══════ 2-D overlays (outside 3-D scene, don't rotate) ═══════ */}

        {/* Holographic scanlines */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: `repeating-linear-gradient(
              0deg,
              transparent 0px,
              transparent 2px,
              oklch(0.85 0.19 193 / 4%) 2px,
              oklch(0.85 0.19 193 / 4%) 3px
            )`,
          }}
        />

        {/* Shimmer sweep band */}
        <div className="absolute inset-0 rounded-full pointer-events-none overflow-hidden">
          <div
            className="absolute top-0 h-full"
            style={{
              width: "35%",
              background: `linear-gradient(
                90deg,
                transparent,
                oklch(0.85 0.19 193 / 10%),
                oklch(0.85 0.19 193 / 16%),
                oklch(0.85 0.19 193 / 10%),
                transparent
              )`,
              animation: "hg-sweep 5s ease-in-out infinite",
            }}
          />
        </div>

        {/* Decorative outer HUD ring + tick marks */}
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          className="absolute inset-0 pointer-events-none"
        >
          {/* Inner ring */}
          <circle
            cx={R} cy={R} r={R + 6}
            fill="none" stroke={CYAN} strokeOpacity="0.12" strokeWidth="0.5"
            style={{ animation: "hg-ring-pulse 4s ease-in-out infinite" }}
          />
          {/* Outer dashed ring */}
          <circle
            cx={R} cy={R} r={R + 12}
            fill="none" stroke={CYAN} strokeOpacity="0.06" strokeWidth="0.3"
            strokeDasharray="2 8"
          />
          {/* Tick marks every 10° */}
          {RING_TICKS.map((t, i) => {
            const r1 = R + 3;
            const r2 = R + (t.major ? 18 : 9);
            return (
              <line
                key={`tick${i}`}
                x1={R + t.cos * r1}
                y1={R + t.sin * r1}
                x2={R + t.cos * r2}
                y2={R + t.sin * r2}
                stroke={CYAN}
                strokeOpacity={t.major ? 0.35 : 0.12}
                strokeWidth={t.major ? 1 : 0.5}
              />
            );
          })}
        </svg>

        {/* Small coordinate readout (HUD detail) */}
        <div
          className="absolute pointer-events-none"
          style={{ top: 6, right: 8 }}
        >
          <span
            className="font-mono text-[8px] tracking-wider opacity-40"
            style={{ color: CYAN }}
          >
            40.7°N 74.0°W
          </span>
        </div>
      </div>

      {/* ═══════ Label beneath globe ═══════ */}
      <div className="flex items-center gap-3 mt-3 w-full px-1">
        {/* Left decorative line */}
        <div
          className="h-px flex-1"
          style={{ background: `linear-gradient(to right, transparent, ${CYAN_MED})` }}
        />
        {/* Label text */}
        <span
          className="font-mono text-[10px] tracking-[0.35em] uppercase whitespace-nowrap"
          style={{
            color: CYAN,
            textShadow: `0 0 8px ${CYAN_GLOW}`,
          }}
        >
          GLOBAL NETWORK
        </span>
        {/* Right decorative line */}
        <div
          className="h-px flex-1"
          style={{ background: `linear-gradient(to left, transparent, ${CYAN_MED})` }}
        />
      </div>
    </div>
  );
}