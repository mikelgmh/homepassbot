import { desc, eq } from "drizzle-orm";
import { db, accessLogTable } from "./connection";

export interface AccessLogRow {
  id: number;
  userId: number | null;
  pinHash: string | null;
  entityId: string;
  success: number;
  ip: string | null;
  createdAt: string;
}

export async function logAccess(params: {
  userId?: number | null;
  pinHash?: string | null;
  entityId: string;
  success: boolean;
  ip?: string | null;
}): Promise<void> {
  await db.insert(accessLogTable).values({
    userId: params.userId ?? null,
    pinHash: params.pinHash ?? null,
    entityId: params.entityId,
    success: params.success ? 1 : 0,
    ip: params.ip ?? null,
  });
}

export async function getRecentLogs(limit: number = 50): Promise<AccessLogRow[]> {
  return await db.select().from(accessLogTable).orderBy(desc(accessLogTable.createdAt)).limit(limit);
}
