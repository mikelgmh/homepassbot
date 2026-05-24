FROM oven/bun:latest AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS web-build
COPY astro.config.ts ./
COPY src/web src/web
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
RUN bun x astro build

FROM base
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY --from=web-build /app/dist ./dist
COPY config.yaml run.sh ./

RUN chmod +x run.sh

# In add-on mode, SUPERVISOR_TOKEN replaces HA_TOKEN
# Use run.sh to start both web and bot
CMD ["bash", "run.sh"]
