import { eq } from "drizzle-orm";
import { db, pinsTable } from "./connection";

export interface PinRow {
  userId: number;
  pinHash: string;
  label: string | null;
  createdAt: string;
}

export async function getPinByUserId(userId: number): Promise<PinRow | null> {
  const rows = await db.select().from(pinsTable).where(eq(pinsTable.userId, userId)).limit(1);
  return rows.length ? rows[0] : null;
}

export async function setPin(userId: number, pinHash: string, label?: string): Promise<void> {
  const existing = await getPinByUserId(userId);
  if (existing) {
    await db.update(pinsTable).set({ pinHash, label: label ?? null }).where(eq(pinsTable.userId, userId));
  } else {
    await db.insert(pinsTable).values({ userId, pinHash, label: label ?? null });
  }
}

export async function removePin(userId: number): Promise<void> {
  await db.delete(pinsTable).where(eq(pinsTable.userId, userId));
}

export async function getAllPins(): Promise<PinRow[]> {
  return await db.select().from(pinsTable);
}
