import { pgTable, uuid, text, numeric, boolean, date, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";
import { peptideCatalogTable } from "./peptide-catalog";

export const cyclesTable = pgTable("cycles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  peptideCatalogId: uuid("peptide_catalog_id").references(() => peptideCatalogTable.id, { onDelete: "set null" }),
  customCompoundName: text("custom_compound_name"),
  cycleName: text("cycle_name"),
  vialAmount: numeric("vial_amount", { precision: 10, scale: 4 }).notNull(),
  vialUnit: text("vial_unit").notNull(), // mg | mcg | IU
  bacWaterMl: numeric("bac_water_ml", { precision: 10, scale: 4 }).notNull(),
  desiredDose: numeric("desired_dose", { precision: 10, scale: 4 }).notNull(),
  doseUnit: text("dose_unit").notNull(), // mcg | mg | IU
  calculatedVolumeMl: numeric("calculated_volume_ml", { precision: 10, scale: 6 }).notNull(),
  calculatedSyringeUnits: numeric("calculated_syringe_units", { precision: 10, scale: 2 }).notNull(),
  syringeCapacityMl: numeric("syringe_capacity_ml", { precision: 4, scale: 2 }).notNull().default("1.0"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  durationWeeks: integer("duration_weeks"),
  ongoing: boolean("ongoing").notNull().default(false),
  status: text("status").notNull().default("active"), // active | paused | archived | completed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCycleSchema = createInsertSchema(cyclesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCycle = z.infer<typeof insertCycleSchema>;
export type Cycle = typeof cyclesTable.$inferSelect;
