export const ADMIN_ID = parseInt(process.env.ADMIN_ID ?? "", 10);
export const BOT_TOKEN = process.env.BOT_TOKEN ?? "";
export const HA_URL = process.env.HA_URL ?? "";
export const HA_TOKEN = process.env.HA_TOKEN ?? "";
export const BOT_MODE = process.env.BOT_MODE ?? "polling";
export const PORT = process.env.PORT ?? "3000";
export const WEBHOOK_URL = process.env.WEBHOOK_URL ?? "";
export const DATABASE_PROVIDER = process.env.DATABASE_PROVIDER ?? "sqlite";
export const DATABASE_URL = process.env.DATABASE_URL ?? "bot.sqlite";

// Validation is done in bot.ts (entry point) to allow tests to import env.ts without process.exit
