import { getConfig, getUser } from "@/db";
import { callEntityAction } from "@/homeassistant";
import type { Entity } from "@/db/types";

export interface AccessResult {
  success: boolean;
  error?: string;
}

export async function checkPermission(userId: number): Promise<{ allowed: boolean; reason?: string }> {
  if (userId === parseInt(process.env.ADMIN_ID ?? "0")) return { allowed: true };
  const user = await getUser(userId);
  if (!user) return { allowed: false, reason: "User not found" };
  if (user.permission_status !== "allowed") return { allowed: false, reason: `Status: ${user.permission_status}` };
  if (user.access_expires_at && new Date(user.access_expires_at) <= new Date()) {
    return { allowed: false, reason: "Expired" };
  }
  return { allowed: true };
}

export async function openEntity(userId: number, entity: Entity): Promise<AccessResult> {
  const perm = await checkPermission(userId);
  if (!perm.allowed) return { success: false, error: perm.reason };

  const result = await callEntityAction(entity.entity_id, entity.domain, entity.service);
  return result;
}
