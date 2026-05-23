import { eq, asc } from "drizzle-orm";
import { db, entitiesTable, nowSql } from "./connection";
import type { Entity } from "./types";

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

export async function getAllEntities(): Promise<Entity[]> {
  const rows = await db.select().from(entitiesTable).orderBy(asc(entitiesTable.id));
  return rows.map(rowToEntity);
}

export async function getEntity(id: number): Promise<Entity | null> {
  const rows = await db.select().from(entitiesTable).where(eq(entitiesTable.id, id)).limit(1);
  return rows.length ? rowToEntity(rows[0]) : null;
}

export async function createEntity(name: string, entityId: string, domain: string, service: string): Promise<Entity> {
  await db.insert(entitiesTable).values({ name, entityId, domain, service, createdAt: nowSql });
  const rows = await db.select().from(entitiesTable).where(eq(entitiesTable.entityId, entityId)).limit(1);
  return rowToEntity(rows[0]);
}

export async function updateEntityName(id: number, name: string): Promise<void> {
  await db.update(entitiesTable).set({ name }).where(eq(entitiesTable.id, id));
}

export async function deleteEntity(id: number): Promise<void> {
  const { userEntitiesTable } = await import("./connection");
  await db.delete(userEntitiesTable).where(eq(userEntitiesTable.entityId, id));
  await db.delete(entitiesTable).where(eq(entitiesTable.id, id));
}
