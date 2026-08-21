import { pgTable, uuid, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { cyclesTable } from "./cycles";

export const scheduleRulesTable = pgTable("schedule_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  cycleId: uuid("cycle_id").notNull().references(() => cyclesTable.id, { onDelete: "cascade" }),
  // frequency_type: daily | specific_days | times_per_week | every_x_days
  frequencyType: text("frequency_type").notNull(),
  injectionsPerWeek: integer("injections_per_week"),
  daysOfWeek: jsonb("days_of_week").$type<string[]>(), // ["monday","wednesday","friday"]
  intervalDays: integer("interval_days"),
  injectionTimes: jsonb("injection_times").$type<string[]>(), // ["08:00","20:00"] or ["any"]
  timezone: text("timezone").notNull().default("UTC"),
  effectiveFrom: text("effective_from"), // date string, for tracking rule changes
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertScheduleRuleSchema = createInsertSchema(scheduleRulesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ScheduleRule = typeof scheduleRulesTable.$inferSelect;
