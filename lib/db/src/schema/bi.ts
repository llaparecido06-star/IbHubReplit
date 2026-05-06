import { pgTable, text, integer, bigint, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const biImportadoresTable = pgTable("bi_importadores", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  pais: text("pais").notNull(),
  segmentos: text("segmentos").notNull(),
  estado: text("estado").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBiImportadorSchema = createInsertSchema(biImportadoresTable).omit({ id: true, createdAt: true });
export type InsertBiImportador = z.infer<typeof insertBiImportadorSchema>;
export type BiImportador = typeof biImportadoresTable.$inferSelect;

export const biExportadoresTable = pgTable("bi_exportadores", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  paisDestino: text("pais_destino").notNull(),
  produtos: text("produtos").notNull(),
  caixasExportadas: integer("caixas_exportadas").notNull().default(0),
  valorVendidoCents: bigint("valor_vendido_cents", { mode: "number" }).notNull().default(0),
  precoMedioCents: integer("preco_medio_cents").notNull().default(0),
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
  tipos: text("tipos").notNull(),
  fundado: integer("fundado"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBiProdutorSchema = createInsertSchema(biProdutoresTable).omit({ id: true, createdAt: true });
export type InsertBiProdutor = z.infer<typeof insertBiProdutorSchema>;
export type BiProdutor = typeof biProdutoresTable.$inferSelect;
