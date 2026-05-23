import { sql, eq, and, lt, isNotNull, asc, inArray } from "drizzle-orm";

export interface User {
  telegram_id: number;
  first_name: string | null;
  username: string | null;
  permission_status: string;
  access_expires_at: string | null;
  can_portal: number;
  can_casa: number;
  language_code: string;
  created_at: string;
  updated_at: string;
}

export interface Entity {
  id: number;
  name: string;
  entity_id: string;
  domain: string;
  service: string;
  created_at: string;
}

export interface UserEntity {
  user_id: number;
  entity_id: number;
}

type Dialect = "sqlite" | "postgres";
type DrizzleDb = Awaited<ReturnType<typeof createDb>>;

let db: DrizzleDb;
let provider: Dialect;
let users: any;
let entitiesTable: any;
let userEntitiesTable: any;
let configTable: any;
let nowSql: ReturnType<typeof sql>;

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
    const mod = await import("./pg-schema");
    return { users: mod.users, entities: mod.entities, userEntities: mod.userEntities, config: mod.config };
  }
  const mod = await import("./sqlite-schema");
  return { users: mod.users, entities: mod.entities, userEntities: mod.userEntities, config: mod.config };
}

provider = (process.env.DATABASE_PROVIDER || "sqlite") as Dialect;
const url = process.env.DATABASE_URL || "bot.sqlite";

db = await createDb(provider, url);
const schema = await loadSchema(provider);
users = schema.users;
entitiesTable = schema.entities;
userEntitiesTable = schema.userEntities;
configTable = schema.config;

if (provider === "postgres") {
  nowSql = sql`TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')`;
} else {
  nowSql = sql`datetime('now')`;
}

// ── Auto-create tables ──

if (provider === "sqlite") {
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
  try { db.run(sql`ALTER TABLE users ADD COLUMN language_code TEXT NOT NULL DEFAULT 'es'`); } catch {}
} else if (provider === "postgres") {
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
}

// ── Migrate legacy can_portal / can_casa data ──

async function migrateLegacyPermissions() {
  const existing = await db.select().from(entitiesTable).limit(1);
  if (existing.length > 0) return;

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

await migrateLegacyPermissions();

// ── Config defaults ──

async function initConfig() {
  const existing = await db.select().from(configTable).where(eq(configTable.key, "receive_requests")).limit(1);
  if (existing.length === 0) {
    await db.insert(configTable).values({ key: "receive_requests", value: "0" });
  }
}
await initConfig();

// ── Ensure admin user exists in DB ──

const adminId = Number(process.env.ADMIN_ID);
if (adminId) {
  const admin = await getUser(adminId);
  if (!admin) {
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

console.log(`🗄️  Database: ${provider} — ${url}`);

// ── Row mapping ──

function rowToUser(row: any): User {
  return {
    telegram_id: row.telegramId,
    first_name: row.firstName,
    username: row.username,
    permission_status: row.permissionStatus,
    access_expires_at: row.accessExpiresAt,
    can_portal: row.canPortal,
    can_casa: row.canCasa,
    language_code: row.languageCode,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function rowToEntity(row: any): Entity {
  return {
    id: row.id,
    name: row.name,
    entity_id: row.entityId,
    domain: row.domain,
    service: row.service,
    created_at: row.createdAt,
  };
}

// ── User functions ──

export async function getUser(id: number): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.telegramId, id)).limit(1);
  return rows.length ? rowToUser(rows[0]) : null;
}

export async function getAllUsers(): Promise<User[]> {
  const rows = await db.select().from(users).orderBy(asc(users.telegramId));
  return rows.map(rowToUser);
}

export async function getUsersByStatus(status: string): Promise<User[]> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.permissionStatus, status))
    .orderBy(asc(users.telegramId));
  return rows.map(rowToUser);
}

export async function createUser(id: number, firstName: string | null, username: string | null, languageCode: string = "en"): Promise<void> {
  const existing = await getUser(id);
  if (existing) return;

  await db.insert(users).values({
    telegramId: id,
    firstName: firstName,
    username: username,
    permissionStatus: "pending",
    languageCode: languageCode,
    createdAt: nowSql,
    updatedAt: nowSql,
  });
}

export async function approveUser(id: number, expiresAt: string | null): Promise<void> {
  await db
    .update(users)
    .set({
      permissionStatus: "allowed",
      accessExpiresAt: expiresAt,
      updatedAt: nowSql,
    })
    .where(eq(users.telegramId, id));
}

export async function updateExpiration(id: number, expiresAt: string | null): Promise<void> {
  await db
    .update(users)
    .set({
      accessExpiresAt: expiresAt,
      updatedAt: nowSql,
    })
    .where(eq(users.telegramId, id));
}

export async function denyUser(id: number): Promise<void> {
  await db
    .update(users)
    .set({
      permissionStatus: "denied",
      accessExpiresAt: null,
      updatedAt: nowSql,
    })
    .where(eq(users.telegramId, id));
}

export async function resetUser(id: number): Promise<void> {
  await db.delete(userEntitiesTable).where(eq(userEntitiesTable.userId, id));
  await db.delete(users).where(eq(users.telegramId, id));
}

export async function getExpiredUsers(): Promise<User[]> {
  let condition;
  if (provider === "postgres") {
    condition = lt(users.accessExpiresAt, sql`TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')`);
  } else {
    condition = lt(sql`REPLACE(${users.accessExpiresAt}, 'T', ' ')`, sql`datetime('now')`);
  }

  const rows = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.permissionStatus, "allowed"),
        isNotNull(users.accessExpiresAt),
        condition,
      ),
    );
  return rows.map(rowToUser);
}

export async function expireUser(id: number): Promise<void> {
  await db
    .update(users)
    .set({
      permissionStatus: "pending",
      accessExpiresAt: null,
      updatedAt: nowSql,
    })
    .where(eq(users.telegramId, id));
}

export async function setUserLanguage(id: number, lang: string): Promise<void> {
  await db
    .update(users)
    .set({ languageCode: lang, updatedAt: nowSql })
    .where(eq(users.telegramId, id));
}

export async function getUserLanguage(id: number): Promise<string> {
  const user = await getUser(id);
  return user?.language_code ?? "en";
}

// ── Entity functions ──

export async function getAllEntities(): Promise<Entity[]> {
  const rows = await db.select().from(entitiesTable).orderBy(asc(entitiesTable.id));
  return rows.map(rowToEntity);
}

export async function getEntity(id: number): Promise<Entity | null> {
  const rows = await db.select().from(entitiesTable).where(eq(entitiesTable.id, id)).limit(1);
  return rows.length ? rowToEntity(rows[0]) : null;
}

export async function createEntity(name: string, entityId: string, domain: string, service: string): Promise<Entity> {
  await db.insert(entitiesTable).values({
    name, entityId, domain, service, createdAt: nowSql,
  });
  const rows = await db.select().from(entitiesTable).where(eq(entitiesTable.entityId, entityId)).limit(1);
  return rowToEntity(rows[0]);
}

export async function updateEntityName(id: number, name: string): Promise<void> {
  await db.update(entitiesTable).set({ name }).where(eq(entitiesTable.id, id));
}

export async function deleteEntity(id: number): Promise<void> {
  await db.delete(userEntitiesTable).where(eq(userEntitiesTable.entityId, id));
  await db.delete(entitiesTable).where(eq(entitiesTable.id, id));
}

// ── User-Entity permission functions ──

export async function getUserEntities(userId: number): Promise<Entity[]> {
  const rows = await db
    .select({
      id: entitiesTable.id,
      name: entitiesTable.name,
      entityId: entitiesTable.entityId,
      domain: entitiesTable.domain,
      service: entitiesTable.service,
      createdAt: entitiesTable.createdAt,
    })
    .from(userEntitiesTable)
    .innerJoin(entitiesTable, eq(userEntitiesTable.entityId, entitiesTable.id))
    .where(eq(userEntitiesTable.userId, userId));
  return rows.map(rowToEntity);
}

export async function grantUserEntity(userId: number, entityId: number): Promise<void> {
  const existing = await db
    .select()
    .from(userEntitiesTable)
    .where(and(eq(userEntitiesTable.userId, userId), eq(userEntitiesTable.entityId, entityId)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(userEntitiesTable).values({ userId, entityId });
  }
}

export async function revokeUserEntity(userId: number, entityId: number): Promise<void> {
  await db.delete(userEntitiesTable).where(
    and(eq(userEntitiesTable.userId, userId), eq(userEntitiesTable.entityId, entityId)),
  );
}

export async function setUserEntities(userId: number, entityIds: number[]): Promise<void> {
  await db.delete(userEntitiesTable).where(eq(userEntitiesTable.userId, userId));
  if (entityIds.length > 0) {
    await db.insert(userEntitiesTable).values(entityIds.map((entityId) => ({ userId, entityId })));
  }
}

// ── Config functions ──

export async function getConfig(key: string): Promise<string | null> {
  const rows = await db.select().from(configTable).where(eq(configTable.key, key)).limit(1);
  return rows.length ? rows[0].value : null;
}

export async function setConfig(key: string, value: string): Promise<void> {
  const existing = await db.select().from(configTable).where(eq(configTable.key, key)).limit(1);
  if (existing.length > 0) {
    await db.update(configTable).set({ value }).where(eq(configTable.key, key));
  } else {
    await db.insert(configTable).values({ key, value });
  }
}

export async function getReceiveRequests(): Promise<boolean> {
  const val = await getConfig("receive_requests");
  return val === "1";
}

export async function setReceiveRequests(enabled: boolean): Promise<void> {
  await setConfig("receive_requests", enabled ? "1" : "0");
}
