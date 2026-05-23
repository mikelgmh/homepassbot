import { Composer, InlineKeyboard } from "grammy";
import { DateTime } from "luxon";
import { getUser, createUser, getUserLanguage, expireUser, getReceiveRequests, getAllUsers } from "@/db";
import { ADMIN_ID } from "@/env";
import type { MyContext } from "@/types";
import { i18n } from "@/i18n";
import { pendingActions, handlePendingAction } from "./wizard";

export const middleware = new Composer<MyContext>();

async function notifyAdminNewUser(ctx: MyContext, userId: number, name: string) {
  const adminLang = await getUserLanguage(ADMIN_ID);
  const keyboard = new InlineKeyboard()
    .text(i18n.t(adminLang, "admin_accept"), `admin_accept_${userId}`)
    .text(i18n.t(adminLang, "admin_reject"), `admin_deny_${userId}`);

  await ctx.api.sendMessage(
    ADMIN_ID,
    i18n.t(adminLang, "admin_new_user_request", { userId: String(userId), name }),
    { parse_mode: "Markdown", reply_markup: keyboard },
  );
}

middleware.use(async (ctx, next) => {
  if (!ctx.from) return next();

  const storedLang = await getUserLanguage(ctx.from.id);
  if (storedLang) ctx.i18n.useLocale(storedLang);

  if (ctx.callbackQuery) return next();
  if (!ctx.message?.text) return next();

  const userId = ctx.from.id;
  const text = ctx.message.text.trim();

  const pending = pendingActions.get(userId);
  if (pending) {
    if (text.startsWith("/")) {
      pendingActions.delete(userId);
      return next();
    }
    const completed = await handlePendingAction(ctx, pending);
    if (completed) pendingActions.delete(userId);
    return;
  }

  if (userId === ADMIN_ID) return next();

  const user = await getUser(userId);
  const requestsEnabled = await getReceiveRequests();

  if (!user) {
    await createUser(userId, ctx.from.first_name ?? null, ctx.from.username ?? null, ctx.from.language_code);
    if (requestsEnabled) {
      await notifyAdminNewUser(ctx, userId, ctx.from.first_name ?? "Unknown");
    }
    await ctx.reply(ctx.t(requestsEnabled ? "access_request_sent" : "access_requests_disabled"));
    return;
  }

  if (user.permission_status === "pending") {
    if (requestsEnabled) {
      await notifyAdminNewUser(ctx, userId, ctx.from.first_name ?? "Unknown");
    }
    await ctx.reply(ctx.t(requestsEnabled ? "access_pending" : "access_requests_disabled"));
    return;
  }

  if (user.permission_status === "denied") return;

  if (
    user.permission_status === "allowed" &&
    user.access_expires_at &&
    DateTime.fromISO(user.access_expires_at) <= DateTime.now()
  ) {
    await expireUser(userId);
    if (requestsEnabled) {
      await notifyAdminNewUser(ctx, userId, ctx.from.first_name ?? "Unknown");
    }
    await ctx.reply(ctx.t(requestsEnabled ? "access_expired_notified" : "access_requests_disabled"));
    return;
  }

  return next();
});

export async function isUserAllowed(userId: number): Promise<boolean> {
  if (userId === ADMIN_ID) return true;
  const user = await getUser(userId);
  if (!user || user.permission_status !== "allowed") return false;
  if (user.access_expires_at && DateTime.fromISO(user.access_expires_at) <= DateTime.now()) {
    return false;
  }
  return true;
}

export async function tForUser(userId: number, key: string, params?: Record<string, any>): Promise<string> {
  const lang = await getUserLanguage(userId);
  return i18n.t(lang, key, params);
}
