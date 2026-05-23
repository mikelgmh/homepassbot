import { Composer, InlineKeyboard } from "grammy";
import { getUserLanguage } from "@/db";
import type { MyContext } from "@/types";
import { showMainMenu } from "./admin-menu";

export const commandHandlers = new Composer<MyContext>();

commandHandlers.command("start", async (ctx) => {
  if (ctx.from?.id === ctx.api.me ? await (async () => false)() : false) {}
  if (ctx.from?.id === parseInt(process.env.ADMIN_ID ?? "0")) {
    await ctx.reply(ctx.t("start_admin"), { parse_mode: "Markdown" });
    return;
  }
  await ctx.reply(ctx.t("start_user"), { parse_mode: "Markdown" });
});

commandHandlers.command("menu", async (ctx) => {
  if (ctx.from?.id !== parseInt(process.env.ADMIN_ID ?? "0")) {
    await ctx.reply(ctx.t("command_no_permission"));
    return;
  }
  await showMainMenu(ctx);
});

commandHandlers.command("language", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text(ctx.t("language_button_es"), "lang_es")
    .text(ctx.t("language_button_en"), "lang_en");
  await ctx.reply(ctx.t("language_select"), { reply_markup: keyboard });
});

commandHandlers.callbackQuery(/^lang_(.+)$/, async (ctx) => {
  if (!ctx.from) return;
  const lang = ctx.match[1] as string;
  const { setUserLanguage } = await import("@/db");
  await setUserLanguage(ctx.from.id, lang);
  ctx.i18n.useLocale(lang);
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(ctx.t(lang === "es" ? "language_changed_es" : "language_changed_en"));
});

commandHandlers.callbackQuery("menu_language", async (ctx) => {
  if (ctx.from?.id !== parseInt(process.env.ADMIN_ID ?? "0")) return;
  await ctx.answerCallbackQuery();
  const storedLang = await getUserLanguage(ctx.from.id);
  if (storedLang) ctx.i18n.useLocale(storedLang);
  const keyboard = new InlineKeyboard()
    .text(ctx.t("language_button_es"), "lang_es")
    .text(ctx.t("language_button_en"), "lang_en");
  await ctx.editMessageText(ctx.t("language_select"), { reply_markup: keyboard });
});
