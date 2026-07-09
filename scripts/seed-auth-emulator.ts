// scripts/seed-auth-emulator.ts — signs every seeded user up in the local
// Firebase Auth emulator so `npm run db:seed`'s demo data has matching
// credentials to log in with (work email / demo-password). Idempotent: a
// re-run against an already-seeded emulator gets 400 EMAIL_EXISTS, which is
// treated as success, not an error.
// Run: npm run seed:auth (requires the auth emulator + DB seed to be up).
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/platform/database/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? 'localhost:9099';
const DEMO_PASSWORD = 'demo-password';

async function main() {
  const users = await prisma.user.findMany({ include: { employee: true } });
  if (users.length === 0) {
    console.warn('No users found — run `npm run db:seed` before `npm run seed:auth`.');
    return;
  }
  for (const u of users) {
    const res = await fetch(
      `http://${HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: u.employee.email,
          password: DEMO_PASSWORD,
          returnSecureToken: false,
        }),
      },
    );
    // A fresh emulator returns 200; re-running against one that already has
    // the account returns 400 EMAIL_EXISTS — both are the desired end state.
    console.log(`${u.employee.email}: ${res.ok ? 'created' : 'exists'}`);
  }
}

main()
  .catch((e: unknown) => {
    console.error('seed-auth-emulator failed:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
