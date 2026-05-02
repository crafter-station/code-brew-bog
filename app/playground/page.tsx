"use client";

import { useState } from "react";

const BADGE_WIDTH = 1080;
const BADGE_HEIGHT = 1600;
const PHOTO_SIZE = 960;

// Layout — top padding added so Zero-to-Agent has room at the top
const PHOTO_X = 60;
const PHOTO_Y = 100;
const PHOTO_RIGHT = PHOTO_X + PHOTO_SIZE; // 1020
const PHOTO_BOTTOM = PHOTO_Y + PHOTO_SIZE; // 1060

// Compressed name/role band
const BRACKET_TOP = PHOTO_BOTTOM + 20; // 1080
const BRACKET_BOTTOM = 1240;            // height 160 (was 240)
const NAME_Y = 1170;
const ROLE_Y = 1210; // tighter gap (40 vs 70)
const DIVIDER_Y = 1290;

const COLORS = {
  background: "#f5f5f5",
  black: "#0a0a0a",
  primary: "#f03d44",
  gray: "#666666",
  photoPlaceholder: "#dfdfdf",
};

interface LogoSpec {
  key: "v0" | "cs" | "z2a";
  label: string;
  src: string;
  aspect: number; // width / height
  width: number;
  x: number;
  y: number;
}

const INITIAL_LOGOS: LogoSpec[] = [
  { key: "v0", label: "v0", src: "/v0-logo-light.svg", aspect: 252 / 120, width: 258, x: 144, y: 1348 },
  { key: "cs", label: "Crafter Station", src: "/cs-brand-black.png", aspect: 7347 / 1940, width: 404, x: 592, y: 1358 },
  { key: "z2a", label: "Zero to Agent", src: "/zero-to-agent.png", aspect: 9120 / 1430, width: 452, x: 318, y: 30 },
];

export default function PlaygroundPage() {
  const [logos, setLogos] = useState<LogoSpec[]>(INITIAL_LOGOS);
  const [firstName, setFirstName] = useState("CRIS");
  const [role, setRole] = useState("BUILDER");

  // Dark backdrop behind Zero-to-Agent
  const [z2aBgEnabled, setZ2aBgEnabled] = useState(false);
  const [z2aBgPaddingX, setZ2aBgPaddingX] = useState(15);
  const [z2aBgPaddingY, setZ2aBgPaddingY] = useState(12);
  const [z2aBgColor, setZ2aBgColor] = useState("#0a0a0a");

  // QR code
  const [qrX, setQrX] = useState(900);
  const [qrY, setQrY] = useState(1090);
  const [qrSize, setQrSize] = useState(120);

  const updateLogo = (key: LogoSpec["key"], patch: Partial<LogoSpec>) => {
    setLogos((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const getNameFontSize = (name: string) => {
    if (name.length > 12) return 52;
    if (name.length > 8) return 64;
    return 72;
  };

  const snippet = `// lib/generate-badge.tsx
${logos
  .map((l) => {
    const h = Math.round(l.width / l.aspect);
    const constName =
      l.key === "v0" ? "V0_LOGO" : l.key === "cs" ? "CS_LOGO" : "Z2A_LOGO";
    return `const ${constName} = { width: ${l.width}, height: ${h}, top: ${l.y}, left: ${l.x}, src: "${l.src.replace(/^\//, "")}" };`;
  })
  .join("\n")}
const Z2A_BG = { enabled: ${z2aBgEnabled}, paddingX: ${z2aBgPaddingX}, paddingY: ${z2aBgPaddingY}, color: "${z2aBgColor}" };
const QR = { size: ${qrSize}, top: ${qrY}, left: ${qrX} };`;

  return (
    <div className="min-h-dvh bg-background text-foreground p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xs uppercase tracking-widest font-bold">Badge Logo Playground</h1>
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
              <g opacity="0.08">
                {Array.from({ length: 24 }).map((_, i) => (
                  <line
                    key={`r-${i}`}
                    x1={BADGE_WIDTH / 2}
                    y1={BADGE_HEIGHT / 2}
                    x2={BADGE_WIDTH / 2 + Math.cos((i * 15 * Math.PI) / 180) * 1400}
                    y2={BADGE_HEIGHT / 2 + Math.sin((i * 15 * Math.PI) / 180) * 1400}
                    stroke={COLORS.black}
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
                    stroke={COLORS.black}
                    strokeWidth="1.5"
                  />
                ))}
              </g>

              {/* photo placeholder */}
              <rect x={PHOTO_X} y={PHOTO_Y} width={PHOTO_SIZE} height={PHOTO_SIZE} fill={COLORS.photoPlaceholder} />
              <text
                x={PHOTO_X + PHOTO_SIZE / 2}
                y={PHOTO_Y + PHOTO_SIZE / 2}
                fill="#999"
                fontSize="48"
                fontFamily="'Geist Mono', monospace"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                PHOTO
              </text>

              {/* corner accents */}
              <rect x={PHOTO_X} y={PHOTO_Y} width="8" height="40" fill={COLORS.primary} />
              <rect x={PHOTO_X} y={PHOTO_Y} width="40" height="8" fill={COLORS.primary} />
              <rect x={PHOTO_RIGHT - 8} y={PHOTO_Y} width="8" height="40" fill={COLORS.primary} />
              <rect x={PHOTO_RIGHT - 40} y={PHOTO_Y} width="40" height="8" fill={COLORS.primary} />
              <rect x={PHOTO_X} y={PHOTO_BOTTOM - 40} width="8" height="40" fill={COLORS.primary} />
              <rect x={PHOTO_X} y={PHOTO_BOTTOM - 8} width="40" height="8" fill={COLORS.primary} />
              <rect x={PHOTO_RIGHT - 8} y={PHOTO_BOTTOM - 40} width="8" height="40" fill={COLORS.primary} />
              <rect x={PHOTO_RIGHT - 40} y={PHOTO_BOTTOM - 8} width="40" height="8" fill={COLORS.primary} />

              {/* L-bracket */}
              <path
                d={`M60 ${BRACKET_TOP} L60 ${BRACKET_BOTTOM} L200 ${BRACKET_BOTTOM}`}
                fill="none"
                stroke={COLORS.black}
                strokeWidth="16"
              />

              {/* first name */}
              <text
                x="100"
                y={NAME_Y}
                fill={COLORS.black}
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
                y={ROLE_Y}
                fill={COLORS.gray}
                fontSize="24"
                fontFamily="'Geist Mono', monospace"
                letterSpacing="0.1em"
              >
                → {role.toUpperCase()}
              </text>

              {/* divider */}
              <line x1="60" y1={DIVIDER_Y} x2="1020" y2={DIVIDER_Y} stroke={COLORS.black} strokeWidth="2" />

              {/* Z2A dark backdrop (drawn before logos so it sits underneath) */}
              {z2aBgEnabled &&
                (() => {
                  const z2a = logos.find((l) => l.key === "z2a")!;
                  const h = Math.round(z2a.width / z2a.aspect);
                  return (
                    <rect
                      x={z2a.x - z2aBgPaddingX}
                      y={z2a.y - z2aBgPaddingY}
                      width={z2a.width + z2aBgPaddingX * 2}
                      height={h + z2aBgPaddingY * 2}
                      fill={z2aBgColor}
                    />
                  );
                })()}

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
                      stroke={COLORS.primary}
                      strokeWidth="2"
                      strokeDasharray="8 6"
                      opacity="0.4"
                    />
                    <image href={l.src} x={l.x} y={l.y} width={l.width} height={h} preserveAspectRatio="xMidYMid meet" />
                  </g>
                );
              })}

              {/* QR code placeholder */}
              <rect
                x={qrX - 2}
                y={qrY - 2}
                width={qrSize + 4}
                height={qrSize + 4}
                fill="none"
                stroke={COLORS.primary}
                strokeWidth="2"
                strokeDasharray="8 6"
                opacity="0.4"
              />
              <rect x={qrX} y={qrY} width={qrSize} height={qrSize} fill="#ddd" stroke={COLORS.black} strokeWidth="1" />
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
              <span className="text-[10px] uppercase tracking-wider font-bold">Zero to Agent backdrop</span>
              <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <input
                  type="checkbox"
                  checked={z2aBgEnabled}
                  onChange={(e) => setZ2aBgEnabled(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                Enabled
              </label>
            </div>
            <Control
              label="Padding X"
              value={z2aBgPaddingX}
              unit="px"
              min={0}
              max={80}
              step={1}
              onChange={setZ2aBgPaddingX}
            />
            <Control
              label="Padding Y"
              value={z2aBgPaddingY}
              unit="px"
              min={0}
              max={80}
              step={1}
              onChange={setZ2aBgPaddingY}
            />
            <label className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-20 shrink-0">Color</span>
              <input
                type="color"
                value={z2aBgColor}
                onChange={(e) => setZ2aBgColor(e.target.value)}
                className="h-8 w-16 bg-transparent border border-accent/20 cursor-pointer"
              />
              <span className="text-[10px] font-mono text-muted-foreground">{z2aBgColor}</span>
            </label>
          </div>

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
