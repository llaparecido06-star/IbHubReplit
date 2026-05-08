import { pgTable, text, integer, uuid, timestamp, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const biImportadoresTable = pgTable("bi_importadores", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  pais: text("pais").notNull(),
  segmentos: text("segmentos").notNull(),
  exportador: text("exportador"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertBiImportadorSchema = createInsertSchema(biImportadoresTable).omit({ id: true, createdAt: true });
export type InsertBiImportador = z.infer<typeof insertBiImportadorSchema>;
export type BiImportador = typeof biImportadoresTable.$inferSelect;

export const biExportadoresTable = pgTable("bi_exportadores", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  origemExportador: text("origem_exportador").notNull().default(""),
  distribuidor: text("distribuidor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertBiExportadorSchema = createInsertSchema(biExportadoresTable).omit({ id: true, createdAt: true });
export type InsertBiExportador = z.infer<typeof insertBiExportadorSchema>;
export type BiExportador = typeof biExportadoresTable.$inferSelect;

export const biProdutoresTable = pgTable("bi_produtores", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  nameFantasia: text("name_fantasia"),
  regiao: text("regiao").notNull(),
  estado: text("estado"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertBiProdutorSchema = createInsertSchema(biProdutoresTable).omit({ id: true, createdAt: true });
export type InsertBiProdutor = z.infer<typeof insertBiProdutorSchema>;
export type BiProdutor = typeof biProdutoresTable.$inferSelect;

export const wineImportsTable = pgTable("wine_imports", {
  id: uuid("id").primaryKey().defaultRandom(),
  marcaCompleta: text("marca_completa"),
  marcaRelatorio: text("marca_relatorio"),
  paisDeOrigem: text("pais_de_origem"),
  distribuidor: text("distribuidor"),
  exportador: text("exportador"),
  importador: text("importador"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertWineImportSchema = createInsertSchema(wineImportsTable).omit({ id: true, createdAt: true });
export type InsertWineImport = z.infer<typeof insertWineImportSchema>;
export type WineImport = typeof wineImportsTable.$inferSelect;

export const biExportadoresFinanceiroTable = pgTable("bi_exportadores_financeiro", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  fobUsd: numeric("fob_usd", { precision: 15, scale: 2 }),
  cx9l: numeric("cx9l", { precision: 12, scale: 2 }),
  usdPorCx9l: numeric("usd_por_cx9l", { precision: 10, scale: 2 }),
  periodo: text("periodo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertBiExportadorFinanceiroSchema = createInsertSchema(biExportadoresFinanceiroTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBiExportadorFinanceiro = z.infer<typeof insertBiExportadorFinanceiroSchema>;
export type BiExportadorFinanceiro = typeof biExportadoresFinanceiroTable.$inferSelect;

export const biRevealCreditsTable = pgTable("bi_reveal_credits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  creditsRemaining: integer("credits_remaining").notNull().default(0),
  creditsTotal: integer("credits_total").notNull().default(0),
  periodStart: date("period_start").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
