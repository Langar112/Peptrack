import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";
import { cyclesTable } from "./cycles";

export const injectionEventsTable = pgTable("injection_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  cycleId: uuid("cycle_id").notNull().references(() => cyclesTable.id, { onDelete: "cascade" }),
  scheduledAt: timestamp("scheduled_at").notNull(),
  plannedDose: numeric("planned_dose", { precision: 10, scale: 4 }).notNull(),
  plannedDoseUnit: text("planned_dose_unit").notNull(),
  plannedVolumeMl: numeric("planned_volume_ml", { precision: 10, scale: 6 }).notNull(),
  plannedSyringeUnits: numeric("planned_syringe_units", { precision: 10, scale: 2 }).notNull(),
  actualDose: numeric("actual_dose", { precision: 10, scale: 4 }),
  actualDoseUnit: text("actual_dose_unit"),
  actualVolumeMl: numeric("actual_volume_ml", { precision: 10, scale: 6 }),
  actualSyringeUnits: numeric("actual_syringe_units", { precision: 10, scale: 2 }),
  // status: scheduled | completed | skipped | missed
  status: text("status").notNull().default("scheduled"),
  injectionSite: text("injection_site"), // abdomen | thigh | arm | glute | other
  note: text("note"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertInjectionEventSchema = createInsertSchema(injectionEventsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInjectionEvent = z.infer<typeof insertInjectionEventSchema>;
export type InjectionEvent = typeof injectionEventsTable.$inferSelect;
