// Postgres target switch. Reads the DB_LIVE flag and rewrites DATABASE_URL /
// DIRECT_URL so every Prisma consumer — the runtime PrismaService, `prisma
// migrate`, and the seed — connect to the same database:
//
//   DB_LIVE=true   → LIVE_DATABASE_URL  (production / Cloud SQL)
//   DB_LIVE=false  → LOCAL_DATABASE_URL (local docker Postgres)
//
// Import this module for its side effect immediately after `dotenv/config`
// loads and before any Prisma client is constructed. It is a no-op (keeps the
// existing DATABASE_URL) when the selected URL isn't set, so plain
// DATABASE_URL-only setups (e.g. Cloud Run) keep working untouched.

const live = process.env.DB_LIVE === 'true';
const selected = live ? process.env.LIVE_DATABASE_URL : process.env.LOCAL_DATABASE_URL;

if (selected) {
  process.env.DATABASE_URL = selected;
  process.env.DIRECT_URL = selected;
   
  console.log(`[db] Postgres target: ${live ? 'LIVE' : 'LOCAL'} (DB_LIVE=${process.env.DB_LIVE}).`);
} else if (process.env.DB_LIVE !== undefined) {
  // Flag set but the matching URL is missing — warn loudly rather than silently
  // connecting to whatever DATABASE_URL happens to hold.
   
  console.warn(
    `[db] DB_LIVE=${process.env.DB_LIVE} but ${
      live ? 'LIVE_DATABASE_URL' : 'LOCAL_DATABASE_URL'
    } is not set — falling back to DATABASE_URL.`,
  );
}

export {};
