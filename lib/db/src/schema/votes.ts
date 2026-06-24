import { pgTable, serial, timestamp, integer, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const votesTable = pgTable("votes", {
  id: serial("id").primaryKey(),
  pollId: integer("poll_id").notNull(),
  deviceToken: text("device_token").notNull(),
  ipAddress: text("ip_address"),
  optionIndex: integer("option_index").notNull(),
  castedAt: timestamp("casted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVoteSchema = createInsertSchema(votesTable).omit({ id: true, castedAt: true });
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votesTable.$inferSelect;
