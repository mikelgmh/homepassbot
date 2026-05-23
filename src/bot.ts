import { Bot } from "grammy";
import type { MyContext } from "./types";
import { commands } from "./commands";
import { ADMIN_ID } from "./env";
import { getAllUsers } from "./db";
import { checkConnection } from "./homeassistant";
import { startExpiryCron } from "./expiry";
import { i18n } from "./i18n";

console.log("=".repeat(50));
console.log("🏠 Home Unlock Bot — Starting up...");
console.log("=".repeat(50));

const token = process.env.BOT_TOKEN;
const haToken = process.env.HA_TOKEN;
const mode = process.env.BOT_MODE ?? "polling";
const port = process.env.PORT ?? "3000";
const webhookUrl = process.env.WEBHOOK_URL;

console.log(`📋 Environment variables:`);
console.log(`   BOT_TOKEN: ${token ? `✅ configured (${token.slice(0, 8)}...)` : "❌ MISSING"}`);
console.log(`   HA_TOKEN: ${haToken ? `✅ configured (${haToken.slice(0, 8)}...)` : "❌ MISSING"}`);
console.log(`   HA_URL: ${process.env.HA_URL || "⚠️  not set"}`);
console.log(`   BOT_MODE: ${mode}`);
console.log(`   DATABASE_PROVIDER: ${process.env.DATABASE_PROVIDER || "sqlite"}`);
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL || "bot.sqlite"}`);
if (mode === "webhook") {
  console.log(`   WEBHOOK_URL: ${webhookUrl ?? "❌ MISSING"}`);
  console.log(`   PORT: ${port}`);
}
console.log(`   ADMIN_ID: ${ADMIN_ID}`);

if (!token) {
  console.error("❌ BOT_TOKEN is missing — the bot cannot start");
  process.exit(1);
}

if (!haToken) {
  console.warn("⚠️  HA_TOKEN is missing — Home Assistant functions will not work");
}

// ── Database check ────────────────────────────────────────

try {
  const userCount = (await getAllUsers()).length;
  console.log(`🗄️  — ${userCount} registered user(s)`);
} catch (e) {
  console.error("❌ Error opening database:", e);
  process.exit(1);
}

// ── Home Assistant connection test ────────────────────────

if (haToken) {
  checkConnection().then((r) => {
    if (r.success) {
      console.log(`🔌 Home Assistant: ✅ connection OK`);
    } else {
      console.log(`🔌 Home Assistant: ⚠️  ${r.error}`);
      console.log(`   ℹ️  Check that HA_URL is correct and HA_TOKEN is valid`);
      console.log(`   ℹ️  Current HA_URL: "${process.env.HA_URL}"`);
    }
  });
}

// ── Bot init ───────────────────────────────────────────────

const bot = new Bot<MyContext>(token);

bot.use(i18n.middleware());
bot.use(commands);

bot.catch((err) => {
  console.error("💥 Bot error:", err.error);
  if (err.error instanceof Error && err.error.stack) {
    console.error(err.error.stack);
  }
});

try {
  await bot.init();
  console.log(`🤖 Bot: @${bot.botInfo.username} (ID: ${bot.botInfo.id})`);
} catch (e) {
  console.error("❌ Could not connect to Telegram. Invalid token?", e);
  process.exit(1);
}

// ── Expiry cron ──────────────────────────────────────────

startExpiryCron(bot);

// ── Start mode ────────────────────────────────────────────

if (mode === "webhook") {
  if (!webhookUrl) {
    console.error("❌ WEBHOOK_URL environment variable is missing");
    process.exit(1);
  }

  const fullUrl = `${webhookUrl.replace(/\/+$/, "")}/webhook`;

  try {
    console.log("📡 Cleaning up previous webhook...");
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    console.log("✅ Previous webhook removed");
  } catch (e) {
    console.error("❌ Error cleaning up previous webhook:", e);
  }

  console.log(`🌐 Starting HTTP server on port ${port}...`);

  Bun.serve({
    port: parseInt(port),
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/webhook" && req.method === "POST") {
        try {
          const body = await req.text();
          const update = JSON.parse(body);
          bot.handleUpdate(update).catch((err) => {
            console.error("💥 Error processing update:", err);
          });
          return new Response("OK");
        } catch (e) {
          console.error("❌ Error in webhook request:", e);
          return new Response("Bad request", { status: 400 });
        }
      }
      return new Response("Not found", { status: 404 });
    },
  });

  console.log(`✅ HTTP server listening on port ${port}`);

  try {
    console.log("📡 Registering webhook with Telegram...");
    const result = await bot.api.setWebhook(fullUrl, {
      allowed_updates: ["message", "callback_query"],
    });
    if (result) {
      console.log(`✅ Webhook registered: ${fullUrl}`);
    } else {
      console.error("❌ Telegram rejected the webhook registration");
      process.exit(1);
    }
  } catch (e) {
    console.error("❌ Error registering webhook with Telegram:", e);
    console.log("");
    console.log("   📋 Possible causes:");
    console.log("   • The URL must be HTTPS (Telegram only accepts HTTPS)");
    console.log("   • The domain must point to this server (DNS)");
    console.log("   • Port 443 must be reachable from the internet");
    console.log("   • The firewall must not block incoming connections");
    console.log("");
    process.exit(1);
  }

  try {
    const info = await bot.api.getWebhookInfo();
    console.log(`📡 Webhook info:`);
    console.log(`   URL:              ${info.url}`);
    console.log(`   Pending updates:  ${info.pending_update_count}`);
    console.log(`   Last error:       ${info.last_error_message ?? "none"}`);
    console.log(`   Max connections:  ${info.max_connections ?? "40"}`);
    if (info.last_error_message) {
      console.log(`   ⚠️  Telegram reports a webhook error:`);
      console.log(`      ${info.last_error_message}`);
    }
    if (info.url !== fullUrl) {
      console.log(`   ⚠️  Registered URL does not match expected URL`);
      console.log(`      Expected: ${fullUrl}`);
      console.log(`      Actual:   ${info.url}`);
    }
  } catch (e) {
    console.error("❌ Could not verify webhook:", e);
  }
} else {
  console.log("🔄 Bot in polling mode — listening for updates...");
  bot.start({ drop_pending_updates: true });
}

console.log("=".repeat(50));
