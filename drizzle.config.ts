import { defineConfig } from "drizzle-kit";

const provider = process.env.DATABASE_PROVIDER || "sqlite";

export default defineConfig(
  provider === "postgres"
    ? {
        schema: "./src/db/schema-pg.ts",
        dialect: "postgresql",
        dbCredentials: {
          url: process.env.DATABASE_URL || "postgres://localhost:5432/home_unlock",
        },
      }
    : {
        schema: "./src/db/schema-sqlite.ts",
        dialect: "sqlite",
        dbCredentials: {
          url: process.env.DATABASE_URL || "bot.sqlite",
        },
      },
);
