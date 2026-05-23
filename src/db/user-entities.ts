import { eq, and } from "drizzle-orm";
import { db, users, entitiesTable, userEntitiesTable } from "./connection";
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
