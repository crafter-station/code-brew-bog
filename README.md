# Cursor Café Badge

Take a photo, get a pixel-art badge. Built for the Cursor Café.

- **Live:** https://cursor.crafter.run/
- **Vercel project:** https://vercel.com/crafter-station/cursor-cafe-badge

## Getting Started

Run the development server:

```bash
bun dev
# or: npm run dev / yarn dev / pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result.

Edit `app/page.tsx` to change the badge creation flow. Badge rendering lives in
`lib/generate-badge.tsx`, and `/playground` is a layout tool for positioning the
logos, caption, and QR code.

## Stack

- [Next.js](https://nextjs.org) (App Router)
- [Satori](https://github.com/vercel/satori) + [sharp](https://sharp.pixelplumbing.com/) for badge image generation
- [Drizzle ORM](https://orm.drizzle.team/) + Vercel Blob for storage
- [Geist Mono](https://vercel.com/font)

## Deploy

Deployed on [Vercel](https://vercel.com/crafter-station/cursor-cafe-badge).
