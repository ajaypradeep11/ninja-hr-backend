# NinjaHR backend (NestJS + Prisma). Single image: generates the Prisma client,
# builds, then on start applies migrations and runs the compiled server.
FROM node:22-bookworm-slim AS build
WORKDIR /app
# openssl is needed by Prisma's query engine
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run prisma:generate && npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
# Bring the full build output: dist, node_modules (incl. prisma CLI for migrate deploy
# and the generated client), schema/migrations, and prisma.config.ts.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/package.json ./package.json
# The seed (tsx prisma/seed.ts) imports the generated client from src/, so ship it too.
COPY --from=build /app/src/platform/database/generated ./src/platform/database/generated
# scripts/seed-auth-emulator.ts (run via `npx tsx` by the compose seed override)
# also imports the generated client, and needs tsx itself (a devDependency —
# present because npm ci above installs the full node_modules, not --omit=dev).
COPY --from=build /app/scripts ./scripts
EXPOSE 4000
# Apply any pending migrations, then start. DATABASE_URL/DIRECT_URL come from compose env.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
