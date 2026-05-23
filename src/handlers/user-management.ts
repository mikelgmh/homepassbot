import { Composer, InlineKeyboard } from "grammy";
import { getUser, getUsersByStatus, denyUser, resetUser } from "@/db";
import type { MyContext } from "@/types";
import { ADMIN_ID } from "@/env";
import { pendingActions } from "./wizard";
import { showMainMenu } from "./admin-menu";
import { tForUser } from "./middleware";

export const userManagementHandlers = new Composer<MyContext>();

// ── Text commands: accept / reject / restore ──

userManagementHandlers.hears(/^\/accept_(\d+)$/, async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  const userId = parseInt(ctx.match[1]);
  const user = await getUser(userId);
  if (!user) { await ctx.reply(ctx.t("admin_user_not_found")); return; }
  if (user.permission_status !== "pending") { await ctx.reply(ctx.t("admin_user_not_pending")); return; }

  pendingActions.set(ctx.from.id, {
    type: "set_expiration",
    targetUserId: userId,
    step: "awaiting_date",
  } as any);

  const userName = user.first_name ?? `ID ${userId}`;
  await ctx.reply(
    ctx.t("admin_enter_expiry_date", { name: userName, cancel: ctx.t("cancel_command") }),
    { parse_mode: "Markdown" },
  );
});

userManagementHandlers.hears(/^\/reject_(\d+)$/, async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  const userId = parseInt(ctx.match[1]);
  const user = await getUser(userId);
  if (!user) { await ctx.reply(ctx.t("admin_user_not_found")); return; }

  await denyUser(userId);
  await ctx.reply(ctx.t("admin_user_rejected"));

  try {
    const msg = await tForUser(userId, "access_denied_by_admin");
    await ctx.api.sendMessage(userId, msg);
  } catch {}
  await showMainMenu(ctx);
});

userManagementHandlers.hears(/^\/restore_(\d+)$/, async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  const userId = parseInt(ctx.match[1]);
  const user = await getUser(userId);
  if (!user) { await ctx.reply(ctx.t("admin_user_not_found")); return; }

  await resetUser(userId);
  const name = user.first_name ?? `ID ${userId}`;
  await ctx.reply(
    `${ctx.t("admin_user_rehabilitated", { name })}\n${ctx.t("admin_user_rehabilitated_hint")}`,
  );
  await showMainMenu(ctx);
});

// ── Pending / denied pagination ──

async function showPendingList(ctx: MyContext, page: number) {
  const allUsers = await getUsersByStatus("pending");
  const perPage = 5;
  const totalPages = Math.max(1, Math.ceil(allUsers.length / perPage));
  const p = Math.min(page, totalPages - 1);
  const pageUsers = allUsers.slice(p * perPage, (p + 1) * perPage);

  if (allUsers.length === 0) {
    await ctx.editMessageText(ctx.t("admin_no_pending"), {
      reply_markup: new InlineKeyboard().text(ctx.t("admin_back"), "back_to_menu"),
    });
    return;
  }

  const lines = pageUsers.map((u) => {
    const name = u.first_name ?? u.username ?? `ID ${u.telegram_id}`;
    return `👤 ${name} (${u.telegram_id})\n  /accept_${u.telegram_id} — ${ctx.t("admin_accept")}\n  /reject_${u.telegram_id} — ${ctx.t("admin_reject")}`;
  });

  const keyboard = new InlineKeyboard();
  if (totalPages > 1) {
    if (p > 0) keyboard.text("◀️", `pending_page_${p - 1}`);
    keyboard.text(`${p + 1}/${totalPages}`, "noop");
    if (p < totalPages - 1) keyboard.text("▶️", `pending_page_${p + 1}`);
    keyboard.row();
  }
  keyboard.text(ctx.t("admin_back"), "back_to_menu");

  await ctx.editMessageText(
    ctx.t("admin_pending_title", { count: String(allUsers.length), list: lines.join("\n") }),
    { reply_markup: keyboard },
  );
}

async function showDeniedList(ctx: MyContext, page: number) {
  const allUsers = await getUsersByStatus("denied");
  const perPage = 5;
  const totalPages = Math.max(1, Math.ceil(allUsers.length / perPage));
  const p = Math.min(page, totalPages - 1);
  const pageUsers = allUsers.slice(p * perPage, (p + 1) * perPage);

  if (allUsers.length === 0) {
    await ctx.editMessageText(ctx.t("admin_no_denied"), {
      reply_markup: new InlineKeyboard().text(ctx.t("admin_back"), "back_to_menu"),
    });
    return;
  }

  const lines = pageUsers.map((u) => {
    const name = u.first_name ?? u.username ?? `ID ${u.telegram_id}`;
    return `👤 ${name} (${u.telegram_id})\n  /restore_${u.telegram_id} — ${ctx.t("menu_restore_user")}`;
  });

  const keyboard = new InlineKeyboard();
  if (totalPages > 1) {
    if (p > 0) keyboard.text("◀️", `denied_page_${p - 1}`);
    keyboard.text(`${p + 1}/${totalPages}`, "noop");
    if (p < totalPages - 1) keyboard.text("▶️", `denied_page_${p + 1}`);
    keyboard.row();
  }
  keyboard.text(ctx.t("admin_back"), "back_to_menu");

  await ctx.editMessageText(
    ctx.t("admin_denied_title", { count: String(allUsers.length), list: lines.join("\n") }),
    { reply_markup: keyboard },
  );
}

userManagementHandlers.callbackQuery("menu_pending_requests", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();
  await showPendingList(ctx, 0);
});

userManagementHandlers.callbackQuery(/^pending_page_(\d+)$/, async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();
  await showPendingList(ctx, parseInt(ctx.match[1]));
});

userManagementHandlers.callbackQuery("menu_denied_users", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();
  await showDeniedList(ctx, 0);
});

userManagementHandlers.callbackQuery(/^denied_page_(\d+)$/, async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();
  await showDeniedList(ctx, parseInt(ctx.match[1]));
});

userManagementHandlers.callbackQuery(/^reset_user_(\d+)$/, async (ctx) => {
  const userId = parseInt(ctx.match[1]);
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery({ text: ctx.t("callback_rehabilitated") });

  await resetUser(userId);

  const user = await getUser(userId);
  const name = user?.first_name ?? `ID ${userId}`;

  await ctx.editMessageText(
    `${ctx.t("admin_user_rehabilitated", { name })}\n${ctx.t("admin_user_rehabilitated_hint")}`,
  );
});
