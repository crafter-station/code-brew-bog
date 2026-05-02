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

          {/* v0 brand */}
          <g transform="translate(60, 1400) scale(1.6)">
            <path
              d="M96 86.0625V24H120V103.125C120 112.445 112.445 120 103.125 120C98.6751 120 94.2826 118.284 91.125 115.127L0 24H33.9375L96 86.0625Z"
              fill={COLORS.black}
            />
            <path
              d="M218.25 0C236.89 0 252 15.1104 252 33.75V96H228V41.0625L173.062 96H228V120H165.75C147.11 120 132 104.89 132 86.25V24H156V79.125L211.125 24H156V0H218.25Z"
              fill={COLORS.black}
            />
          </g>

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
