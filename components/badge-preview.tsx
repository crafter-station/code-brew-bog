"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface BadgePreviewProps {
  avatarUrl?: string | null;
  firstName: string;
  role: string;
  avatarId?: string;
  className?: string;
}

const COLORS = {
  background: "#f5f5f5",
  black: "#0a0a0a",
  primary: "#f03d44",
  gray: "#666666",
};

const BADGE_WIDTH = 1080;
const BADGE_HEIGHT = 1600;
const PHOTO_SIZE = 960;

export function BadgePreview({
  avatarUrl,
  firstName,
  role,
  avatarId,
  className,
}: BadgePreviewProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  useEffect(() => {
    if (!avatarId) return;
    QRCode.toDataURL(`${window.location.origin}/b/${avatarId}`, {
      width: 120,
      margin: 0,
      color: { dark: "#0a0a0a", light: "#f5f5f5" },
    }).then(setQrCodeDataUrl).catch(console.error);
  }, [avatarId]);

  const getNameFontSize = (name: string) => {
    if (name.length > 12) return "52";
    if (name.length > 8) return "64";
    return "72";
  };

  return (
    <div className={className}>
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${BADGE_WIDTH}/${BADGE_HEIGHT}` }}>
        <svg
          width={BADGE_WIDTH}
          height={BADGE_HEIGHT}
          viewBox={`0 0 ${BADGE_WIDTH} ${BADGE_HEIGHT}`}
          className="absolute top-0 left-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          style={{ overflow: "hidden" }}
        >
          <defs>
            <filter id="grayscale">
              <feColorMatrix
                type="matrix"
                values="0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0 0 0 1 0"
              />
            </filter>
            <clipPath id="photoClip">
              <rect x="60" y="60" width={PHOTO_SIZE} height={PHOTO_SIZE} />
            </clipPath>
            <clipPath id="bgClip">
              <rect width={BADGE_WIDTH} height={BADGE_HEIGHT} />
            </clipPath>
          </defs>

          {/* Background */}
          <rect width={BADGE_WIDTH} height={BADGE_HEIGHT} fill={COLORS.background} />

          {/* Space Odyssey radial pattern */}
          <g clipPath="url(#bgClip)" opacity="0.08">
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

          {/* Photo area */}
          <rect x="60" y="60" width={PHOTO_SIZE} height={PHOTO_SIZE} fill="#dfdfdf" />
          {avatarUrl && (
            <image
              href={avatarUrl}
              x="60"
              y="60"
              width={PHOTO_SIZE}
              height={PHOTO_SIZE}
              filter="url(#grayscale)"
              preserveAspectRatio="xMidYMid meet"
              clipPath="url(#photoClip)"
            />
          )}

          {/* L-Bracket */}
          <path d="M60 1020 L60 1260 L200 1260" fill="none" stroke={COLORS.black} strokeWidth="16" />

          {/* First Name */}
          <text
            x="100"
            y="1140"
            fill={COLORS.black}
            fontSize={getNameFontSize(firstName)}
            fontWeight="700"
            fontFamily="'Geist Mono', monospace"
            letterSpacing="-0.02em"
          >
            {firstName.toUpperCase()}
          </text>

          {/* Role */}
          <text
            x="100"
            y="1210"
            fill={COLORS.gray}
            fontSize="24"
            fontFamily="'Geist Mono', monospace"
            letterSpacing="0.1em"
          >
            → {role.toUpperCase()}
          </text>

          {/* Divider */}
          <line x1="60" y1="1360" x2="1020" y2="1360" stroke={COLORS.black} strokeWidth="2" />

          {/* CODE BREW brand */}
          <text x="60" y="1450" fontSize="72" fontWeight="700" fontFamily="'Geist Mono', monospace" letterSpacing="0.26em">
            <tspan fill={COLORS.primary}>{"<"}</tspan>
            <tspan fill={COLORS.black}>CODE</tspan>
          </text>
          <text x="160" y="1530" fontSize="72" fontWeight="700" fontFamily="'Geist Mono', monospace" letterSpacing="0.26em">
            <tspan fill={COLORS.black}>BREW</tspan>
            <tspan fill={COLORS.primary}>{">"}</tspan>
          </text>

          {/* QR Code */}
          {qrCodeDataUrl && (
            <image href={qrCodeDataUrl} x="900" y="1420" width="120" height="120" />
          )}

          {/* Corner accents */}
          <rect x="60" y="60" width="8" height="40" fill={COLORS.primary} />
          <rect x="60" y="60" width="40" height="8" fill={COLORS.primary} />
          <rect x="1012" y="60" width="8" height="40" fill={COLORS.primary} />
          <rect x="980" y="60" width="40" height="8" fill={COLORS.primary} />
          <rect x="60" y="980" width="8" height="40" fill={COLORS.primary} />
          <rect x="60" y="1012" width="40" height="8" fill={COLORS.primary} />
          <rect x="1012" y="980" width="8" height="40" fill={COLORS.primary} />
          <rect x="980" y="1012" width="40" height="8" fill={COLORS.primary} />
        </svg>
      </div>
    </div>
  );
}
