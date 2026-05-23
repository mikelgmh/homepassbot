import { InlineKeyboard } from "grammy";
import { DateTime } from "luxon";
import { getUser, createUser, approveUser, updateExpiration, getUserLanguage, getAllEntities, createEntity, setUserEntities } from "@/db";
import type { MyContext } from "@/types";
import { i18n } from "@/i18n";
import { ADMIN_ID } from "@/env";
import { DOMAIN_SERVICE_MAP } from "@/homeassistant";

export interface PendingAction {
  type: "set_expiration" | "change_expiration" | "add_user" | "add_entity";
  targetUserId?: number;
  step: "awaiting_date" | "awaiting_entities";
  expiresAt?: string;
  selectedEntityIds: number[];
}

export const pendingActions = new Map<number, PendingAction>();

export async function handlePendingAction(
  ctx: MyContext,
  action: PendingAction,
): Promise<boolean> {
  const text = ctx.message?.text?.trim();
  if (!text) return true;

  if (text.toLowerCase() === ctx.t("cancel_command").toLowerCase()) {
    await ctx.reply(ctx.t("input_operation_cancelled"));
    return true;
  }

  switch (action.type) {
    case "set_expiration":
    case "change_expiration":
      return handleDateInput(ctx, action);
    case "add_user":
      return handleAddUserInput(ctx, text);
    case "add_entity":
      return handleAddEntityInput(ctx, text);
  }
}

async function handleDateInput(
  ctx: MyContext,
  action: PendingAction,
): Promise<boolean> {
  const text = ctx.message!.text.trim();
  const regex = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/;
  const match = text.match(regex);

  if (!match) {
    await ctx.reply(ctx.t("input_invalid_format", { cancel: ctx.t("cancel_command") }));
    return false;
  }

  const day = parseInt(match[1]);
  const month = parseInt(match[2]);
  const year = parseInt(match[3]);
  const hour = parseInt(match[4]);
  const minute = parseInt(match[5]);

  const dateTime = DateTime.fromObject(
    { year, month, day, hour, minute },
    { zone: "Europe/Madrid" },
  );

  if (!dateTime.isValid) {
    await ctx.reply(ctx.t("input_invalid_date"));
    return false;
  }

  if (dateTime <= DateTime.now().setZone("Europe/Madrid")) {
    await ctx.reply(ctx.t("input_date_must_be_future"));
    return false;
  }

  action.expiresAt = dateTime.toUTC().toISO();
  action.step = "awaiting_entities";
  action.selectedEntityIds = [];

  const targetUser = await getUser(action.targetUserId!);
  const userName = targetUser?.first_name ?? `ID ${action.targetUserId}`;
  const formatted = dateTime.toFormat("dd/MM/yyyy 'a las' HH:mm");

  const targetLang = await getUserLanguage(action.targetUserId!);
  const formattedMsg = i18n.t(targetLang, "admin_select_doors", { date: formatted, name: userName });

  try { await ctx.editMessageReplyMarkup({ reply_markup: undefined }); } catch {}

  await ctx.reply(formattedMsg, { parse_mode: "Markdown" });
  await showEntitySelection(ctx, action);
  return false;
}

async function showEntitySelection(ctx: MyContext, action: PendingAction) {
  const allEnts = await getAllEntities();
  const selected = new Set(action.selectedEntityIds);
  const keyboard = new InlineKeyboard();

  for (const e of allEnts) {
    const mark = selected.has(e.id) ? "✅" : "⬜";
    keyboard.text(`${mark} ${e.name}`, `ent_toggle_${e.id}`).row();
  }
  keyboard.row().text(ctx.t("confirm_selection"), "ent_confirm");

  await ctx.reply(ctx.t("select_entities_title"), { reply_markup: keyboard });
}

export async function handleEntitySelectionConfirm(ctx: MyContext) {
  const userId = ctx.from!.id;
  const action = pendingActions.get(userId);
  if (!action || action.step !== "awaiting_entities") {
    await ctx.answerCallbackQuery({ text: ctx.t("callback_invalid_action") });
    return;
  }

  if (action.selectedEntityIds.length === 0) {
    await ctx.answerCallbackQuery({ text: ctx.t("select_entities_none") });
    return;
  }

  const targetUserId = action.targetUserId!;
  const expiresAt = action.expiresAt!;
  const isChange = action.type === "change_expiration";
  pendingActions.delete(userId);

  const existing = await getUser(targetUserId);
  if (!existing) {
    await createUser(targetUserId, null, null, "en");
  }

  if (isChange) {
    await updateExpiration(targetUserId, expiresAt);
  }
  await approveUser(targetUserId, expiresAt);
  await setUserEntities(targetUserId, action.selectedEntityIds);

  const targetUser = await getUser(targetUserId);
  const userName = targetUser?.first_name ?? `ID ${targetUserId}`;
  const dateTime = DateTime.fromISO(expiresAt).setZone("Europe/Madrid");
  const formatted = dateTime.toFormat("dd/MM/yyyy 'a las' HH:mm");

  const entityNames = (await getAllEntities())
    .filter((e) => action.selectedEntityIds.includes(e.id))
    .map((e) => e.name)
    .join(", ");

  const permissionKey = isChange ? "admin_permission_updated" : "admin_permission_granted";
  await ctx.editMessageText(ctx.t(permissionKey, { name: userName, doors: entityNames, date: formatted }), {
    parse_mode: "Markdown",
  });

  try {
    const allEnts = await getAllEntities();
    const grantedEnts = allEnts.filter((e) => action.selectedEntityIds.includes(e.id));
    const doorKeyboard = new InlineKeyboard();
    for (const e of grantedEnts) {
      doorKeyboard.text(`${e.name}`, `open_entity_${e.id}`);
    }

    const notificationKey = isChange ? "admin_user_notification_updated" : "admin_user_notification_granted";
    const targetLang = await getUserLanguage(targetUserId);
    const msg = i18n.t(targetLang, notificationKey, { doors: entityNames, date: formatted });
    await ctx.api.sendMessage(targetUserId, msg, { reply_markup: doorKeyboard });
  } catch {}

  await ctx.answerCallbackQuery({ text: ctx.t("callback_saved") });
}

async function handleAddUserInput(
  ctx: MyContext,
  text: string,
): Promise<boolean> {
  const userId = parseInt(text);
  if (isNaN(userId)) {
    await ctx.reply(ctx.t("input_invalid_id"));
    return false;
  }

  const existing = await getUser(userId);
  if (existing) {
    await ctx.reply(ctx.t("admin_user_already_exists", { id: String(userId), status: existing.permission_status }));
    return true;
  }

  pendingActions.set(ctx.from!.id, {
    type: "set_expiration",
    targetUserId: userId,
    step: "awaiting_date",
  });

  const userName = text;
  await ctx.reply(
    ctx.t("admin_enter_expiry_date", { name: userName, cancel: ctx.t("cancel_command") }),
    { parse_mode: "Markdown" },
  );
  return false;
}

async function handleAddEntityInput(
  ctx: MyContext,
  text: string,
): Promise<boolean> {
  const entityId = text.trim();
  const domain = entityId.split(".")[0];
  const service = DOMAIN_SERVICE_MAP[domain];

  if (!service) {
    await ctx.reply(ctx.t("prompt_entity_invalid_domain", { domain }));
    return false;
  }

  const existing = await getAllEntities();
  if (existing.some((e) => e.entity_id === entityId)) {
    await ctx.reply(ctx.t("prompt_entity_exists"));
    return true;
  }

  const friendlyName = entityId.split(".")[1]?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? entityId;

  await createEntity(friendlyName, entityId, domain, service);
  await ctx.reply(ctx.t("callback_entity_added"));

  const adminLang = await getUserLanguage(ADMIN_ID);
  await ctx.api.sendMessage(
    ADMIN_ID,
    i18n.t(adminLang, "menu_manage_entities"),
    { reply_markup: new InlineKeyboard().text(i18n.t(adminLang, "menu_manage_entities"), "menu_manage_entities") },
  );

  return true;
}

// ── Entity selection toggling (used by handlers/entity-management.ts) ──

export async function showEntitySelectionKeyboard(ctx: MyContext, action: PendingAction) {
  const allEnts = await getAllEntities();
  const selected = new Set(action.selectedEntityIds);
  const keyboard = new InlineKeyboard();

  for (const e of allEnts) {
    const mark = selected.has(e.id) ? "✅" : "⬜";
    keyboard.text(`${mark} ${e.name}`, `ent_toggle_${e.id}`).row();
  }
  keyboard.row().text(ctx.t("confirm_selection"), "ent_confirm");

  await ctx.editMessageText(ctx.t("select_entities_title"), { reply_markup: keyboard });
}
