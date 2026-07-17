import 'dotenv/config';
import './src/platform/database/resolve-db-env'; // rewrites DATABASE_URL/DIRECT_URL from DB_LIVE
import { assertNotLiveDb } from './src/platform/database/live-db.guard';
import { defineConfig } from 'prisma/config';

// Interlock for DESTRUCTIVE prisma commands against the live DB. This config
// runs inside the prisma CLI process, so argv carries the subcommand.
// `migrate deploy` stays allowed — applying migrations to live is a legitimate
// deployment step; `migrate dev` / `migrate reset` / `db push` can drop data.
// The seed guards itself (prisma/seed.ts). DB_LIVE_CONFIRM=yes overrides.
{
  const argv = process.argv.join(' ');
  const destructive = /migrate (dev|reset)|db push/.exec(argv)?.[0];
  if (destructive) assertNotLiveDb(`prisma ${destructive}`);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: process.env['DIRECT_URL'] || process.env['DATABASE_URL'] },
});
