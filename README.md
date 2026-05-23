# 🏠 Home Unlock Bot

**A Telegram bot to manage home access via Home Assistant, with dynamic entities, multilingual support, and Docker deployment.**

---

## ✨ Features

- **Dynamic entity management** — Entities are stored in the database, discovered from Home Assistant or added manually. No hardcoded doors.
- **Per-user permissions** — Each user gets access to specific entities (locks, buttons, etc.) with an expiration date.
- **Admin panel** — Full Telegram menu to manage users, entities, pending requests, and settings.
- **Multilingual** — English and Spanish (auto-detected from Telegram language, with manual override via `/language`).
- **Database** — SQLite (default) or PostgreSQL via Drizzle ORM.
- **Docker** — Ready-to-deploy with Docker Compose.

---

## 📋 Prerequisites

- A **Telegram bot** token from [@BotFather](https://t.me/botfather)
- A **Home Assistant** instance with a Long-Lived Access Token
- [Bun](https://bun.sh) (for development) or [Docker](https://docker.com) (for deployment)

---

## 🚀 Quick start (local)

### 1. Clone and configure

```bash
git clone https://github.com/your-username/home-unlock.git
cd home-unlock
cp .env.example .env
# Edit .env with your token, URL, and admin ID
```

### 2. Install and run

```bash
bun install
bun run start
```

---

## 🐳 Docker

### SQLite (default)

```bash
docker compose up -d
```

The SQLite database is stored in a Docker volume (`bot-data`).

### PostgreSQL

```bash
docker compose --profile pg up -d
```

This starts both a PostgreSQL container and a bot instance configured for PostgreSQL.

Stop with:

```bash
docker compose --profile pg down
```

> **Note:** Only one bot instance can run at a time (same token). Stop the SQLite one first if switching.

### Manual build

```bash
docker build -t home-unlock-bot .
docker run --env-file .env -v bot-data:/app/data home-unlock-bot
```

---

## 🔧 Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BOT_TOKEN` | ✅ | — | Telegram bot token (from @BotFather) |
| `HA_URL` | ✅ | — | Home Assistant URL (e.g. `https://home.example.com`) |
| `HA_TOKEN` | ✅ | — | Home Assistant Long-Lived Access Token |
| `ADMIN_ID` | ✅ | — | Your Telegram numeric user ID |
| `DATABASE_PROVIDER` | ❌ | `sqlite` | `sqlite` or `postgres` |
| `DATABASE_URL` | ❌ | `bot.sqlite` | Connection string |
| `DB_PASSWORD` | ❌* | — | PostgreSQL password |
| `BOT_MODE` | ❌ | `polling` | `polling` or `webhook` |
| `WEBHOOK_URL` | ❌* | — | HTTPS URL for webhook mode |
| `PORT` | ❌ | `3000` | HTTP server port for webhook mode |

\* Required only when `DATABASE_PROVIDER=postgres` or `BOT_MODE=webhook`.

Copy `.env.example` to `.env` and fill in your values.

---

## 📖 Bot usage

### User commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/hora` | Current time (Spain) |
| `/language` | Change language |
| *any text* | Shows available entities (if you have access) |

### Admin commands

| Command | Description |
|---------|-------------|
| `/menu` | Open admin panel |
| `/menu` | Open admin panel |
| `/accept_<id>` | Accept a pending user request (ask for date + entities) |
| `/reject_<id>` | Reject a pending user request |
| `/restore_<id>` | Remove a denied user from the system |

### Admin panel

| Option | Description |
|--------|-------------|
| 📋 Users with permission | List all users and their status |
| ⏱ Remaining time | Show remaining access for each user |
| ❌ Remove access | Revoke a user's access |
| ➕ Add user | Manually add a user by Telegram ID |
| 🔄 Change access time | Modify a user's expiration date |
| ⏳ Pending | List pending requests with `/accept_<id>` and `/reject_<id>` |
| ❌ Denied | List denied users with `/restore_<id>` |
| 🏗️ Entities | Manage entities (discover, add, delete, sync names) |
| ✅/❌ Requests enabled | Toggle whether new user requests notify the admin |
| 🌐 Language | Change bot language |

### Entity management

- **Discover from HA** — Fetches compatible entities (lock, button, switch, cover, scene, automation, input_boolean) from Home Assistant. Locks appear first.
- **Add manually** — Enter an entity ID like `lock.my_door`.
- **Delete entity** — Remove an entity from the system.
- **Sync names** — Update entity names from Home Assistant's `friendly_name`.

---

## 🗄️ Database

### SQLite

No setup needed. The database is auto-created.

```
DATABASE_PROVIDER=sqlite
DATABASE_URL=bot.sqlite
```

### PostgreSQL

```
DATABASE_PROVIDER=postgres
DATABASE_URL=postgres://home_unlock:password@host:5432/home_unlock
```

### Drizzle commands

```bash
bun run db:generate    # Generate migration files
bun run db:push        # Push schema to database
bun run db:migrate     # Run pending migrations
bun run db:studio      # Open Drizzle Studio GUI
```

---

## 🌐 Multilingual

Supported languages: `en` (English), `es` (Spanish).

Language is auto-detected from the user's Telegram language code and stored in the database. Users can change it manually with `/language`.

To add a new language, create `src/locales/<code>.ftl` and translate all keys from `en.ftl`.

---

## 🗑️ Cleaning up

Before committing, you can safely delete local SQLite journal files and editor settings:

```bash
rm bot.sqlite-shm bot.sqlite-wal
rm -rf .vscode
```

These are auto-generated or local-only files. All are already in `.gitignore`.

---

## 🛠️ Development

```bash
bun run start          # Start the bot
bun run dev            # Watch mode (restarts on changes)
bun run db:studio      # Browse database with Drizzle Studio
```

## Project structure

```
src/
├── bot.ts              # Entry point
├── commands.ts         # Commands, admin menu, callbacks
├── actions.ts          # State machine (date input, entity selection)
├── expiry.ts           # Expiration cron
├── homeassistant.ts    # Home Assistant API client
├── i18n.ts             # Internationalization setup
├── types.ts            # TypeScript types
├── db/
│   ├── index.ts        # Database factory, CRUD, config
│   ├── sqlite-schema.ts
│   └── pg-schema.ts
└── locales/
    ├── en.ftl
    └── es.ftl
```

---

## 📄 License

Open source. Contributions welcome.
