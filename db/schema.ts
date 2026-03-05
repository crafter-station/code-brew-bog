import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

export const avatars = pgTable("avatars", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid(10)),
  originalUrl: text("original_url").notNull(),
  avatarUrl: text("avatar_url").notNull(),
  badgeUrl: text("badge_url"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: text("role").default("CREATOR"),
  fingerprint: text("fingerprint"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
