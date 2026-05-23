import { Bot } from "grammy";
import { getExpiredUsers, expireUser, getUserLanguage } from "./db";
import { ADMIN_ID } from "./env";
import type { MyContext } from "./types";
import { i18n } from "./i18n";

export function startExpiryCron(bot: Bot<MyContext>) {
  async function checkExpired() {
    const expired = await getExpiredUsers();
    if (expired.length > 0) {
      console.log(`⏰ Cron: ${expired.length} expired user(s) found`);
    }
    for (const user of expired) {
      await expireUser(user.telegram_id);
      const name = user.first_name ?? user.username ?? `ID ${user.telegram_id}`;

      try {
        const userLang = await getUserLanguage(user.telegram_id);
        const msg = i18n.t(userLang, "access_expired_contact_admin");
        await bot.api.sendMessage(user.telegram_id, msg);
        console.log(`   → Notified user ${user.telegram_id}`);
      } catch {}

      try {
        const adminLang = await getUserLanguage(ADMIN_ID);
        await bot.api.sendMessage(
          ADMIN_ID,
          i18n.t(adminLang, "admin_user_expired", { name, id: String(user.telegram_id) }),
          { parse_mode: "Markdown" },
        );
        console.log(`   → Notified admin about ${user.telegram_id}`);
      } catch {}
    }
  }

  // Run every 60 seconds
  setInterval(checkExpired, 60_000);

  // Also run once immediately at startup
  checkExpired();

  console.log("⏰ Expiration cron started (every 60s)");
}
