# ninja-hr-backend
NestJS (DDD + CQRS) backend for NinjaHR. Owns Postgres via Prisma.
Open the repo pair via `../ninja-hr.code-workspace`.

Dev setup:
```bash
npm i
npm run db:up            # start Postgres in Docker (waits until healthy)
npm run prisma:migrate   # apply migrations
npm run prisma:generate  # regenerate the Prisma client (required after schema changes / fresh clone)
npm run db:seed          # idempotent demo data (safe to re-run)
npm run start:dev        # → http://localhost:4000/api/v1/health, Swagger at /api/docs
```

Firebase Auth locally (email/password sign-in for the seeded demo users):
```bash
firebase emulators:start --only auth --project demo-ninjahr   # port 9099
npm run seed:auth        # signs every seeded user's work email up with demo-password
```
Set `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099` and `FIREBASE_PROJECT_ID=demo-ninjahr`
in `.env` (or leave `FIREBASE_AUTH_DISABLED=1` to skip auth entirely). Under
`docker compose up --build` this is already wired — the `firebase-auth`
service and the seed step both run automatically; **demo login is any seeded
work email (e.g. `sarah.mitchell@company.ca`) / `demo-password`**.

Tests:
```bash
npm test                 # unit tests (domain services + mappers)
npm run test:e2e         # HTTP e2e suite (test/*.e2e-spec.ts) — needs the local DB up, migrated and seeded (db:up + prisma:migrate + db:seed)
```

