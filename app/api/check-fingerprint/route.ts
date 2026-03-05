import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { avatars } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

const MAX_GENERATIONS = 3;
const isDev = process.env.NODE_ENV === "development";

export async function POST(request: NextRequest) {
  try {
    // Skip rate limiting in dev
    if (isDev) {
      return NextResponse.json({ allowed: true, remaining: MAX_GENERATIONS });
    }

    const { fingerprint } = await request.json();

    if (!fingerprint) {
      return NextResponse.json({ allowed: false, remaining: 0 });
    }

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(avatars)
      .where(eq(avatars.fingerprint, fingerprint));

    const count = Number(result.count);
    const remaining = Math.max(0, MAX_GENERATIONS - count);

    return NextResponse.json({
      allowed: count < MAX_GENERATIONS,
      remaining,
    });
  } catch (error) {
    console.error("[fingerprint] Error:", error);
    return NextResponse.json({ allowed: true, remaining: MAX_GENERATIONS });
  }
}
