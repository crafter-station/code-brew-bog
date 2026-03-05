import { db } from "@/db";
import { avatars } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BadgeClient } from "./client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const avatar = await db.query.avatars.findFirst({
    where: eq(avatars.id, id),
  });

  if (!avatar) return { title: "Not Found" };

  const name = avatar.firstName || "Anonymous";

  return {
    title: `${name}'s Code Brew Badge`,
    description: `Check out ${name}'s Code Brew pixel-art badge`,
    openGraph: {
      title: `${name}'s Code Brew Badge`,
      description: `Check out ${name}'s Code Brew pixel-art badge`,
      images: avatar.badgeUrl
        ? [{ url: avatar.badgeUrl, width: 1080, height: 1600 }]
        : [{ url: avatar.avatarUrl, width: 684, height: 577 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name}'s Code Brew Badge`,
      description: `Check out ${name}'s Code Brew pixel-art badge`,
      images: avatar.badgeUrl ? [avatar.badgeUrl] : [avatar.avatarUrl],
    },
  };
}

export default async function BadgePage({ params }: PageProps) {
  const { id } = await params;
  const avatar = await db.query.avatars.findFirst({
    where: eq(avatars.id, id),
  });

  if (!avatar) notFound();

  const imageUrl = avatar.badgeUrl || avatar.avatarUrl;
  const name = avatar.firstName || "Anonymous";

  return <BadgeClient imageUrl={imageUrl} name={name} id={id} hasBadge={!!avatar.badgeUrl} />;
}
