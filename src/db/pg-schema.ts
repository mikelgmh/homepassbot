import { pgTable, text, integer, serial, primaryKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  telegramId: integer("telegram_id").primaryKey(),
  firstName: text("first_name"),
  username: text("username"),
  permissionStatus: text("permission_status").notNull().default("pending"),
  accessExpiresAt: text("access_expires_at"),
  canPortal: integer("can_portal").notNull().default(1),
  canCasa: integer("can_casa").notNull().default(1),
  languageCode: text("language_code").notNull().default("es"),
  createdAt: text("created_at").notNull().default(sql`TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')`),
  updatedAt: text("updated_at").notNull().default(sql`TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')`),
});

export const entities = pgTable("entities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  entityId: text("entity_id").notNull().unique(),
  domain: text("domain").notNull(),
  service: text("service").notNull(),
  createdAt: text("created_at").notNull().default(sql`TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')`),
});

export const config = pgTable("config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const userEntities = pgTable("user_entities", {
  userId: integer("user_id").notNull(),
  entityId: integer("entity_id").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.entityId] }),
}));
