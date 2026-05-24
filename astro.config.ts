import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  integrations: [react()],
  output: "server",
  adapter: node({ mode: "standalone" }),
  srcDir: "src/web",
  publicDir: "src/web/public",
  outDir: "dist",
  server: {
    port: parseInt(process.env.PORT || "8099"),
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": "/src",
      },
    },
    ssr: {
      external: ["bun:sqlite", "drizzle-orm/bun-sqlite"],
    },
  },
});
