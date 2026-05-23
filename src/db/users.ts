import { sql, eq, lt, isNotNull, and, asc } from "drizzle-orm";
import { db, users, nowSql, provider } from "./connection";
import type { User } from "./types";

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
    .set({ permissionStatus: "allowed", accessExpiresAt: expiresAt, updatedAt: nowSql })
    .where(eq(users.telegramId, id));
}

export async function updateExpiration(id: number, expiresAt: string | null): Promise<void> {
  await db
    .update(users)
    .set({ accessExpiresAt: expiresAt, updatedAt: nowSql })
    .where(eq(users.telegramId, id));
}

export async function denyUser(id: number): Promise<void> {
  await db
    .update(users)
    .set({ permissionStatus: "denied", accessExpiresAt: null, updatedAt: nowSql })
    .where(eq(users.telegramId, id));
}

export async function resetUser(id: number): Promise<void> {
  const { userEntitiesTable } = await import("./connection");
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
    .where(and(eq(users.permissionStatus, "allowed"), isNotNull(users.accessExpiresAt), condition));
  return rows.map(rowToUser);
}

export async function expireUser(id: number): Promise<void> {
  await db
    .update(users)
    .set({ permissionStatus: "pending", accessExpiresAt: null, updatedAt: nowSql })
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
