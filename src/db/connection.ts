import { sql, eq } from "drizzle-orm";
import type { Dialect, NowSql } from "./types";
import { DATABASE_PROVIDER, DATABASE_URL, ADMIN_ID } from "@/env";

type DrizzleDb = Awaited<ReturnType<typeof createDb>>;

let db: DrizzleDb;
export let provider: Dialect;
export let users: any;
export let entitiesTable: any;
export let userEntitiesTable: any;
export let configTable: any;
export let pinsTable: any;
export let accessLogTable: any;
export let nowSql: NowSql;

async function createDb(prov: Dialect, url: string) {
  if (prov === "postgres") {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url });
    await pool.connect();
    return drizzle(pool);
  }
  const { drizzle } = await import("drizzle-orm/bun-sqlite");
  const { Database } = await import("bun:sqlite");
  const sqlite = new Database(url);
  sqlite.run("PRAGMA journal_mode = WAL;");
  return drizzle(sqlite);
}

async function loadSchema(prov: Dialect) {
  if (prov === "postgres") {
    const mod = await import("./schema-pg");
    return { users: mod.users, entities: mod.entities, userEntities: mod.userEntities, config: mod.config, pins: mod.pins, accessLog: mod.accessLog };
  }
  const mod = await import("./schema-sqlite");
  return { users: mod.users, entities: mod.entities, userEntities: mod.userEntities, config: mod.config, pins: mod.pins, accessLog: mod.accessLog };
}

async function init() {
  const prov = (DATABASE_PROVIDER || "sqlite") as Dialect;
  const url = DATABASE_URL || "bot.sqlite";

  provider = prov;
  db = await createDb(prov, url);
  const schema = await loadSchema(prov);
  users = schema.users;
  entitiesTable = schema.entities;
  userEntitiesTable = schema.userEntities;
  configTable = schema.config;
  pinsTable = schema.pins;
  accessLogTable = schema.accessLog;

  if (prov === "postgres") {
    nowSql = sql`TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')`;
  } else {
    nowSql = sql`datetime('now')`;
  }

  // ── Auto-create tables ──
  if (prov === "sqlite") {
    db.run(sql`CREATE TABLE IF NOT EXISTS users (
      telegram_id INTEGER PRIMARY KEY,
      first_name TEXT,
      username TEXT,
      permission_status TEXT NOT NULL DEFAULT 'pending',
      access_expires_at TEXT,
      can_portal INTEGER NOT NULL DEFAULT 1,
      can_casa INTEGER NOT NULL DEFAULT 1,
      language_code TEXT NOT NULL DEFAULT 'es',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    db.run(sql`CREATE TABLE IF NOT EXISTS entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      entity_id TEXT NOT NULL UNIQUE,
      domain TEXT NOT NULL,
      service TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    db.run(sql`CREATE TABLE IF NOT EXISTS user_entities (
      user_id INTEGER NOT NULL,
      entity_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, entity_id)
    )`);
    db.run(sql`CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`);
    db.run(sql`CREATE TABLE IF NOT EXISTS pins (
      user_id INTEGER NOT NULL UNIQUE,
      pin_hash TEXT NOT NULL,
      label TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    db.run(sql`CREATE TABLE IF NOT EXISTS access_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      pin_hash TEXT,
      entity_id TEXT NOT NULL,
      success INTEGER NOT NULL,
      ip TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    try { db.run(sql`ALTER TABLE users ADD COLUMN language_code TEXT NOT NULL DEFAULT 'es'`); } catch {}
  } else {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS users (
      telegram_id INTEGER PRIMARY KEY,
      first_name TEXT,
      username TEXT,
      permission_status TEXT NOT NULL DEFAULT 'pending',
      access_expires_at TEXT,
      can_portal INTEGER NOT NULL DEFAULT 1,
      can_casa INTEGER NOT NULL DEFAULT 1,
      language_code TEXT NOT NULL DEFAULT 'es',
      created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
      updated_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS entities (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      entity_id TEXT NOT NULL UNIQUE,
      domain TEXT NOT NULL,
      service TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS user_entities (
      user_id INTEGER NOT NULL,
      entity_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, entity_id)
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS pins (
      user_id INTEGER NOT NULL UNIQUE,
      pin_hash TEXT NOT NULL,
      label TEXT,
      created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS access_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      pin_hash TEXT,
      entity_id TEXT NOT NULL,
      success INTEGER NOT NULL,
      ip TEXT,
      created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
    )`);
  }

  // ── Migrate legacy can_portal / can_casa data ──
  const existing = await db.select().from(entitiesTable).limit(1);
  if (existing.length === 0) {
    await db.insert(entitiesTable).values([
      { name: "Portal", entityId: "button.entrada_principal_abrir_puerta", domain: "button", service: "press", createdAt: nowSql },
      { name: "Casa", entityId: "lock.lock_pro_bcf7", domain: "lock", service: "open", createdAt: nowSql },
    ]);
    const legacyUsers = await db.select().from(users).where(eq(users.canPortal, 1));
    const defaultEntities = await db.select().from(entitiesTable);
    const portalEntity = defaultEntities.find((e: any) => e.domain === "button");
    const casaEntity = defaultEntities.find((e: any) => e.domain === "lock");
    for (const u of legacyUsers) {
      const entries: any[] = [];
      if (u.canPortal && portalEntity) entries.push({ userId: u.telegramId, entityId: portalEntity.id });
      if (u.canCasa && casaEntity) entries.push({ userId: u.telegramId, entityId: casaEntity.id });
      if (entries.length) await db.insert(userEntitiesTable).values(entries);
    }
  }

  // ── Config defaults ──
  const cfg = await db.select().from(configTable).where(eq(configTable.key, "receive_requests")).limit(1);
  if (cfg.length === 0) {
    await db.insert(configTable).values({ key: "receive_requests", value: "0" });
  }

  // ── Ensure admin user exists in DB ──
  const adminId = Number(ADMIN_ID);
  if (adminId) {
    const rows = await db.select().from(users).where(eq(users.telegramId, adminId)).limit(1);
    if (rows.length === 0) {
      await db.insert(users).values({
        telegramId: adminId,
        firstName: "Admin",
        permissionStatus: "allowed",
        languageCode: "en",
        createdAt: nowSql,
        updatedAt: nowSql,
      });
    }
  }

  console.log(`🗄️  Database: ${prov} — ${url}`);
}

await init();

export { db };
