import { NextResponse } from "next/server";
import { db } from "@/db";
import { avatars } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const results = await db
      .select()
      .from(avatars)
      .orderBy(desc(avatars.createdAt))
      .limit(50);

    return NextResponse.json(results);
  } catch (error) {
    console.error("[gallery] Failed to fetch:", error);
    return NextResponse.json([]);
  }
}
