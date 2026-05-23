import { Composer, InlineKeyboard } from "grammy";
import { DateTime } from "luxon";
import {
  getUser,
  getAllUsers,
  getUsersByStatus,
  createUser,
  denyUser,
  expireUser,
  resetUser,
  getUserLanguage,
  getAllEntities,
  getUserEntities,
  setUserEntities,
  createEntity,
  deleteEntity,
  updateEntityName,
  getReceiveRequests,
  setReceiveRequests,
} from "./db";
import { callEntityAction, discoverEntities, fetchFriendlyNames } from "./homeassistant";
import { pendingActions, handlePendingAction, handleEntitySelectionConfirm } from "./actions";
import type { MyContext } from "./types";
import { i18n } from "./i18n";
import { ADMIN_ID } from "./env";

export { ADMIN_ID };
export const commands = new Composer<MyContext>();

async function isUserAllowed(userId: number): Promise<boolean> {
  if (userId === ADMIN_ID) return true;
  const user = await getUser(userId);
  if (!user || user.permission_status !== "allowed") return false;
  if (
    user.access_expires_at &&
    DateTime.fromISO(user.access_expires_at) <= DateTime.now()
  ) {
    return false;
  }
  return true;
}

async function tForUser(userId: number, key: string, params?: Record<string, any>): Promise<string> {
  const lang = await getUserLanguage(userId);
  return i18n.t(lang, key, params);
}

// ── Pending action handler + Permission middleware ────────

commands.use(async (ctx, next) => {
  if (!ctx.from) return next();

  // Always load language from DB for every update type
  const storedLang = await getUserLanguage(ctx.from.id);
  if (storedLang) ctx.i18n.useLocale(storedLang);

  if (ctx.callbackQuery) return next();
  if (!ctx.message?.text) return next();

  const userId = ctx.from.id;

  const text = ctx.message.text.trim();

  // If admin has a pending action, handle it first
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

// ── Commands ──────────────────────────────────────────────

commands.command("start", async (ctx) => {
  if (ctx.from?.id === ADMIN_ID) {
    await ctx.reply(ctx.t("start_admin"), { parse_mode: "Markdown" });
    return;
  }
  await ctx.reply(ctx.t("start_user"), { parse_mode: "Markdown" });
});

commands.command("menu", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) {
    await ctx.reply(ctx.t("command_no_permission"));
    return;
  }
  await showMainMenu(ctx);
});

commands.command("hora", async (ctx) => {
  const now = DateTime.now().setZone("Europe/Madrid");
  await ctx.reply(
    ctx.t("time_current", { time: now.toFormat("dd/MM/yyyy HH:mm:ss") }),
    { parse_mode: "Markdown" },
  );
});

commands.command("language", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text(ctx.t("language_button_es"), "lang_es")
    .text(ctx.t("language_button_en"), "lang_en");
  await ctx.reply(ctx.t("language_select"), { reply_markup: keyboard });
});

commands.callbackQuery(/^lang_(.+)$/, async (ctx) => {
  if (!ctx.from) return;
  const lang = ctx.match[1] as string;
  const { setUserLanguage } = await import("./db");
  await setUserLanguage(ctx.from.id, lang);
  ctx.i18n.useLocale(lang);
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(ctx.t(lang === "es" ? "language_changed_es" : "language_changed_en"));
});

// ── Catch-all for authorized users ────────────────────────

commands.on("message:text", async (ctx, next) => {
  if (ctx.from?.id === ADMIN_ID) return next();
  const user = await getUser(ctx.from.id);
  if (!user || user.permission_status !== "allowed") return;

  const userEnts = await getUserEntities(ctx.from.id);
  if (userEnts.length === 0) return;

  const keyboard = new InlineKeyboard();
  for (const e of userEnts) {
    keyboard.text(`${e.name}`, `open_entity_${e.id}`);
  }

  await ctx.reply(ctx.t("select_option_prompt"), { reply_markup: keyboard });
});

// ── Entity action ─────────────────────────────────────────

async function executeEntityAction(ctx: MyContext, entityId: number) {
  const { getEntity } = await import("./db");
  const entity = await getEntity(entityId);
  if (!entity) {
    await ctx.reply(ctx.t("entity_not_found"));
    return;
  }

  await ctx.reply(ctx.t("door_opening", { door: entity.name }));
  const result = await callEntityAction(entity.entity_id, entity.domain, entity.service);

  if (result.success) {
    await ctx.reply(ctx.t("door_opened", { door: entity.name }));
  } else if (result.error?.startsWith("HTTP 500")) {
    await ctx.reply(ctx.t("door_ha_warning", { door: entity.name }));
  } else {
    await ctx.reply(ctx.t("door_error", { door: entity.name, error: result.error ?? "unknown" }));
  }
}

async function showEntityConfirmation(ctx: MyContext, entityId: number) {
  const { getEntity } = await import("./db");
  const entity = await getEntity(entityId);
  if (!entity) return;

  const keyboard = new InlineKeyboard()
    .text(ctx.t("door_yes_abrir"), `confirm_entity_${entityId}`)
    .text(ctx.t("door_no"), "cancel_door");
  await ctx.reply(ctx.t("entity_confirm_open", { name: entity.name }), {
    reply_markup: keyboard,
  });
}

commands.callbackQuery(/^open_entity_(\d+)$/, async (ctx) => {
  if (!(await isUserAllowed(ctx.from!.id))) {
    await ctx.answerCallbackQuery({ text: ctx.t("permission_denied_expired") });
    return;
  }
  await ctx.answerCallbackQuery();
  await showEntityConfirmation(ctx, parseInt(ctx.match[1]));
});

commands.callbackQuery(/^confirm_entity_(\d+)$/, async (ctx) => {
  const entityId = parseInt(ctx.match[1]);
  if (!(await isUserAllowed(ctx.from!.id))) {
    await ctx.answerCallbackQuery({ text: ctx.t("permission_denied_expired") });
    try { await ctx.editMessageText(ctx.t("your_permission_expired")); } catch {}
    return;
  }
  await ctx.answerCallbackQuery();
  try { await ctx.editMessageReplyMarkup({ reply_markup: undefined }); } catch {}
  await executeEntityAction(ctx, entityId);
});

commands.callbackQuery("cancel_door", async (ctx) => {
  await ctx.answerCallbackQuery({ text: ctx.t("callback_cancelled") });
  try { await ctx.editMessageText(ctx.t("cancelled")); } catch {}
});

// ── Admin menu ────────────────────────────────────────────

async function buildMainKeyboard(ctx: MyContext) {
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
    .text(requestsLabel, "toggle_requests")
    .row()
    .text(ctx.t("menu_language"), "menu_language");
}

async function showMainMenu(ctx: MyContext) {
  const keyboard = await buildMainKeyboard(ctx);
  const now = DateTime.now().setZone("Europe/Madrid").toFormat("dd/MM/yyyy HH:mm:ss");
  await ctx.reply(
    `${ctx.t("admin_panel_title")}\n${ctx.t("time_server", { time: now })}`,
    { reply_markup: keyboard },
  );
}

// ── Entity management menu ────────────────────────────────

async function showEntityManagement(ctx: MyContext) {
  const allEnts = await getAllEntities();

  const lines = allEnts.map((e, i) => `${i + 1}. ${e.name} — \`${e.entity_id}\` (${e.domain})`);

  const keyboard = new InlineKeyboard()
    .text(ctx.t("menu_discover_entities"), "entity_discover")
    .text(ctx.t("menu_add_entity_manual"), "entity_add_manual")
    .row()
    .text(ctx.t("menu_delete_entity"), "entity_delete_select")
    .text(ctx.t("menu_sync_names"), "entity_sync_names")
    .row()
    .text(ctx.t("admin_back"), "back_to_menu");

  await ctx.editMessageText(
    ctx.t("entity_list_title") + (allEnts.length ? `\n\n${lines.join("\n")}` : ""),
    { parse_mode: "Markdown", reply_markup: keyboard },
  );
}

commands.callbackQuery("menu_manage_entities", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();
  await showEntityManagement(ctx);
});

// ── Discover entities from HA ─────────────────────────────

commands.callbackQuery("entity_discover", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(ctx.t("discover_searching"));

  const discovered = await discoverEntities();
  if (discovered.length === 0) {
    await ctx.editMessageText(ctx.t("discover_none"), {
      reply_markup: new InlineKeyboard().text(ctx.t("admin_back"), "menu_manage_entities"),
    });
    return;
  }

  const existing = await getAllEntities();
  const existingIds = new Set(existing.map((e) => e.entity_id));
  const newOnes = discovered.filter((d) => !existingIds.has(d.entity_id));

  if (newOnes.length === 0) {
    await ctx.editMessageText(ctx.t("discover_all_added"), {
      reply_markup: new InlineKeyboard().text(ctx.t("admin_back"), "menu_manage_entities"),
    });
    return;
  }

  const keyboard = new InlineKeyboard();
  for (const d of newOnes.slice(0, 20)) {
    keyboard.text(`➕ ${d.friendly_name}`, `add_discovered_${d.entity_id}`).row();
  }
  keyboard.text(ctx.t("admin_back"), "menu_manage_entities");

  await ctx.editMessageText(
    ctx.t("discover_title", { count: String(newOnes.length) }),
    { reply_markup: keyboard },
  );
});

commands.callbackQuery(/^add_discovered_(.+)$/, async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  const entityId = ctx.match[1];
  const discovered = await discoverEntities();
  const info = discovered.find((d) => d.entity_id === entityId);
  if (!info) {
    await ctx.answerCallbackQuery({ text: ctx.t("entity_not_found") });
    return;
  }

  await createEntity(info.friendly_name, info.entity_id, info.domain, info.service);
  await ctx.answerCallbackQuery({ text: ctx.t("callback_entity_added") });
  await showEntityManagement(ctx);
});

// ── Add entity manually ───────────────────────────────────

commands.callbackQuery("entity_add_manual", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();
  pendingActions.set(ctx.from.id, { type: "add_entity" });

  try { await ctx.editMessageReplyMarkup({ reply_markup: undefined }); } catch {}

  await ctx.reply(ctx.t("prompt_entity_id"));
});

// ── Sync entity names from HA ─────────────────────────────

commands.callbackQuery("entity_sync_names", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery({ text: ctx.t("callback_syncing") });

  const names = await fetchFriendlyNames();
  const allEnts = await getAllEntities();
  let updated = 0;
  for (const e of allEnts) {
    const haName = names[e.entity_id];
    if (haName && haName !== e.name) {
      await updateEntityName(e.id, haName);
      updated++;
    }
  }
  await ctx.editMessageText(ctx.t("sync_names_done", { count: String(updated) }), {
    reply_markup: new InlineKeyboard().text(ctx.t("admin_back"), "menu_manage_entities"),
  });
});

// ── Noop (page indicator) ─────────────────────────────────

commands.callbackQuery("noop", async (ctx) => {
  await ctx.answerCallbackQuery();
});

// ── Text commands: accept / reject / restore ──────────────

commands.hears(/^\/accept_(\d+)$/, async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  const userId = parseInt(ctx.match[1]);
  const user = await getUser(userId);
  if (!user) { await ctx.reply(ctx.t("admin_user_not_found")); return; }
  if (user.permission_status !== "pending") { await ctx.reply(ctx.t("admin_user_not_pending")); return; }

  pendingActions.set(ctx.from.id, {
    type: "set_expiration",
    targetUserId: userId,
    step: "awaiting_date",
  });

  const userName = user.first_name ?? `ID ${userId}`;
  await ctx.reply(
    ctx.t("admin_enter_expiry_date", { name: userName, cancel: ctx.t("cancel_command") }),
    { parse_mode: "Markdown" },
  );
});

commands.hears(/^\/reject_(\d+)$/, async (ctx) => {
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

commands.hears(/^\/restore_(\d+)$/, async (ctx) => {
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

// ── Delete entity ─────────────────────────────────────────

commands.callbackQuery("entity_delete_select", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();

  const allEnts = await getAllEntities();
  if (allEnts.length === 0) {
    await ctx.editMessageText(ctx.t("entity_list_empty"), {
      reply_markup: new InlineKeyboard().text(ctx.t("admin_back"), "menu_manage_entities"),
    });
    return;
  }

  const keyboard = new InlineKeyboard();
  for (const e of allEnts) {
    keyboard.text(`❌ ${e.name}`, `delete_entity_${e.id}`).row();
  }
  keyboard.text(ctx.t("admin_back"), "menu_manage_entities");

  await ctx.editMessageText(ctx.t("entity_delete_title"), {
    reply_markup: keyboard,
  });
});

commands.callbackQuery(/^delete_entity_(\d+)$/, async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery({ text: ctx.t("callback_entity_removed") });
  await deleteEntity(parseInt(ctx.match[1]));
  await showEntityManagement(ctx);
});

// ── Admin callback: accept / deny new user ────────────────

commands.callbackQuery(/^admin_accept_(\d+)$/, async (ctx) => {
  const userId = parseInt(ctx.match[1]);
  if (ctx.from?.id !== ADMIN_ID) {
    await ctx.answerCallbackQuery({ text: ctx.t("callback_not_authorized") });
    return;
  }

  pendingActions.set(ctx.from.id, {
    type: "set_expiration",
    targetUserId: userId,
    step: "awaiting_date",
  });
  await ctx.answerCallbackQuery({ text: ctx.t("callback_authorizing") });

  const targetUser = await getUser(userId);
  const userName = targetUser?.first_name ?? `ID ${userId}`;

  try { await ctx.editMessageReplyMarkup({ reply_markup: undefined }); } catch {}

  await ctx.reply(
    ctx.t("admin_enter_expiry_date", { name: userName, cancel: ctx.t("cancel_command") }),
    { parse_mode: "Markdown" },
  );
});

commands.callbackQuery(/^admin_deny_(\d+)$/, async (ctx) => {
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

// ── Menu callbacks ────────────────────────────────────────

commands.callbackQuery("menu_list_users", async (ctx) => {
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
    const icon =
      u.permission_status === "allowed"
        ? "✅"
        : u.permission_status === "pending"
          ? "⏳"
          : "❌";
    const name = u.first_name ?? u.username ?? `ID ${u.telegram_id}`;
    return `${icon} ${name} (\`${u.telegram_id}\`) — ${u.permission_status}`;
  });

  await ctx.editMessageText(
    `${ctx.t("admin_users_list_title")}\n\n${lines.join("\n")}`,
    {
      parse_mode: "Markdown",
      reply_markup: new InlineKeyboard().text(ctx.t("admin_back"), "back_to_menu"),
    },
  );
});

commands.callbackQuery("menu_remaining_time", async (ctx) => {
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
    {
      parse_mode: "Markdown",
      reply_markup: new InlineKeyboard().text(ctx.t("admin_back"), "back_to_menu"),
    },
  );
});

commands.callbackQuery("menu_remove_user", async (ctx) => {
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
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
});

commands.callbackQuery(/^remove_user_(\d+)$/, async (ctx) => {
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

commands.callbackQuery("menu_add_user", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();

  pendingActions.set(ctx.from.id, { type: "add_user" });

  try { await ctx.editMessageReplyMarkup({ reply_markup: undefined }); } catch {}

  await ctx.reply(ctx.t("admin_enter_user_id", { cancel: ctx.t("cancel_command") }));
});

commands.callbackQuery("menu_pending_requests", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();
  await showPendingList(ctx, 0);
});

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

commands.callbackQuery(/^pending_page_(\d+)$/, async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();
  await showPendingList(ctx, parseInt(ctx.match[1]));
});

commands.callbackQuery("menu_denied_users", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();
  await showDeniedList(ctx, 0);
});

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

commands.callbackQuery(/^denied_page_(\d+)$/, async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();
  await showDeniedList(ctx, parseInt(ctx.match[1]));
});

commands.callbackQuery(/^reset_user_(\d+)$/, async (ctx) => {
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

commands.callbackQuery("menu_change_time", async (ctx) => {
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
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
});

commands.callbackQuery(/^change_time_(\d+)$/, async (ctx) => {
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
  });
  await ctx.answerCallbackQuery({ text: ctx.t("callback_changing_time") });

  const userName = targetUser.first_name ?? `ID ${userId}`;
  const currentExpiry = targetUser.access_expires_at
    ? DateTime.fromISO(targetUser.access_expires_at)
        .setZone("Europe/Madrid")
        .toFormat("dd/MM/yyyy HH:mm")
    : ctx.t("time_remaining_never");

  try { await ctx.editMessageReplyMarkup({ reply_markup: undefined }); } catch {}

  await ctx.reply(
    ctx.t("admin_current_expiry", { name: userName, expiry: currentExpiry }) + "\n\n" +
    ctx.t("admin_enter_new_date", { cancel: ctx.t("cancel_command") }),
    { parse_mode: "Markdown" },
  );
});

// ── Entity selection during permission setup ─────────────

commands.callbackQuery(/^ent_toggle_(\d+)$/, async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  const entityId = parseInt(ctx.match[1]);
  const action = pendingActions.get(ctx.from.id);
  if (!action || action.step !== "awaiting_entities") return;

  const idx = action.selectedEntityIds.indexOf(entityId);
  if (idx >= 0) {
    action.selectedEntityIds.splice(idx, 1);
  } else {
    action.selectedEntityIds.push(entityId);
  }

  await ctx.answerCallbackQuery();
  await showEntitySelectionKeyboard(ctx, action);
});

async function showEntitySelectionKeyboard(ctx: MyContext, action: any) {
  const allEnts = await getAllEntities();
  const selected = new Set(action.selectedEntityIds);

  const keyboard = new InlineKeyboard();
  for (const e of allEnts) {
    const mark = selected.has(e.id) ? "✅" : "⬜";
    keyboard.text(`${mark} ${e.name}`, `ent_toggle_${e.id}`).row();
  }
  keyboard.row().text(ctx.t("confirm_selection"), "ent_confirm");

  await ctx.editMessageText(ctx.t("select_entities_title"), {
    reply_markup: keyboard,
  });
}

commands.callbackQuery("ent_confirm", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await handleEntitySelectionConfirm(ctx);
});

// ── Language from menu ────────────────────────────────────

commands.callbackQuery("menu_language", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();
  const storedLang = await getUserLanguage(ctx.from.id);
  if (storedLang) ctx.i18n.useLocale(storedLang);
  const keyboard = new InlineKeyboard()
    .text(ctx.t("language_button_es"), "lang_es")
    .text(ctx.t("language_button_en"), "lang_en");
  await ctx.editMessageText(ctx.t("language_select"), { reply_markup: keyboard });
});

// ── Toggle receive requests ───────────────────────────────

commands.callbackQuery("toggle_requests", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  const current = await getReceiveRequests();
  await setReceiveRequests(!current);
  await ctx.answerCallbackQuery({ text: ctx.t(!current ? "requests_enabled_now" : "requests_disabled_now") });
  const keyboard = await buildMainKeyboard(ctx);
  try { await ctx.editMessageReplyMarkup({ reply_markup: keyboard }); } catch {}
});

// ── Back to menu ──────────────────────────────────────────

commands.callbackQuery("back_to_menu", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();
  await ctx.deleteMessage();
  await showMainMenu(ctx);
});
