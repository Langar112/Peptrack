import { pgTable, uuid, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";
import { cyclesTable } from "./cycles";
import { injectionEventsTable } from "./injection-events";

export const journalEntriesTable = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  cycleId: uuid("cycle_id").references(() => cyclesTable.id, { onDelete: "set null" }),
  injectionEventId: uuid("injection_event_id").references(() => injectionEventsTable.id, { onDelete: "set null" }),
  // entry_type: general_note | dose_change | observation
  entryType: text("entry_type").notNull(),
  entryDate: timestamp("entry_date").notNull(),
  body: text("body"),
  previousDose: text("previous_dose"),
  newDose: text("new_dose"),
  doseUnit: text("dose_unit"),
  previousSyringeUnits: text("previous_syringe_units"),
  newSyringeUnits: text("new_syringe_units"),
  intensityRating: integer("intensity_rating"), // 1-10 for observations
  tags: jsonb("tags").$type<string[]>(), // ["energy","sleep","mood"]
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertJournalEntrySchema = createInsertSchema(journalEntriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type JournalEntry = typeof journalEntriesTable.$inferSelect;
