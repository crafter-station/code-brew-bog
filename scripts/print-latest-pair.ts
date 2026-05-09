import { desc, isNotNull } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { db } from "../db";
import { avatars } from "../db/schema";

const PRINT_DIR = path.join(process.cwd(), "print");

const PAGE_W = 1748;
const PAGE_H = 1181;
const SLOT_W = 872;
const CUT_X = 872;

await fs.mkdir(PRINT_DIR, { recursive: true });

const latest = await db
  .select({
    id: avatars.id,
    firstName: avatars.firstName,
    lastName: avatars.lastName,
    badgeUrl: avatars.badgeUrl,
  })
  .from(avatars)
  .where(isNotNull(avatars.badgeUrl))
  .orderBy(desc(avatars.createdAt))
  .limit(2);

if (latest.length < 2) {
  throw new Error(`Need 2 badges, got ${latest.length}`);
}

// Reverse so the older of the two (e.g. cesar) is on the left.
const [right, left] = latest;

const slug = (s: string | null) =>
  (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const labelFor = (row: (typeof latest)[number]) => {
  const namePart = [slug(row.firstName), slug(row.lastName)].filter(Boolean).join("-");
  return namePart ? `${namePart}-${row.id}` : row.id;
};

async function fetchAndResize(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return sharp(buf)
    .resize(SLOT_W, PAGE_H, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255 },
    })
    .toBuffer();
}

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

const [leftBuf, rightBuf] = await Promise.all([
  fetchAndResize(left.badgeUrl!),
  fetchAndResize(right.badgeUrl!),
]);

const composite = await sharp({
  create: {
    width: PAGE_W,
    height: PAGE_H,
    channels: 3 as const,
    background: { r: 255, g: 255, b: 255 },
  },
})
  .composite([
    { input: leftBuf, left: 0, top: 0 },
    { input: rightBuf, left: CUT_X + 4, top: 0 },
    { input: cutLine, left: CUT_X + 1, top: 0 },
    { input: cropMark, left: CUT_X, top: 0 },
    { input: cropMark, left: CUT_X, top: PAGE_H - 20 },
  ])
  .withMetadata({ density: 300 })
  .jpeg({ quality: 95 })
  .toBuffer();

const filename = `pair-latest-${labelFor(left)}__${labelFor(right)}.jpg`;
const filePath = path.join(PRINT_DIR, filename);
await fs.writeFile(filePath, composite);

console.log(`✓ ${filename}`);
console.log(`  left:  ${left.firstName ?? ""} ${left.lastName ?? ""} (${left.id})`);
console.log(`  right: ${right.firstName ?? ""} ${right.lastName ?? ""} (${right.id})`);
