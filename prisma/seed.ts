import { makeSeedClient, runSeed } from "./seed-fn";

// Always wipes and re-seeds. Used by `db:seed` / `db:seed:local` / `db:fresh`.
const prisma = makeSeedClient();

runSeed(prisma)
  .then(async (counts) => {
    console.log("Seeded:", JSON.stringify(counts, null, 2));
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
