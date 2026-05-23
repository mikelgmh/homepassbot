import { Composer, InlineKeyboard } from "grammy";
import { getUserLanguage, getAllEntities, createEntity, deleteEntity, updateEntityName } from "@/db";
import { callEntityAction, discoverEntities, fetchFriendlyNames } from "@/homeassistant";
import type { MyContext } from "@/types";
import { i18n } from "@/i18n";
import { ADMIN_ID } from "@/env";
import { pendingActions, showEntitySelectionKeyboard } from "./wizard";
import { isUserAllowed } from "./middleware";

export const entityManagementHandlers = new Composer<MyContext>();

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

entityManagementHandlers.callbackQuery("menu_manage_entities", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();
  await showEntityManagement(ctx);
});

entityManagementHandlers.callbackQuery("entity_discover", async (ctx) => {
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

entityManagementHandlers.callbackQuery(/^add_discovered_(.+)$/, async (ctx) => {
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

entityManagementHandlers.callbackQuery("entity_add_manual", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();
  pendingActions.set(ctx.from.id, { type: "add_entity" } as any);

  try { await ctx.editMessageReplyMarkup({ reply_markup: undefined }); } catch {}

  await ctx.reply(ctx.t("prompt_entity_id"));
});

entityManagementHandlers.callbackQuery("entity_sync_names", async (ctx) => {
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

entityManagementHandlers.callbackQuery("entity_delete_select", async (ctx) => {
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

  await ctx.editMessageText(ctx.t("entity_delete_title"), { reply_markup: keyboard });
});

entityManagementHandlers.callbackQuery(/^delete_entity_(\d+)$/, async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery({ text: ctx.t("callback_entity_removed") });
  await deleteEntity(parseInt(ctx.match[1]));
  await showEntityManagement(ctx);
});

// ── Entity action (open doors) ──

async function executeEntityAction(ctx: MyContext, entityId: number) {
  const { getEntity } = await import("@/db/entities");
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
  const { getEntity } = await import("@/db/entities");
  const entity = await getEntity(entityId);
  if (!entity) return;

  const keyboard = new InlineKeyboard()
    .text(ctx.t("door_yes_abrir"), `confirm_entity_${entityId}`)
    .text(ctx.t("door_no"), "cancel_door");
  await ctx.reply(ctx.t("entity_confirm_open", { name: entity.name }), { reply_markup: keyboard });
}

entityManagementHandlers.callbackQuery(/^open_entity_(\d+)$/, async (ctx) => {
  if (!(await isUserAllowed(ctx.from!.id))) {
    await ctx.answerCallbackQuery({ text: ctx.t("permission_denied_expired") });
    return;
  }
  await ctx.answerCallbackQuery();
  await showEntityConfirmation(ctx, parseInt(ctx.match[1]));
});

entityManagementHandlers.callbackQuery(/^confirm_entity_(\d+)$/, async (ctx) => {
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

entityManagementHandlers.callbackQuery("cancel_door", async (ctx) => {
  await ctx.answerCallbackQuery({ text: ctx.t("callback_cancelled") });
  try { await ctx.editMessageText(ctx.t("cancelled")); } catch {}
});

// ── Entity selection toggling ──

entityManagementHandlers.callbackQuery(/^ent_toggle_(\d+)$/, async (ctx) => {
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

entityManagementHandlers.callbackQuery("ent_confirm", async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  const { handleEntitySelectionConfirm } = await import("./wizard");
  await handleEntitySelectionConfirm(ctx);
});
