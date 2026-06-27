import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import QRCode from "qrcode";
import satori from "satori";
import { put } from "@vercel/blob";

let fontCache: { regular: Buffer; bold: Buffer } | null = null;

async function getFonts() {
  if (!fontCache) {
    const fontsDir = path.join(
      process.cwd(),
      "node_modules/geist/dist/fonts/geist-mono"
    );
    const [regular, bold] = await Promise.all([
      fs.readFile(path.join(fontsDir, "GeistMono-Regular.ttf")),
      fs.readFile(path.join(fontsDir, "GeistMono-Bold.ttf")),
    ]);
    fontCache = { regular, bold };
  }
  return fontCache;
}

const COLORS = {
  background: "#fafafa",
  ink: "#22242f",
  paper: "#fafafa",
  accent: "#26251e",
  accentInk: "#26251e",
  dim: "rgba(34, 36, 47, 0.62)",
  muted: "rgba(34, 36, 47, 0.4)",
  border: "rgba(34, 36, 47, 0.16)",
  photoTile: "#ececec",
};

const BADGE_WIDTH = 1080;
const BADGE_HEIGHT = 1600;

const CURSOR_LOGO = {
  width: 460,
  height: Math.round((460 * 532.09) / 2238.7),
  top: 80,
  left: (BADGE_WIDTH - 460) / 2,
  src: "cursor-lockup.svg",
};

const PHOTO_SIZE = 860;
const PHOTO_TOP = 230;
const PHOTO_LEFT = (BADGE_WIDTH - PHOTO_SIZE) / 2;
const PHOTO_BOTTOM = PHOTO_TOP + PHOTO_SIZE;

const NAME_TOP = PHOTO_BOTTOM + 40;
const ROLE_TOP = NAME_TOP + 90;
const BRACKET_TOP = NAME_TOP - 20;
const BRACKET_BOTTOM = ROLE_TOP + 60;
const DIVIDER_TOP = BRACKET_BOTTOM + 30;

const CS_LOGO = {
  width: 360,
  height: Math.round((360 * 1940) / 7347),
  top: 1370,
  left: 100,
  src: "cs-brand-black.png",
};

const QR = {
  size: 130,
  top: 1340,
  left: 850,
};

const TAGLINE = "real challenges, real results_";

interface BadgeData {
  firstName: string;
  role: string;
}

function StarField() {
  const centerX = BADGE_WIDTH / 2;
  const centerY = BADGE_HEIGHT / 2;

  const radialLines = Array.from({ length: 24 }).map((_, i) => (
    <div
      key={`radial-${i}`}
      style={{
        position: "absolute",
        left: centerX,
        top: centerY,
        width: 2,
        height: 1400,
        backgroundColor: COLORS.ink,
        transformOrigin: "top center",
        transform: `rotate(${i * 15}deg)`,
        opacity: 0.05,
      }}
    />
  ));

  const octagons = [200, 400, 600, 800, 1000, 1200].map((size, idx) => (
    <div
      key={`octagon-${idx}`}
      style={{
        position: "absolute",
        left: centerX - size,
        top: centerY - size,
        width: size * 2,
        height: size * 2,
        border: "1.5px solid rgba(34, 36, 47, 0.06)",
        borderRadius: "15%",
        transform: "rotate(22.5deg)",
      }}
    />
  ));

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: BADGE_WIDTH,
        height: BADGE_HEIGHT,
        overflow: "hidden",
        display: "flex",
      }}
    >
      {radialLines}
      {octagons}
    </div>
  );
}

function Cross({ top, left }: { top: number; left: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width: 24,
        height: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: COLORS.accent,
        fontSize: 36,
        fontFamily: "Geist Mono",
        fontWeight: 400,
      }}
    >
      +
    </div>
  );
}

function BadgeTemplate({ data }: { data: BadgeData }) {
  const getNameFontSize = (name: string) => {
    if (name.length > 12) return 56;
    if (name.length > 8) return 68;
    return 76;
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: BADGE_WIDTH,
        height: BADGE_HEIGHT,
        backgroundColor: COLORS.background,
        position: "relative",
        fontFamily: "Geist Mono",
      }}
    >
      <StarField />

      {/* Border crosses (LatamBuilds + motif) */}
      <Cross top={30} left={30} />
      <Cross top={30} left={BADGE_WIDTH - 54} />
      <Cross top={BADGE_HEIGHT - 54} left={30} />
      <Cross top={BADGE_HEIGHT - 54} left={BADGE_WIDTH - 54} />

      {/* Top hairline + axis dot */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 80,
          width: BADGE_WIDTH - 160,
          height: 1,
          backgroundColor: COLORS.border,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 56,
          left: BADGE_WIDTH / 2 - 4,
          width: 8,
          height: 8,
          backgroundColor: COLORS.accent,
          transform: "rotate(45deg)",
        }}
      />

      {/* Cursor lockup backdrop (composited later) */}
      <div
        style={{
          position: "absolute",
          top: CURSOR_LOGO.top,
          left: CURSOR_LOGO.left,
          width: CURSOR_LOGO.width,
          height: CURSOR_LOGO.height,
          backgroundColor: COLORS.background,
        }}
      />

      {/* "CURSOR_" small caps under lockup */}
      <div
        style={{
          position: "absolute",
          top: CURSOR_LOGO.top + CURSOR_LOGO.height + 14,
          left: 0,
          width: BADGE_WIDTH,
          color: COLORS.accentInk,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "0.4em",
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        CURSOR_
      </div>

      {/* Photo tile */}
      <div
        style={{
          position: "absolute",
          top: PHOTO_TOP,
          left: PHOTO_LEFT,
          width: PHOTO_SIZE,
          height: PHOTO_SIZE,
          backgroundColor: COLORS.photoTile,
        }}
      />

      {/* Lavender corner brackets — top left */}
      <div style={{ position: "absolute", top: PHOTO_TOP, left: PHOTO_LEFT, width: 8, height: 48, backgroundColor: COLORS.accent }} />
      <div style={{ position: "absolute", top: PHOTO_TOP, left: PHOTO_LEFT, width: 48, height: 8, backgroundColor: COLORS.accent }} />

      {/* top right */}
      <div style={{ position: "absolute", top: PHOTO_TOP, left: PHOTO_LEFT + PHOTO_SIZE - 8, width: 8, height: 48, backgroundColor: COLORS.accent }} />
      <div style={{ position: "absolute", top: PHOTO_TOP, left: PHOTO_LEFT + PHOTO_SIZE - 48, width: 48, height: 8, backgroundColor: COLORS.accent }} />

      {/* bottom left */}
      <div style={{ position: "absolute", top: PHOTO_BOTTOM - 48, left: PHOTO_LEFT, width: 8, height: 48, backgroundColor: COLORS.accent }} />
      <div style={{ position: "absolute", top: PHOTO_BOTTOM - 8, left: PHOTO_LEFT, width: 48, height: 8, backgroundColor: COLORS.accent }} />

      {/* bottom right */}
      <div style={{ position: "absolute", top: PHOTO_BOTTOM - 48, left: PHOTO_LEFT + PHOTO_SIZE - 8, width: 8, height: 48, backgroundColor: COLORS.accent }} />
      <div style={{ position: "absolute", top: PHOTO_BOTTOM - 8, left: PHOTO_LEFT + PHOTO_SIZE - 48, width: 48, height: 8, backgroundColor: COLORS.accent }} />

      {/* L-bracket frame for name area */}
      <div style={{ position: "absolute", top: BRACKET_TOP, left: 60, width: 16, height: BRACKET_BOTTOM - BRACKET_TOP, backgroundColor: COLORS.ink }} />
      <div style={{ position: "absolute", top: BRACKET_BOTTOM - 16, left: 60, width: 160, height: 16, backgroundColor: COLORS.ink }} />

      {/* First name */}
      <div
        style={{
          position: "absolute",
          top: NAME_TOP,
          left: 100,
          color: COLORS.ink,
          fontSize: getNameFontSize(data.firstName),
          fontWeight: 700,
          letterSpacing: "-0.02em",
          textTransform: "uppercase",
        }}
      >
        {data.firstName}
      </div>

      {/* Role */}
      <div
        style={{
          position: "absolute",
          top: ROLE_TOP,
          left: 100,
          color: COLORS.dim,
          fontSize: 24,
          letterSpacing: "0.18em",
        }}
      >
        {`→ ${data.role.toUpperCase()}`}
      </div>

      {/* Divider — accent on left, dim on right */}
      <div style={{ position: "absolute", top: DIVIDER_TOP, left: 60, width: 200, height: 2, backgroundColor: COLORS.accent }} />
      <div style={{ position: "absolute", top: DIVIDER_TOP, left: 264, width: BADGE_WIDTH - 264 - 60, height: 1, backgroundColor: COLORS.border }} />

      {/* Bottom CS placeholder (composited later) */}
      <div style={{ position: "absolute", top: CS_LOGO.top, left: CS_LOGO.left, width: CS_LOGO.width, height: CS_LOGO.height, backgroundColor: COLORS.background }} />

      {/* QR placeholder (no tile needed on light bg) */}
      <div style={{ position: "absolute", top: QR.top, left: QR.left, width: QR.size, height: QR.size, backgroundColor: COLORS.background }} />

      {/* Tagline footer */}
      <div
        style={{
          position: "absolute",
          top: BADGE_HEIGHT - 70,
          left: 0,
          width: BADGE_WIDTH,
          color: COLORS.muted,
          fontSize: 18,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {TAGLINE}
      </div>
    </div>
  );
}

const logoBufferCache = new Map<string, Buffer>();

async function getLogoBuffer(
  spec: { width: number; height: number; src: string },
  options: { invertToWhite?: boolean } = {}
) {
  const key = `${spec.src}:${spec.width}x${spec.height}:${options.invertToWhite ? "w" : "k"}`;
  const cached = logoBufferCache.get(key);
  if (cached) return cached;

  const filePath = path.join(process.cwd(), "public", spec.src);
  const file = await fs.readFile(filePath);
  let pipeline = sharp(file).resize(spec.width, spec.height, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (options.invertToWhite) {
    pipeline = pipeline.negate({ alpha: false });
  }
  const buf = await pipeline.png().toBuffer();
  logoBufferCache.set(key, buf);
  return buf;
}

export async function generateBadge(
  avatarId: string,
  avatarUrl: string,
  firstName: string,
  role: string
): Promise<string> {
  console.log("[badge] Generating LatamBuilds badge for", firstName);

  // Fetch and process avatar into photo area
  const avatarResponse = await fetch(avatarUrl);
  const avatarBuffer = Buffer.from(await avatarResponse.arrayBuffer());

  const processedPhoto = await sharp(avatarBuffer)
    .resize(PHOTO_SIZE, PHOTO_SIZE, {
      fit: "contain",
      background: { r: 236, g: 236, b: 236, alpha: 1 },
    })
    .grayscale()
    .png()
    .toBuffer();

  // Generate QR code (dark fg on paper bg so it scans)
  const qrTargetUrl = "https://crafters.chat/";

  const qrCodeBuffer = await QRCode.toBuffer(qrTargetUrl, {
    errorCorrectionLevel: "M",
    type: "png",
    width: QR.size,
    margin: 0,
    color: { dark: "#22242f", light: "#fafafa" },
  });

  // Get fonts and logos
  const fonts = await getFonts();
  const [cursorBuffer, csBuffer] = await Promise.all([
    getLogoBuffer(CURSOR_LOGO),
    getLogoBuffer(CS_LOGO),
  ]);

  // Render badge template with satori
  const badgeSvg = await satori(
    <BadgeTemplate data={{ firstName, role }} />,
    {
      width: BADGE_WIDTH,
      height: BADGE_HEIGHT,
      fonts: [
        { name: "Geist Mono", data: fonts.regular, weight: 400, style: "normal" as const },
        { name: "Geist Mono", data: fonts.bold, weight: 700, style: "normal" as const },
      ],
    }
  );

  // Composite badge with photo, logos, and QR code
  const badgeBuffer = await sharp(Buffer.from(badgeSvg))
    .composite([
      { input: processedPhoto, top: PHOTO_TOP, left: PHOTO_LEFT },
      { input: cursorBuffer, top: CURSOR_LOGO.top, left: CURSOR_LOGO.left },
      { input: csBuffer, top: CS_LOGO.top, left: CS_LOGO.left },
      { input: qrCodeBuffer, top: QR.top, left: QR.left },
    ])
    .png({ quality: 90 })
    .toBuffer();

  console.log("[badge] Badge composed, uploading to Vercel Blob");

  const badgeBlobResult = await put(
    `badges/${avatarId}-${Date.now()}.png`,
    badgeBuffer,
    { access: "public", contentType: "image/png" }
  );

  console.log("[badge] Badge uploaded:", badgeBlobResult.url);
  return badgeBlobResult.url;
}
