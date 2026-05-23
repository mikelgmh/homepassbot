import { I18n } from "@grammyjs/i18n";
import path from "path";
import type { MyContext } from "@/types";
import { setUserLanguage, getUserLanguage } from "@/db";

export const i18n = new I18n<MyContext>({
  defaultLocale: "en",
  directory: path.resolve("src/locales"),
  useSession: false,
  localeExtractor: (ctx) => {
    return ctx.from?.language_code?.split("-")[0] ?? "en";
  },
});

export async function changeUserLanguage(ctx: MyContext, lang: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  await setUserLanguage(userId, lang);
  ctx.i18n.useLocale(lang);
}
