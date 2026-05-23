import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  telegramId: integer("telegram_id").primaryKey(),
  firstName: text("first_name"),
  username: text("username"),
  permissionStatus: text("permission_status").notNull().default("pending"),
  accessExpiresAt: text("access_expires_at"),
  canPortal: integer("can_portal").notNull().default(1),
  canCasa: integer("can_casa").notNull().default(1),
  languageCode: text("language_code").notNull().default("es"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const entities = sqliteTable("entities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  entityId: text("entity_id").notNull().unique(),
  domain: text("domain").notNull(),
  service: text("service").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const config = sqliteTable("config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const userEntities = sqliteTable("user_entities", {
  userId: integer("user_id").notNull(),
  entityId: integer("entity_id").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.entityId] }),
}));
