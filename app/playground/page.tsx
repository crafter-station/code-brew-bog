"use client";

import { useState } from "react";

const BADGE_WIDTH = 1080;
const BADGE_HEIGHT = 1600;

const PHOTO_SIZE = 860;
const PHOTO_TOP = 230;
const PHOTO_LEFT = (BADGE_WIDTH - PHOTO_SIZE) / 2;
const PHOTO_BOTTOM = PHOTO_TOP + PHOTO_SIZE;

const NAME_TOP = PHOTO_BOTTOM + 40 + 70; // satori dom-baseline differs from svg text baseline; offset for preview
const ROLE_TOP = NAME_TOP + 50;
const BRACKET_TOP = PHOTO_BOTTOM + 20;
const BRACKET_BOTTOM = ROLE_TOP + 30;
const DIVIDER_TOP = BRACKET_BOTTOM + 30;

const COLORS = {
  background: "#fafafa",
  ink: "#22242f",
  paper: "#fafafa",
  accent: "#26251e",
  accentInk: "#26251e",
  border: "rgba(34, 36, 47, 0.16)",
  muted: "rgba(34, 36, 47, 0.4)",
  dim: "rgba(34, 36, 47, 0.62)",
  photoTile: "#ececec",
};

interface LogoSpec {
  key: "cursor" | "cs";
  label: string;
  src: string;
  aspect: number;
  width: number;
  x: number;
  y: number;
  invert?: boolean;
}

const INITIAL_LOGOS: LogoSpec[] = [
  { key: "cursor", label: "Cursor", src: "/cursor-lockup.svg", aspect: 2238.7 / 532.09, width: 460, x: 310, y: 80 },
  { key: "cs", label: "Crafter Station", src: "/cs-brand-black.png", aspect: 7347 / 1940, width: 360, x: 100, y: 1370 },
];

export default function PlaygroundPage() {
  const [logos, setLogos] = useState<LogoSpec[]>(INITIAL_LOGOS);
  const [firstName, setFirstName] = useState("CRIS");
  const [role, setRole] = useState("BUILDER");

  const [qrX, setQrX] = useState(850);
  const [qrY, setQrY] = useState(1340);
  const [qrSize, setQrSize] = useState(130);

  const updateLogo = (key: LogoSpec["key"], patch: Partial<LogoSpec>) => {
    setLogos((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const getNameFontSize = (name: string) => {
    if (name.length > 12) return 56;
    if (name.length > 8) return 68;
    return 76;
  };

  const snippet = `// lib/generate-badge.tsx
${logos
  .map((l) => {
    const h = Math.round(l.width / l.aspect);
    const constName = l.key === "cursor" ? "CURSOR_LOGO" : "CS_LOGO";
    return `const ${constName} = { width: ${l.width}, height: ${h}, top: ${l.y}, left: ${l.x}, src: "${l.src.replace(/^\//, "")}" };`;
  })
  .join("\n")}
const QR = { size: ${qrSize}, top: ${qrY}, left: ${qrX} };`;

  return (
    <div className="min-h-dvh bg-background text-foreground p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xs uppercase tracking-widest font-bold">LatamBuilds Badge Playground</h1>
        <a
          href="/"
          className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-accent transition-colors"
        >
          ← Back
        </a>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] gap-6 items-start">
        {/* Live badge preview */}
        <div className="w-full max-w-[480px] mx-auto">
          <div
            className="border-2 border-accent/30 overflow-hidden"
            style={{ aspectRatio: `${BADGE_WIDTH}/${BADGE_HEIGHT}` }}
          >
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${BADGE_WIDTH} ${BADGE_HEIGHT}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* background */}
              <rect width={BADGE_WIDTH} height={BADGE_HEIGHT} fill={COLORS.background} />

              {/* radial bg pattern */}
              <g opacity="0.05">
                {Array.from({ length: 24 }).map((_, i) => (
                  <line
                    key={`r-${i}`}
                    x1={BADGE_WIDTH / 2}
                    y1={BADGE_HEIGHT / 2}
                    x2={BADGE_WIDTH / 2 + Math.cos((i * 15 * Math.PI) / 180) * 1400}
                    y2={BADGE_HEIGHT / 2 + Math.sin((i * 15 * Math.PI) / 180) * 1400}
                    stroke={COLORS.ink}
                    strokeWidth="2"
                  />
                ))}
                {[200, 400, 600, 800, 1000, 1200].map((size, idx) => (
                  <polygon
                    key={`o-${idx}`}
                    points={Array.from({ length: 8 })
                      .map((_, i) => {
                        const angle = (i * 45 - 22.5) * (Math.PI / 180);
                        return `${BADGE_WIDTH / 2 + Math.cos(angle) * size},${BADGE_HEIGHT / 2 + Math.sin(angle) * size}`;
                      })
                      .join(" ")}
                    fill="none"
                    stroke={COLORS.ink}
                    strokeWidth="1.5"
                  />
                ))}
              </g>

              {/* corner crosses */}
              {[
                { x: 30, y: 30 },
                { x: BADGE_WIDTH - 54, y: 30 },
                { x: 30, y: BADGE_HEIGHT - 54 },
                { x: BADGE_WIDTH - 54, y: BADGE_HEIGHT - 54 },
              ].map((c, i) => (
                <text
                  key={`cross-${i}`}
                  x={c.x + 12}
                  y={c.y + 22}
                  fill={COLORS.accent}
                  fontSize="36"
                  fontFamily="'Geist Mono', monospace"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  +
                </text>
              ))}

              {/* top hairline + diamond */}
              <line x1="80" y1="60" x2={BADGE_WIDTH - 80} y2="60" stroke={COLORS.border} strokeWidth="1" />
              <rect
                x={BADGE_WIDTH / 2 - 4}
                y={56}
                width="8"
                height="8"
                fill={COLORS.accent}
                transform={`rotate(45, ${BADGE_WIDTH / 2}, 60)`}
              />

              {/* photo tile */}
              <rect x={PHOTO_LEFT} y={PHOTO_TOP} width={PHOTO_SIZE} height={PHOTO_SIZE} fill={COLORS.photoTile} />
              <text
                x={PHOTO_LEFT + PHOTO_SIZE / 2}
                y={PHOTO_TOP + PHOTO_SIZE / 2}
                fill="#bbb"
                fontSize="48"
                fontFamily="'Geist Mono', monospace"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                PHOTO
              </text>

              {/* corner accents (lavender) */}
              {[
                { x: PHOTO_LEFT, y: PHOTO_TOP, dx: 1, dy: 1 },
                { x: PHOTO_LEFT + PHOTO_SIZE - 8, y: PHOTO_TOP, dx: -1, dy: 1, hx: PHOTO_LEFT + PHOTO_SIZE - 48 },
                { x: PHOTO_LEFT, y: PHOTO_BOTTOM - 48, dx: 1, dy: -1, hy: PHOTO_BOTTOM - 8 },
                { x: PHOTO_LEFT + PHOTO_SIZE - 8, y: PHOTO_BOTTOM - 48, dx: -1, dy: -1, hx: PHOTO_LEFT + PHOTO_SIZE - 48, hy: PHOTO_BOTTOM - 8 },
              ].map((c, i) => (
                <g key={`acc-${i}`}>
                  <rect x={c.x} y={c.y} width="8" height="48" fill={COLORS.accent} />
                  <rect x={c.hx ?? c.x} y={c.hy ?? c.y} width="48" height="8" fill={COLORS.accent} />
                </g>
              ))}

              {/* L-bracket */}
              <path
                d={`M60 ${BRACKET_TOP} L60 ${BRACKET_BOTTOM} L220 ${BRACKET_BOTTOM}`}
                fill="none"
                stroke={COLORS.ink}
                strokeWidth="16"
              />

              {/* first name */}
              <text
                x="100"
                y={NAME_TOP}
                fill={COLORS.ink}
                fontSize={getNameFontSize(firstName)}
                fontWeight="700"
                fontFamily="'Geist Mono', monospace"
                letterSpacing="-0.02em"
              >
                {firstName.toUpperCase()}
              </text>

              {/* role */}
              <text
                x="100"
                y={ROLE_TOP}
                fill={COLORS.dim}
                fontSize="24"
                fontFamily="'Geist Mono', monospace"
                letterSpacing="0.18em"
              >
                → {role.toUpperCase()}
              </text>

              {/* divider */}
              <line x1="60" y1={DIVIDER_TOP} x2="260" y2={DIVIDER_TOP} stroke={COLORS.accent} strokeWidth="2" />
              <line x1="264" y1={DIVIDER_TOP} x2={BADGE_WIDTH - 60} y2={DIVIDER_TOP} stroke={COLORS.border} strokeWidth="1" />

              {/* CURSOR_ caption (under Cursor logo) */}
              <text
                x={BADGE_WIDTH / 2}
                y={(logos.find((l) => l.key === "cursor")?.y ?? 80) + Math.round((logos.find((l) => l.key === "cursor")?.width ?? 460) / (2238.7 / 532.09)) + 28}
                fill={COLORS.accentInk}
                fontSize="18"
                fontWeight="700"
                fontFamily="'Geist Mono', monospace"
                letterSpacing="0.4em"
                textAnchor="middle"
              >
                CURSOR_
              </text>

              {/* tagline */}
              <text
                x={BADGE_WIDTH / 2}
                y={BADGE_HEIGHT - 50}
                fill={COLORS.muted}
                fontSize="18"
                fontFamily="'Geist Mono', monospace"
                letterSpacing="0.24em"
                textAnchor="middle"
                style={{ textTransform: "uppercase" }}
              >
                REAL CHALLENGES, REAL RESULTS_
              </text>

              {/* Logos */}
              {logos.map((l) => {
                const h = Math.round(l.width / l.aspect);
                return (
                  <g key={l.key}>
                    <rect
                      x={l.x - 2}
                      y={l.y - 2}
                      width={l.width + 4}
                      height={h + 4}
                      fill="none"
                      stroke={COLORS.accent}
                      strokeWidth="2"
                      strokeDasharray="8 6"
                      opacity="0.4"
                    />
                    <image
                      href={l.src}
                      x={l.x}
                      y={l.y}
                      width={l.width}
                      height={h}
                      preserveAspectRatio="xMidYMid meet"
                    />
                  </g>
                );
              })}

              {/* QR placeholder */}
              <rect x={qrX} y={qrY} width={qrSize} height={qrSize} fill="#ddd" />
              <text
                x={qrX + qrSize / 2}
                y={qrY + qrSize / 2}
                fill="#666"
                fontSize="14"
                fontFamily="'Geist Mono', monospace"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                QR
              </text>
            </svg>
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">
            Badge: {BADGE_WIDTH} × {BADGE_HEIGHT}
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-5">
          {logos.map((l) => {
            const h = Math.round(l.width / l.aspect);
            return (
              <div key={l.key} className="border border-accent/20 p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-bold">{l.label}</span>
                  <span className="text-[9px] font-mono text-muted-foreground">
                    {l.width}×{h}
                  </span>
                </div>
                <Control
                  label="Width"
                  value={l.width}
                  unit="px"
                  min={60}
                  max={900}
                  step={2}
                  onChange={(n) => updateLogo(l.key, { width: n })}
                />
                <Control
                  label="X (left)"
                  value={l.x}
                  unit="px"
                  min={0}
                  max={BADGE_WIDTH - 50}
                  step={2}
                  onChange={(n) => updateLogo(l.key, { x: n })}
                />
                <Control
                  label="Y (top)"
                  value={l.y}
                  unit="px"
                  min={0}
                  max={BADGE_HEIGHT - 30}
                  step={2}
                  onChange={(n) => updateLogo(l.key, { y: n })}
                />
              </div>
            );
          })}

          <div className="border border-accent/20 p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold">QR code</span>
              <span className="text-[9px] font-mono text-muted-foreground">
                {qrSize}×{qrSize}
              </span>
            </div>
            <Control
              label="Size"
              value={qrSize}
              unit="px"
              min={60}
              max={300}
              step={2}
              onChange={setQrSize}
            />
            <Control
              label="X (left)"
              value={qrX}
              unit="px"
              min={0}
              max={BADGE_WIDTH - 30}
              step={2}
              onChange={setQrX}
            />
            <Control
              label="Y (top)"
              value={qrY}
              unit="px"
              min={0}
              max={BADGE_HEIGHT - 30}
              step={2}
              onChange={setQrY}
            />
          </div>

          <div className="border-t border-accent/20 pt-3 flex flex-col gap-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Sample text</div>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              className="h-9 px-3 bg-muted border border-accent/20 text-foreground text-sm font-mono focus:outline-none focus:border-accent"
            />
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Role"
              className="h-9 px-3 bg-muted border border-accent/20 text-foreground text-sm font-mono focus:outline-none focus:border-accent"
            />
          </div>

          <div className="border-t border-accent/20 pt-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Snippet</div>
            <pre className="text-[11px] leading-relaxed bg-muted border border-accent/20 p-3 overflow-x-auto whitespace-pre">
              {snippet}
            </pre>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(snippet)}
              className="mt-2 px-3 h-8 text-[10px] uppercase tracking-wider border border-accent/30 text-muted-foreground hover:text-accent hover:border-accent transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Control({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-20 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-[var(--accent)]"
      />
      <span className="text-[10px] font-mono w-14 text-right">
        {value}
        {unit}
      </span>
    </label>
  );
}
