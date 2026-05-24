import { Composer, InlineKeyboard } from "grammy";
import { DateTime } from "luxon";
import {
  getUser, getAllUsers, getUsersByStatus, denyUser, expireUser, resetUser, getUserLanguage,
  getAllEntities, getReceiveRequests, setReceiveRequests,
} from "@/db";
import { getAllPins, removePin } from "@/db/pins";
import type { MyContext } from "@/types";
import { i18n } from "@/i18n";
import { ADMIN_ID } from "@/env";
import { pendingActions } from "./wizard";
import { tForUser } from "./middleware";

export const adminMenuHandlers = new Composer<MyContext>();

export async function buildMainKeyboard(ctx: MyContext) {
  const requestsEnabled = await getReceiveRequests();
  const requestsLabel = requestsEnabled
    ? ctx.t("menu_requests_enabled")
    : ctx.t("menu_requests_disabled");

  return new InlineKeyboard()
    .text(ctx.t("menu_list_users"), "menu_list_users")
    .text(ctx.t("menu_remaining_time"), "menu_remaining_time")
    .row()
    .text(ctx.t("menu_remove_user"), "menu_remove_user")
    .text(ctx.t("menu_add_user"), "menu_add_user")
    .row()
    .text(ctx.t("menu_change_time"), "menu_change_time")
    .row()
    .text(ctx.t("menu_pending_requests"), "menu_pending_requests")
    .text(ctx.t("menu_denied_users"), "menu_denied_users")
    .row()
    .text(ctx.t("menu_manage_entities"), "menu_manage_entities")
    .row()
    .text(ctx.t("menu_manage_pins"), "menu_manage_pins")
    .row()
    .text(requestsLabel, "toggle_requests")
    .row()
    .text(ctx.t("menu_language"), "menu_language");
}

export async function showMainMenu(ctx: MyContext) {
  const keyboard = await buildMainKeyboard(ctx);
  const now = DateTime.now().setZone("Europe/Madrid").toFormat("dd/MM/yyyy HH:mm:ss");
  await ctx.reply(
    `${ctx.t("admin_panel_title")}\n${ctx.t("time_server", { time: now })}`,
    { reply_markup: keyboard },
  );
}

adminMenuHandlers.callbackQuery("back_to_menu", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();
  await ctx.deleteMessage();
  await showMainMenu(ctx);
});

adminMenuHandlers.callbackQuery("menu_list_users", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();

  const allUsers = await getAllUsers();
  if (allUsers.length === 0) {
    await ctx.editMessageText(ctx.t("admin_no_users"), {
      reply_markup: new InlineKeyboard().text(ctx.t("admin_back"), "back_to_menu"),
    });
    return;
  }

  const lines = allUsers.map((u) => {
    const icon = u.permission_status === "allowed" ? "✅" : u.permission_status === "pending" ? "⏳" : "❌";
    const name = u.first_name ?? u.username ?? `ID ${u.telegram_id}`;
    return `${icon} ${name} (\`${u.telegram_id}\`) — ${u.permission_status}`;
  });

  await ctx.editMessageText(
    `${ctx.t("admin_users_list_title")}\n\n${lines.join("\n")}`,
    { parse_mode: "Markdown", reply_markup: new InlineKeyboard().text(ctx.t("admin_back"), "back_to_menu") },
  );
});

adminMenuHandlers.callbackQuery("menu_remaining_time", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();

  const allowedUsers = await getUsersByStatus("allowed");
  if (allowedUsers.length === 0) {
    await ctx.editMessageText(ctx.t("admin_no_active_users"), {
      reply_markup: new InlineKeyboard().text(ctx.t("admin_back"), "back_to_menu"),
    });
    return;
  }

  const lines = allowedUsers.map((u) => {
    const name = u.first_name ?? u.username ?? `ID ${u.telegram_id}`;
    let timeLeft = ctx.t("time_remaining_never");
    let expiresStr = ctx.t("time_remaining_expires");
    if (u.access_expires_at) {
      const expires = DateTime.fromISO(u.access_expires_at).setZone("Europe/Madrid");
      expiresStr = expires.toFormat("dd/MM/yyyy HH:mm");
      const diff = expires.diffNow(["days", "hours", "minutes"]);
      if (diff.toMillis() > 0) {
        const d = Math.floor(diff.days);
        const h = Math.floor(diff.hours);
        const m = Math.floor(diff.minutes);
        timeLeft = `${d > 0 ? `${d}d ` : ""}${h}h ${m}m`;
      } else {
        timeLeft = ctx.t("time_remaining_expired");
      }
    }
    return `${name}:\n  ${ctx.t("time_remaining_label", { time: timeLeft })}\n  ${ctx.t("time_expires_label", { date: expiresStr })}`;
  });

  await ctx.editMessageText(
    `${ctx.t("admin_time_remaining_title")}\n\n${lines.join("\n\n")}`,
    { parse_mode: "Markdown", reply_markup: new InlineKeyboard().text(ctx.t("admin_back"), "back_to_menu") },
  );
});

adminMenuHandlers.callbackQuery("menu_remove_user", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();

  const allowedUsers = await getUsersByStatus("allowed");
  if (allowedUsers.length === 0) {
    await ctx.editMessageText(ctx.t("admin_no_active_users"), {
      reply_markup: new InlineKeyboard().text(ctx.t("admin_back"), "back_to_menu"),
    });
    return;
  }

  const keyboard = new InlineKeyboard();
  for (const u of allowedUsers) {
    const name = u.first_name ?? u.username ?? `ID ${u.telegram_id}`;
    keyboard.text(`❌ ${name}`, `remove_user_${u.telegram_id}`).row();
  }
  keyboard.text(ctx.t("admin_back"), "back_to_menu");

  await ctx.editMessageText(ctx.t("admin_select_user_remove"), {
    parse_mode: "Markdown", reply_markup: keyboard,
  });
});

adminMenuHandlers.callbackQuery(/^remove_user_(\d+)$/, async (ctx) => {
  const userId = parseInt(ctx.match[1]);
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery({ text: ctx.t("callback_removed") });

  await denyUser(userId);
  await ctx.editMessageText(ctx.t("admin_access_removed_msg", { userId: String(userId) }), {
    parse_mode: "Markdown",
  });

  try {
    const msg = await tForUser(userId, "access_removed_by_admin");
    await ctx.api.sendMessage(userId, msg);
  } catch {}
});

adminMenuHandlers.callbackQuery("menu_add_user", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();

  pendingActions.set(ctx.from.id, { type: "add_user" } as any);

  try { await ctx.editMessageReplyMarkup({ reply_markup: undefined }); } catch {}

  await ctx.reply(ctx.t("admin_enter_user_id", { cancel: ctx.t("cancel_command") }));
});

adminMenuHandlers.callbackQuery("menu_change_time", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();

  const allowedUsers = await getUsersByStatus("allowed");
  if (allowedUsers.length === 0) {
    await ctx.editMessageText(ctx.t("admin_no_active_users"), {
      reply_markup: new InlineKeyboard().text(ctx.t("admin_back"), "back_to_menu"),
    });
    return;
  }

  const keyboard = new InlineKeyboard();
  for (const u of allowedUsers) {
    const name = u.first_name ?? u.username ?? `ID ${u.telegram_id}`;
    keyboard.text(`🔄 ${name}`, `change_time_${u.telegram_id}`).row();
  }
  keyboard.text(ctx.t("admin_back"), "back_to_menu");

  await ctx.editMessageText(ctx.t("admin_select_user_change_time"), {
    parse_mode: "Markdown", reply_markup: keyboard,
  });
});

adminMenuHandlers.callbackQuery(/^change_time_(\d+)$/, async (ctx) => {
  const userId = parseInt(ctx.match[1]);
  if (ctx.from?.id !== ADMIN_ID) {
    await ctx.answerCallbackQuery({ text: ctx.t("callback_not_authorized") });
    return;
  }

  const targetUser = await getUser(userId);
  if (!targetUser) {
    await ctx.answerCallbackQuery({ text: ctx.t("callback_user_not_found") });
    return;
  }

  pendingActions.set(ctx.from.id, {
    type: "change_expiration",
    targetUserId: userId,
    step: "awaiting_date",
  } as any);
  await ctx.answerCallbackQuery({ text: ctx.t("callback_changing_time") });

  const userName = targetUser.first_name ?? `ID ${userId}`;
  const currentExpiry = targetUser.access_expires_at
    ? DateTime.fromISO(targetUser.access_expires_at).setZone("Europe/Madrid").toFormat("dd/MM/yyyy HH:mm")
    : ctx.t("time_remaining_never");

  try { await ctx.editMessageReplyMarkup({ reply_markup: undefined }); } catch {}

  await ctx.reply(
    ctx.t("admin_current_expiry", { name: userName, expiry: currentExpiry }) + "\n\n" +
    ctx.t("admin_enter_new_date", { cancel: ctx.t("cancel_command") }),
    { parse_mode: "Markdown" },
  );
});

adminMenuHandlers.callbackQuery("toggle_requests", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  const current = await getReceiveRequests();
  await setReceiveRequests(!current);
  await ctx.answerCallbackQuery({ text: ctx.t(!current ? "requests_enabled_now" : "requests_disabled_now") });
  const keyboard = await buildMainKeyboard(ctx);
  try { await ctx.editMessageReplyMarkup({ reply_markup: keyboard }); } catch {}
});

adminMenuHandlers.callbackQuery(/^admin_accept_(\d+)$/, async (ctx) => {
  const userId = parseInt(ctx.match[1]);
  if (ctx.from?.id !== ADMIN_ID) {
    await ctx.answerCallbackQuery({ text: ctx.t("callback_not_authorized") });
    return;
  }

  pendingActions.set(ctx.from.id, {
    type: "set_expiration",
    targetUserId: userId,
    step: "awaiting_date",
  } as any);
  await ctx.answerCallbackQuery({ text: ctx.t("callback_authorizing") });

  const targetUser = await getUser(userId);
  const userName = targetUser?.first_name ?? `ID ${userId}`;

  try { await ctx.editMessageReplyMarkup({ reply_markup: undefined }); } catch {}

  await ctx.reply(
    ctx.t("admin_enter_expiry_date", { name: userName, cancel: ctx.t("cancel_command") }),
    { parse_mode: "Markdown" },
  );
});

adminMenuHandlers.callbackQuery(/^admin_deny_(\d+)$/, async (ctx) => {
  const userId = parseInt(ctx.match[1]);
  if (ctx.from?.id !== ADMIN_ID) {
    await ctx.answerCallbackQuery({ text: ctx.t("callback_not_authorized") });
    return;
  }

  await denyUser(userId);
  await ctx.answerCallbackQuery({ text: ctx.t("callback_rejected") });

  try { await ctx.editMessageText(ctx.t("admin_user_rejected")); } catch {}

  try {
    const msg = await tForUser(userId, "access_denied_by_admin");
    await ctx.api.sendMessage(userId, msg);
  } catch {}
});

// ── PIN Management ──

adminMenuHandlers.callbackQuery("menu_manage_pins", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();

  const allUsers = await getAllUsers();
  const allPins = await getAllPins();
  const pinMap = new Map(allPins.map((p) => [p.userId, p]));

  const lines = allUsers.map((u) => {
    const name = u.first_name ?? u.username ?? `ID ${u.telegram_id}`;
    const hasPin = pinMap.has(u.telegram_id);
    return `${hasPin ? "🟢" : "🔴"} ${name} (\`${u.telegram_id}\`)${hasPin ? " — PIN set" : " — No PIN"}`;
  });

  const keyboard = new InlineKeyboard();
  for (const u of allUsers) {
    const name = u.first_name ?? u.username ?? `ID ${u.telegram_id}`;
    const hasPin = pinMap.has(u.telegram_id);
    keyboard.text(hasPin ? `🟢 ${name}` : `🔴 ${name}`, `pin_toggle_${u.telegram_id}`).row();
  }
  keyboard.text(ctx.t("admin_back"), "back_to_menu");

  await ctx.editMessageText(
    `${ctx.t("pin_management_title")}\n\n${lines.join("\n")}`,
    { parse_mode: "Markdown", reply_markup: keyboard },
  );
});

adminMenuHandlers.callbackQuery(/^pin_toggle_(\d+)$/, async (ctx) => {
  const targetId = parseInt(ctx.match[1]);
  if (ctx.from?.id !== ADMIN_ID) return;

  const existing = await getAllPins();
  const hasPin = existing.some((p) => p.userId === targetId);

  if (hasPin) {
    await removePin(targetId);
    await ctx.answerCallbackQuery({ text: ctx.t("callback_pin_removed") });
  } else {
    pendingActions.set(ctx.from.id, { type: "set_pin", targetUserId: targetId } as any);
    await ctx.answerCallbackQuery({ text: ctx.t("callback_enter_pin") });

    try { await ctx.editMessageReplyMarkup({ reply_markup: undefined }); } catch {}

    const user = await getUser(targetId);
    const name = user?.first_name ?? `ID ${targetId}`;
    await ctx.reply(ctx.t("pin_enter_code", { name, cancel: ctx.t("cancel_command") }));
    return;
  }

  await ctx.editMessageText(ctx.t(hasPin ? "pin_removed_msg" : "pin_set_msg"), {
    reply_markup: new InlineKeyboard().text(ctx.t("admin_back"), "menu_manage_pins"),
  });
});
