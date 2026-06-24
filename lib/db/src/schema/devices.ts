import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const devicesTable = pgTable("devices", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  fingerprint: text("fingerprint").notNull(),
  userAgent: text("user_agent"),
  platform: text("platform"),
  screenResolution: text("screen_resolution"),
  timezone: text("timezone"),
  hardwareConcurrency: integer("hardware_concurrency"),
  deviceMemory: text("device_memory"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lockoutsTable = pgTable("lockouts", {
  id: serial("id").primaryKey(),
  deviceToken: text("device_token").notNull(),
  sessionId: integer("session_id").notNull(),
  attempts: integer("attempts").notNull().default(0),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDeviceSchema = createInsertSchema(devicesTable).omit({ id: true, createdAt: true });
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devicesTable.$inferSelect;

export const insertLockoutSchema = createInsertSchema(lockoutsTable).omit({ id: true, updatedAt: true });
export type InsertLockout = z.infer<typeof insertLockoutSchema>;
export type Lockout = typeof lockoutsTable.$inferSelect;
