#!/usr/bin/env bash
set -e

cd /app

# Start Astro web server in background
bun run dist/server/entry.mjs &
WEB_PID=$!

# Start bot in foreground
exec bun run src/bot.ts
