// src/platform/database/live-db.guard.ts
// Safety interlock for destructive tooling (seed, e2e, migrate dev/reset).
// The DB_LIVE switch in resolve-db-env.ts rewrites DATABASE_URL for EVERY
// Prisma consumer — including the seed and the e2e suite — so one flag flip
// on a laptop would otherwise point demo-data writes and test churn at the
// production database. These helpers make that a loud, explicit choice.

/** True when the resolved DATABASE_URL targets the live (production) DB. */
export function isLiveDbTarget(): boolean {
  if (process.env.DB_LIVE === 'true') return true;
  const url = process.env.DATABASE_URL;
  const live = process.env.LIVE_DATABASE_URL;
  return Boolean(url && live && url === live);
}

/**
 * Refuse to proceed when targeting the live DB, unless the operator has set
 * DB_LIVE_CONFIRM=yes for this invocation. `context` names the tool in the
 * error (e.g. "db:seed", "e2e suite", "prisma migrate dev").
 */
export function assertNotLiveDb(context: string): void {
  if (!isLiveDbTarget()) return;
  if (process.env.DB_LIVE_CONFIRM === 'yes') {
    console.warn(
      `[db] WARNING: ${context} is running against the LIVE database (DB_LIVE_CONFIRM=yes).`,
    );
    return;
  }
  throw new Error(
    `[db] REFUSING to run ${context} against the LIVE database.\n` +
      `DATABASE_URL currently resolves to the production target (DB_LIVE=${process.env.DB_LIVE ?? 'unset'}).\n` +
      `If you REALLY mean to do this, re-run with DB_LIVE_CONFIRM=yes. ` +
      `Otherwise set DB_LIVE=false (or fix .env) and try again.`,
  );
}
