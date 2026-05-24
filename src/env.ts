import { readFileSync } from "fs";

function isAddon(): boolean {
  return !!process.env.SUPERVISOR_TOKEN;
}

function readAddonConfig(): Record<string, string> {
  try {
    return JSON.parse(readFileSync("/data/options.json", "utf-8"));
  } catch {
    return {};
  }
}

const addonCfg = isAddon() ? readAddonConfig() : {};

export const ADMIN_ID = parseInt(process.env.ADMIN_ID ?? addonCfg.admin_id ?? "", 10);
export const BOT_TOKEN = process.env.BOT_TOKEN ?? addonCfg.bot_token ?? "";
export const HA_URL = process.env.HA_URL ?? (isAddon() ? "http://supervisor/core/api" : "");
export const HA_TOKEN = process.env.HA_TOKEN ?? process.env.SUPERVISOR_TOKEN ?? "";
export const BOT_MODE = process.env.BOT_MODE ?? "polling";
export const PORT = process.env.PORT ?? addonCfg.port ?? "8099";
export const WEBHOOK_URL = process.env.WEBHOOK_URL ?? "";
export const DATABASE_PROVIDER = process.env.DATABASE_PROVIDER ?? "sqlite";
export const DATABASE_URL = process.env.DATABASE_URL ?? "bot.sqlite";
export const SESSION_SECRET = process.env.SESSION_SECRET ?? "change-me-in-production";
export const IS_ADDON = isAddon();
export const INGRESS_URL = process.env.INGRESS_URL ?? "";
export const INGRESS_ENTRY = process.env.INGRESS_ENTRY ?? "";

// Validation is done in bot.ts (entry point) to allow tests to import env.ts without process.exit
