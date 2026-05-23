import { eq } from "drizzle-orm";
import { db, configTable } from "./connection";

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
