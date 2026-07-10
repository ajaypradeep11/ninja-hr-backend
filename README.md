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

## Deployment

This is a NestJS service — **Firebase App Hosting can't run it** (App Hosting
is Next.js-only); **Cloud Run + Cloud SQL is the pairing**:

```bash
# One-time: a Cloud SQL for PostgreSQL instance, then run prisma migrate deploy
# against it (from a machine that can reach it, e.g. via the Cloud SQL Auth Proxy).
gcloud run deploy ninja-hr-api \
  --source . \
  --region YOUR_REGION \
  --add-cloudsql-instances YOUR_PROJECT:YOUR_REGION:YOUR_INSTANCE \
  --set-env-vars DATABASE_URL="postgresql://...@localhost/testhr?host=/cloudsql/YOUR_PROJECT:YOUR_REGION:YOUR_INSTANCE" \
  --set-env-vars FIREBASE_PROJECT_ID=YOUR_PROJECT_ID \
  --set-secrets INTERNAL_API_KEY=internal-api-key:latest
```

Notes:
- Prefer `--set-secrets` (Secret Manager) over `--set-env-vars` for anything
  sensitive (`INTERNAL_API_KEY`, database passwords if split out of the URL).
- Do **not** set `FIREBASE_AUTH_EMULATOR_HOST` or `FIREBASE_AUTH_DISABLED` in
  production — the service should verify real Firebase tokens.
- On Cloud Run, the Firebase Admin SDK uses application default credentials.
  Only set `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` when running
  outside Google-managed runtime credentials.
- The frontend's `NINJA_HR_API_URL` (in its own `apphosting.yaml`) must point
  at this Cloud Run service's URL.
- For the full frontend/backend deployment sequence, see `../DEPLOYMENT.md`.
