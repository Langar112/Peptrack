import { pgTable, uuid, text, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const peptideCatalogTable = pgTable("peptide_catalog", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  active: boolean("active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
});

export const insertPeptideCatalogSchema = createInsertSchema(peptideCatalogTable).omit({ id: true });
export type PeptideCatalog = typeof peptideCatalogTable.$inferSelect;
