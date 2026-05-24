import type { APIRoute } from "astro";
import { verifySession } from "@/shared/auth";
import { SESSION_SECRET, ADMIN_ID } from "@/env";
import { getAllEntities, getUserEntities } from "@/db";

export const GET: APIRoute = async ({ cookies }) => {
  const sessionCookie = cookies.get("session")?.value;
  if (!sessionCookie) {
    return new Response(JSON.stringify({ authenticated: false }), { status: 200 });
  }

  const session = verifySession(sessionCookie, SESSION_SECRET);
  if (!session) {
    return new Response(JSON.stringify({ authenticated: false }), { status: 200 });
  }

  const allEntities = await getAllEntities();

  // Admin sees all entities, regular users see only their permitted ones
  let allowedEntities;
  if (session.userId === ADMIN_ID) {
    allowedEntities = allEntities;
  } else {
    const userEntities = await getUserEntities(session.userId);
    const userEntityIds = new Set(userEntities.map((ue: any) => ue.entityId));
    allowedEntities = allEntities.filter((e) => userEntityIds.has(e.id));
  }

  return new Response(
    JSON.stringify({
      authenticated: true,
      userId: session.userId,
      entities: allowedEntities.map((e) => ({ name: e.name, entity_id: e.entity_id })),
    }),
    { status: 200 }
  );
};
