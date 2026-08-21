import { pgTable, uuid, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { cyclesTable } from "./cycles";
import { usersTable } from "./users";

export const cycleChangeHistoryTable = pgTable("cycle_change_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  cycleId: uuid("cycle_id").notNull().references(() => cyclesTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  fieldChanged: text("field_changed").notNull(),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  effectiveDate: date("effective_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCycleChangeHistorySchema = createInsertSchema(cycleChangeHistoryTable).omit({
  id: true,
  createdAt: true,
});
export type CycleChangeHistory = typeof cycleChangeHistoryTable.$inferSelect;
