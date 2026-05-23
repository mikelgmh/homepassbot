import { Composer, InlineKeyboard } from "grammy";
import { getUser, getAllEntities, getUserEntities } from "@/db";
import type { MyContext } from "@/types";
import { ADMIN_ID } from "@/env";

export const catchAll = new Composer<MyContext>();

catchAll.on("message:text", async (ctx, next) => {
  const text = ctx.message.text;
  if (text.startsWith("/")) { await next(); return; }

  if (ctx.from?.id === ADMIN_ID) {
    const allEnts = await getAllEntities();
    if (allEnts.length === 0) return;
    const keyboard = new InlineKeyboard();
    for (const e of allEnts) {
      keyboard.text(`${e.name}`, `open_entity_${e.id}`);
    }
    await ctx.reply(ctx.t("select_option_prompt"), { reply_markup: keyboard });
    return;
  }

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
