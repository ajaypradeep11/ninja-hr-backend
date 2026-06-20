import { makeSeedClient, runSeed } from "./seed-fn";

// Seeds only if the database is empty — safe to run on every `npm run dev`.
// (Re-seeding every start would wipe local changes; this preserves them.)
const prisma = makeSeedClient();

(async () => {
  const count = await prisma.employee.count();
  if (count > 0) {
    console.log(`Database already seeded (${count} employees) — skipping.`);
    return;
  }
  console.log("Empty database — seeding…");
  const counts = await runSeed(prisma);
  console.log("Seeded:", JSON.stringify(counts, null, 2));
})()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
