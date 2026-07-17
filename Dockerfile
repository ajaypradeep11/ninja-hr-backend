# NinjaHR backend (NestJS + Prisma). Two images from one file:
#
#   --target runtime (default)  → slim serving image: prod deps + dist only.
#                                 CMD is just `node dist/main` — migrations are
#                                 NOT run here (see the ops image below), so the
#                                 runtime DB user needs no DDL rights and
#                                 concurrent Cloud Run cold-starts can't race
#                                 `migrate deploy`.
#   --target ops                → full toolchain image (prisma CLI, tsx, seed,
#                                 schema/migrations). CI runs this as a Cloud Run
#                                 job with `npx prisma migrate deploy` BEFORE
#                                 deploying the runtime image. Also handy for
#                                 one-off seeds against Cloud SQL.
FROM node:22-bookworm-slim AS build
WORKDIR /app
# openssl is needed by Prisma tooling
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run prisma:generate && npm run build

# ── Ops image: migrations + seed (full node_modules incl. prisma CLI + tsx) ──
FROM build AS ops
ENV NODE_ENV=production
RUN chown -R node:node /app
USER node
# Default is the CI migration step; a one-off seed overrides the command:
#   npx tsx prisma/seed.ts   (guarded by live-db.guard — needs DB_LIVE_CONFIRM=yes)
CMD ["npx", "prisma", "migrate", "deploy"]

# ── Runtime image: serve only ────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY package*.json ./
# Production dependencies only — no prisma CLI, tsx, jest, eslint, compilers.
# The generated Prisma client compiles into dist (engine-less driver adapter),
# so the runtime needs neither the schema nor the generator output from src.
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Drop root: run as the image's built-in non-root `node` user so a compromised
# process is not uid 0 inside the container.
RUN chown -R node:node /app
USER node
EXPOSE 4000
CMD ["node", "dist/main"]
