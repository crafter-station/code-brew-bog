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
          top: 60,
          left: 60,
          width: PHOTO_SIZE,
          height: PHOTO_SIZE,
          backgroundColor: COLORS.photoPlaceholder,
        }}
      />

      {/* Corner accents - top left */}
      <div style={{ position: "absolute", top: 60, left: 60, width: 8, height: 40, backgroundColor: COLORS.primary }} />
      <div style={{ position: "absolute", top: 60, left: 60, width: 40, height: 8, backgroundColor: COLORS.primary }} />

      {/* Corner accents - top right */}
      <div style={{ position: "absolute", top: 60, left: 1012, width: 8, height: 40, backgroundColor: COLORS.primary }} />
      <div style={{ position: "absolute", top: 60, left: 980, width: 40, height: 8, backgroundColor: COLORS.primary }} />

      {/* Corner accents - bottom left of photo */}
      <div style={{ position: "absolute", top: 980, left: 60, width: 8, height: 40, backgroundColor: COLORS.primary }} />
      <div style={{ position: "absolute", top: 1012, left: 60, width: 40, height: 8, backgroundColor: COLORS.primary }} />

      {/* Corner accents - bottom right of photo */}
      <div style={{ position: "absolute", top: 980, left: 1012, width: 8, height: 40, backgroundColor: COLORS.primary }} />
      <div style={{ position: "absolute", top: 1012, left: 980, width: 40, height: 8, backgroundColor: COLORS.primary }} />

      {/* L-Bracket frame element */}
      <div style={{ position: "absolute", top: 1020, left: 60, width: 16, height: 240, backgroundColor: COLORS.black }} />
      <div style={{ position: "absolute", top: 1244, left: 60, width: 140, height: 16, backgroundColor: COLORS.black }} />

      {/* First Name */}
      <div
        style={{
          position: "absolute",
          top: 1080,
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
          top: 1170,
          left: 100,
          color: COLORS.gray,
          fontSize: 24,
          letterSpacing: "0.1em",
        }}
      >
        {`→ ${data.role.toUpperCase()}`}
      </div>

      {/* Bottom divider line */}
      <div style={{ position: "absolute", top: 1360, left: 60, width: 960, height: 2, backgroundColor: COLORS.black }} />

      {/* CODE BREW brand */}
      <div
        style={{
          position: "absolute",
          top: 1380,
          left: 60,
          display: "flex",
          flexDirection: "column",
          gap: 0,
          lineHeight: 1,
        }}
      >
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700, letterSpacing: "0.26em" }}>
          <span style={{ color: COLORS.primary }}>{`<`}</span>
          <span style={{ color: COLORS.black }}>{`CODE`}</span>
        </div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700, letterSpacing: "0.26em", paddingLeft: 100 }}>
          <span style={{ color: COLORS.black }}>{`BREW`}</span>
          <span style={{ color: COLORS.primary }}>{`>`}</span>
        </div>
      </div>

      {/* QR Code placeholder */}
      <div style={{ position: "absolute", top: 1420, left: 900, width: 120, height: 120, backgroundColor: COLORS.background }} />
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
  let domain = "ai-camera.vercel.app";
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    domain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  } else if (process.env.VERCEL_BRANCH_URL) {
    domain = process.env.VERCEL_BRANCH_URL;
  }
  const profileUrl = `https://${domain}/b/${avatarId}`;

  const qrCodeBuffer = await QRCode.toBuffer(profileUrl, {
    errorCorrectionLevel: "M",
    type: "png",
    width: 120,
    margin: 0,
    color: { dark: "#0a0a0a", light: "#f5f5f5" },
  });

  // Get fonts
  const fonts = await getFonts();

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

  // Composite badge with photo and QR code
  const badgeBuffer = await sharp(Buffer.from(badgeSvg))
    .composite([
      { input: processedPhoto, top: 60, left: 60 },
      { input: qrCodeBuffer, top: 1420, left: 900 },
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
