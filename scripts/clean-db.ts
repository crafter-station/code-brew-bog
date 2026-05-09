import { db } from "../db";
import { avatars } from "../db/schema";

const deleted = await db.delete(avatars).returning({ id: avatars.id });
console.log(`Deleted ${deleted.length} avatar(s)`);
