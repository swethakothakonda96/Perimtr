import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const attendeesTable = pgTable("attendees", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  name: text("name").notNull(),
  deviceToken: text("device_token").notNull(),
  ipAddress: text("ip_address"),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAttendeeSchema = createInsertSchema(attendeesTable).omit({ id: true, checkedInAt: true });
export type InsertAttendee = z.infer<typeof insertAttendeeSchema>;
export type Attendee = typeof attendeesTable.$inferSelect;
