import { desc } from "drizzle-orm";
import { db } from "@/db";
import { avatars } from "@/db/schema";
import { GalleryClient, type AvatarResult } from "./gallery-client";

export default async function GalleryPage() {
  const rows = await db
    .select()
    .from(avatars)
    .orderBy(desc(avatars.createdAt))
    .limit(50);

  const initialGallery: AvatarResult[] = rows.map((item) => ({
    id: item.id,
    originalUrl: item.originalUrl,
    avatarUrl: item.avatarUrl,
    badgeUrl: item.badgeUrl,
    createdAt: new Date(item.createdAt).getTime(),
  }));

  return <GalleryClient initialGallery={initialGallery} />;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
