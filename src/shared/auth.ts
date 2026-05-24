import { createHash, timingSafeEqual } from "crypto";
import { getConfig, setConfig, getUser, getAllPins } from "@/db";
import { getPinByUserId, setPin as dbSetPin, removePin as dbRemovePin } from "@/db/pins";

export interface PinSession {
  userId: number;
  expiresAt: number;
}

const SESSION_TTL = 60 * 60 * 1000; // 1 hour

function hashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

function sign(data: string, secret: string): string {
  return createHash("sha256").update(data + secret).digest("hex");
}

export async function setPin(userId: number, pin: string, label?: string): Promise<void> {
  const h = hashPin(pin);
  await dbSetPin(userId, h, label);
}

export async function validatePin(userId: number, pin: string): Promise<boolean> {
  const row = await getPinByUserId(userId);
  if (!row) return false;
  const inputHash = hashPin(pin);
  if (inputHash.length !== row.pinHash.length) return false;
  return timingSafeEqual(Buffer.from(inputHash), Buffer.from(row.pinHash));
}

export async function removePin(userId: number): Promise<void> {
  await dbRemovePin(userId);
}

export function createSession(userId: number, secret: string): string {
  const data = `${userId}:${Date.now() + SESSION_TTL}`;
  const sig = sign(data, secret);
  return `${data}:${sig}`;
}

export function verifySession(token: string, secret: string): PinSession | null {
  const parts = token.split(":");
  if (parts.length !== 3) return null;
  const [userIdStr, expiresAtStr, sig] = parts;
  const data = `${userIdStr}:${expiresAtStr}`;
  const expected = sign(data, secret);
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const expiresAt = parseInt(expiresAtStr);
  if (Date.now() > expiresAt) return null;
  return { userId: parseInt(userIdStr), expiresAt };
}

export async function getUserIdByPin(pin: string): Promise<number | null> {
  const h = hashPin(pin);
  const rows = await getAllPins();
  for (const row of rows) {
    const currentHash = row.pinHash;
    if (currentHash.length !== h.length) continue;
    if (timingSafeEqual(Buffer.from(currentHash), Buffer.from(h))) return row.userId;
  }
  return null;
}
