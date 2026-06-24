import { pgTable, text, serial, timestamp, boolean, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pollsTable = pgTable("polls", {
  id: serial("id").primaryKey(),
  adminId: varchar("admin_id"),
  question: text("question").notNull(),
  options: text("options").array().notNull(),
  pin: text("pin"),
  pinRequired: boolean("pin_required").notNull().default(false),
  networkKey: text("network_key").notNull(),
  status: text("status").notNull().default("active"), // active | ended
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPollSchema = createInsertSchema(pollsTable).omit({ id: true, createdAt: true });
export type InsertPoll = z.infer<typeof insertPollSchema>;
export type Poll = typeof pollsTable.$inferSelect;
