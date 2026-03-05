import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

// Landscape page: 148mm × 100mm at 300 DPI = 1748 × 1181 px
// Two badges side by side, each slot 872 × 1181 px, 4px cut line between
const PAGE_W = 1748;
const PAGE_H = 1181;
const SLOT_W = 872;
const CUT_X = 872;

export async function POST(req: NextRequest) {
  const { badgeUrls } = await req.json();

  if (!badgeUrls || !Array.isArray(badgeUrls) || badgeUrls.length === 0) {
    return NextResponse.json({ error: "badgeUrls required" }, { status: 400 });
  }

  const urls: [string, string] =
    badgeUrls.length === 1
      ? [badgeUrls[0], badgeUrls[0]]
      : [badgeUrls[0], badgeUrls[1]];

  const buffers = await Promise.all(
    urls.map(async (url: string) => {
      const res = await fetch(url);
      return Buffer.from(await res.arrayBuffer());
    }),
  );

  // Resize each badge to fit its slot (872 × 1181), centered with white bg
  const resized = await Promise.all(
    buffers.map((buf) =>
      sharp(buf)
        .resize(SLOT_W, PAGE_H, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255 },
        })
        .toBuffer(),
    ),
  );

  // Vertical cut line: 2px wide, full height
  const cutLine = await sharp({
    create: {
      width: 2,
      height: PAGE_H,
      channels: 3 as const,
      background: { r: 200, g: 200, b: 200 },
    },
  })
    .png()
    .toBuffer();

  // Small crop marks at top and bottom of cut line
  const cropMark = await sharp({
    create: {
      width: 4,
      height: 20,
      channels: 3 as const,
      background: { r: 150, g: 150, b: 150 },
    },
  })
    .png()
    .toBuffer();

  const result = await sharp({
    create: {
      width: PAGE_W,
      height: PAGE_H,
      channels: 3 as const,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      { input: resized[0], left: 0, top: 0 },
      { input: resized[1], left: CUT_X + 4, top: 0 },
      { input: cutLine, left: CUT_X + 1, top: 0 },
      { input: cropMark, left: CUT_X, top: 0 },
      { input: cropMark, left: CUT_X, top: PAGE_H - 20 },
    ])
    .withMetadata({ density: 300 })
    .jpeg({ quality: 95 })
    .toBuffer();

  return new NextResponse(new Uint8Array(result), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": 'attachment; filename="badge-print.jpg"',
    },
  });
}
