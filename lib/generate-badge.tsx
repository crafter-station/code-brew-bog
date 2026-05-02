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

const V0_LOGO = { width: 258, height: 123, top: 1348, left: 144, src: "v0-logo-light.svg" };
const CS_LOGO = { width: 404, height: 107, top: 1358, left: 592, src: "cs-brand-black.png" };
const Z2A_LOGO = { width: 452, height: 71, top: 30, left: 318, src: "zero-to-agent.png" };
const Z2A_BG = { enabled: false, paddingX: 15, paddingY: 12, color: "#0a0a0a" };
const QR = { size: 120, top: 1090, left: 900 };

const logoBufferCache = new Map<string, Buffer>();

async function getLogoBuffer(spec: { width: number; height: number; src: string }) {
  const key = `${spec.src}:${spec.width}x${spec.height}`;
  const cached = logoBufferCache.get(key);
  if (cached) return cached;

  const filePath = path.join(process.cwd(), "public", spec.src);
  const file = await fs.readFile(filePath);
  const buf = await sharp(file)
    .resize(spec.width, spec.height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  logoBufferCache.set(key, buf);
  return buf;
}

const COLORS = {
  background: "#f5f5f5",
  black: "#0a0a0a",
  primary: "#f03d44",
  gray: "#666666",
  photoPlaceholder: "#dfdfdf",
};

const BADGE_WIDTH = 1080;
const BADGE_HEIGHT = 1600;
const PHOTO_SIZE = 960;

interface BadgeData {
  firstName: string;
  role: string;
}

function SpaceOdysseyBackground() {
  const radialLines = [];
  const centerX = BADGE_WIDTH / 2;
  const centerY = BADGE_HEIGHT / 2;

  for (let i = 0; i < 24; i++) {
    radialLines.push(
      <div
        key={`radial-${i}`}
        style={{
          position: "absolute",
          left: centerX,
          top: centerY,
          width: 2,
          height: 1400,
          backgroundColor: COLORS.black,
          transformOrigin: "top center",
          transform: `rotate(${i * 15}deg)`,
          opacity: 0.08,
        }}
      />
    );
  }

  const octagons = [200, 400, 600, 800, 1000, 1200].map((size, idx) => (
    <div
      key={`octagon-${idx}`}
      style={{
        position: "absolute",
        left: centerX - size,
        top: centerY - size,
        width: size * 2,
        height: size * 2,
        border: "1.5px solid rgba(10, 10, 10, 0.08)",
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

function BadgeTemplate({ data }: { data: BadgeData }) {
  const getNameFontSize = (name: string) => {
    if (name.length > 12) return 52;
    if (name.length > 8) return 64;
    return 72;
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
      <SpaceOdysseyBackground />

      {/* Photo area placeholder */}
      <div
        style={{
          position: "absolute",
          top: 100,
          left: 60,
          width: PHOTO_SIZE,
          height: PHOTO_SIZE,
          backgroundColor: COLORS.photoPlaceholder,
        }}
      />

      {/* Corner accents - top left */}
      <div style={{ position: "absolute", top: 100, left: 60, width: 8, height: 40, backgroundColor: COLORS.primary }} />
      <div style={{ position: "absolute", top: 100, left: 60, width: 40, height: 8, backgroundColor: COLORS.primary }} />

      {/* Corner accents - top right */}
      <div style={{ position: "absolute", top: 100, left: 1012, width: 8, height: 40, backgroundColor: COLORS.primary }} />
      <div style={{ position: "absolute", top: 100, left: 980, width: 40, height: 8, backgroundColor: COLORS.primary }} />

      {/* Corner accents - bottom left of photo */}
      <div style={{ position: "absolute", top: 1020, left: 60, width: 8, height: 40, backgroundColor: COLORS.primary }} />
      <div style={{ position: "absolute", top: 1052, left: 60, width: 40, height: 8, backgroundColor: COLORS.primary }} />

      {/* Corner accents - bottom right of photo */}
      <div style={{ position: "absolute", top: 1020, left: 1012, width: 8, height: 40, backgroundColor: COLORS.primary }} />
      <div style={{ position: "absolute", top: 1052, left: 980, width: 40, height: 8, backgroundColor: COLORS.primary }} />

      {/* L-Bracket frame element */}
      <div style={{ position: "absolute", top: 1080, left: 60, width: 16, height: 160, backgroundColor: COLORS.black }} />
      <div style={{ position: "absolute", top: 1224, left: 60, width: 140, height: 16, backgroundColor: COLORS.black }} />

      {/* First Name */}
      <div
        style={{
          position: "absolute",
          top: 1110,
          left: 100,
          color: COLORS.black,
          fontSize: getNameFontSize(data.firstName),
          fontWeight: 700,
          letterSpacing: "-0.02em",
          textTransform: "uppercase",
        }}
      >
        {data.firstName}
      </div>

      {/* Role with arrow */}
      <div
        style={{
          position: "absolute",
          top: 1190,
          left: 100,
          color: COLORS.gray,
          fontSize: 24,
          letterSpacing: "0.1em",
        }}
      >
        {`→ ${data.role.toUpperCase()}`}
      </div>

      {/* Bottom divider line */}
      <div style={{ position: "absolute", top: 1290, left: 60, width: 960, height: 2, backgroundColor: COLORS.black }} />

      {/* Logo placeholders (composited later via sharp) */}
      <div style={{ position: "absolute", top: V0_LOGO.top, left: V0_LOGO.left, width: V0_LOGO.width, height: V0_LOGO.height, backgroundColor: COLORS.background }} />
      <div style={{ position: "absolute", top: CS_LOGO.top, left: CS_LOGO.left, width: CS_LOGO.width, height: CS_LOGO.height, backgroundColor: COLORS.background }} />

      {/* Dark backdrop behind Zero-to-Agent */}
      {Z2A_BG.enabled && (
        <div
          style={{
            position: "absolute",
            top: Z2A_LOGO.top - Z2A_BG.paddingY,
            left: Z2A_LOGO.left - Z2A_BG.paddingX,
            width: Z2A_LOGO.width + Z2A_BG.paddingX * 2,
            height: Z2A_LOGO.height + Z2A_BG.paddingY * 2,
            backgroundColor: Z2A_BG.color,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          top: Z2A_LOGO.top,
          left: Z2A_LOGO.left,
          width: Z2A_LOGO.width,
          height: Z2A_LOGO.height,
          backgroundColor: Z2A_BG.enabled ? Z2A_BG.color : COLORS.background,
        }}
      />

      {/* QR Code placeholder */}
      <div style={{ position: "absolute", top: QR.top, left: QR.left, width: QR.size, height: QR.size, backgroundColor: COLORS.background }} />
    </div>
  );
}

export async function generateBadge(
  avatarId: string,
  avatarUrl: string,
  firstName: string,
  role: string
): Promise<string> {
  console.log("[badge] Generating badge for", firstName);

  // Fetch and process avatar into photo area
  const avatarResponse = await fetch(avatarUrl);
  const avatarBuffer = Buffer.from(await avatarResponse.arrayBuffer());

  const processedPhoto = await sharp(avatarBuffer)
    .resize(PHOTO_SIZE, PHOTO_SIZE, {
      fit: "contain",
      background: { r: 223, g: 223, b: 223, alpha: 1 },
    })
    .grayscale()
    .png()
    .toBuffer();

  // Generate QR code
  const qrTargetUrl = "https://crafters.chat/";

  const qrCodeBuffer = await QRCode.toBuffer(qrTargetUrl, {
    errorCorrectionLevel: "M",
    type: "png",
    width: QR.size,
    margin: 0,
    color: { dark: "#0a0a0a", light: "#f5f5f5" },
  });

  // Get fonts and logos
  const fonts = await getFonts();
  const [v0Buffer, csBuffer, z2aBuffer] = await Promise.all([
    getLogoBuffer(V0_LOGO),
    getLogoBuffer(CS_LOGO),
    getLogoBuffer(Z2A_LOGO),
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
      { input: processedPhoto, top: 100, left: 60 },
      { input: v0Buffer, top: V0_LOGO.top, left: V0_LOGO.left },
      { input: csBuffer, top: CS_LOGO.top, left: CS_LOGO.left },
      { input: z2aBuffer, top: Z2A_LOGO.top, left: Z2A_LOGO.left },
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
