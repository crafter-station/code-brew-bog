import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { avatars } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateBadge } from "@/lib/generate-badge";

export async function POST(request: NextRequest) {
  try {
    const { avatarId, firstName, role } = await request.json();

    if (!avatarId || !firstName) {
      return NextResponse.json(
        { error: "avatarId and firstName are required" },
        { status: 400 },
      );
    }

    const avatar = await db.query.avatars.findFirst({
      where: eq(avatars.id, avatarId),
    });

    if (!avatar) {
      return NextResponse.json(
        { error: "Avatar not found" },
        { status: 404 },
      );
    }

    const badgeUrl = await generateBadge(
      avatarId,
      avatar.avatarUrl,
      firstName,
      role || "CREATOR",
    );

    // Update DB with badge info
    await db
      .update(avatars)
      .set({
        badgeUrl,
        firstName,
        role: role || "CREATOR",
      })
      .where(eq(avatars.id, avatarId));

    return NextResponse.json({ badgeUrl });
  } catch (error) {
    console.error("[generate-badge] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate badge" },
      { status: 500 },
    );
  }
}
