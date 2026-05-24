import type { APIRoute } from "astro";
import { getUserIdByPin, createSession, verifySession } from "@/shared/auth";
import { logAccess } from "@/db";
import { SESSION_SECRET } from "@/env";
import { createRateLimiter } from "@/shared/rate-limit";

const limiter = createRateLimiter(5, 60_000);

export const POST: APIRoute = async ({ request, cookies }) => {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const rl = limiter.check(`pin:${ip}`);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: `Too many attempts. Try again in ${rl.retryAfter}s` }), { status: 429 });
  }

  const body = await request.json();
  const { pin } = body;
  if (!pin || typeof pin !== "string") {
    return new Response(JSON.stringify({ error: "PIN required" }), { status: 400 });
  }

  const userId = await getUserIdByPin(pin);
  if (!userId) {
    await logAccess({ entityId: "pin_login", success: false, ip });
    return new Response(JSON.stringify({ error: "Invalid PIN" }), { status: 401 });
  }

  const session = createSession(userId, SESSION_SECRET);
  cookies.set("session", session, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60,
  });

  await logAccess({ userId, entityId: "pin_login", success: true, ip });

  return new Response(JSON.stringify({ success: true, userId }), { status: 200 });
};

export const DELETE: APIRoute = async ({ cookies }) => {
  cookies.delete("session", { path: "/" });
  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
