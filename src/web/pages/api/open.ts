import type { APIRoute } from "astro";
import { verifySession } from "@/shared/auth";
import { SESSION_SECRET, ADMIN_ID } from "@/env";
import { getAllEntities, getUserEntities, logAccess } from "@/db";
import { callEntityAction } from "@/homeassistant";

export const POST: APIRoute = async ({ request, cookies }) => {
  const sessionCookie = cookies.get("session")?.value;
  if (!sessionCookie) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
  }

  const session = verifySession(sessionCookie, SESSION_SECRET);
  if (!session) {
    return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401 });
  }

  const body = await request.json();
  const { entity_id } = body;
  if (!entity_id) {
    return new Response(JSON.stringify({ error: "entity_id required" }), { status: 400 });
  }

  const entities = await getAllEntities();
  const entity = entities.find((e) => e.entity_id === entity_id);
  if (!entity) {
    return new Response(JSON.stringify({ error: "Entity not found" }), { status: 404 });
  }

  // Check if user has access to this entity (admin always has access)
  if (session.userId !== ADMIN_ID) {
    const userEntities = await getUserEntities(session.userId);
    const hasAccess = userEntities.some((ue: any) => ue.entityId === entity.id);
    if (!hasAccess) {
      await logAccess({ userId: session.userId, entityId: entity_id, success: false });
      return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 });
    }
  }

  const result = await callEntityAction(entity_id, entity.domain, entity.service);
  await logAccess({ userId: session.userId, entityId: entity_id, success: result.success });

  return new Response(JSON.stringify(result), { status: result.success ? 200 : 500 });
};
