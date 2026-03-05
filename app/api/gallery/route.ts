import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { avatars } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

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

export async function DELETE(request: NextRequest) {
  const pass = request.cookies.get("pass")?.value;

  if (pass !== "aleja0") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    await db.delete(avatars).where(eq(avatars.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[gallery] Failed to delete:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
