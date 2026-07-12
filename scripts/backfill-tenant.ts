// scripts/backfill-tenant.ts
// One-time backfill: adopt PRE-tenancy rows (companyId IS NULL) into a single
// Company, so a workspace created by the old single-tenant signup keeps working
// after the multi-tenancy migration. Safe + idempotent: it only touches rows
// whose companyId is still null, and reports exactly what it changed.
//
// Run against the target DB (reads DATABASE_URL):  npx tsx scripts/backfill-tenant.ts
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/platform/database/generated/prisma/client';
import { slugify, dedupeSlug } from '../src/platform/database/slug';

// Raw client on purpose — no tenant extension — so we can see/stamp null rows.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Every tenant-owned model (camelCase accessor). Mirrors the Company back-relations.
const MODELS = [
  'employee', 'emergencyContact', 'user', 'leaveRequest', 'requisition',
  'requisitionApproval', 'hiringTeamMember', 'preScreenQuestion', 'candidate',
  'candidateResume', 'candidateNote', 'preScreenAnswer', 'communicationTemplate',
  'communicationLog', 'guideTemplateSection', 'scorecardCriterion', 'scorecardSubmission',
  'scorecardRating', 'recruitmentAuditEvent', 'performanceReview', 'pip', 'trainingCourse',
  'trainingAssignment', 'offboardingTask', 'agentRun', 'vaultDocument', 'salaryBenchmark',
  'companySettings', 'onboardingCase', 'checklistTask', 'caseDocument', 'consentEntry',
  'auditEntry', 'goal', 'goalUpdate', 'oneOnOne', 'feedbackRequest', 'kudos',
  'letterTemplate', 'calcRule',
] as const;

async function main(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  // 1. How many orphaned (null-tenant) rows are there?
  let orphans = 0;
  const perModel: Record<string, number> = {};
  for (const m of MODELS) {
    const n = await db[m].count({ where: { companyId: null } });
    perModel[m] = n;
    orphans += n;
  }
  console.log(`Orphaned (companyId IS NULL) rows: ${orphans}`);
  for (const m of MODELS) if (perModel[m] > 0) console.log(`  ${m}: ${perModel[m]}`);

  if (orphans === 0) {
    console.log('\nNothing to backfill — no pre-tenancy rows. The /admin error is NOT caused by null companyId; look elsewhere.');
    return;
  }

  // 2. Name + unique slug for the adopting company (from the old settings row).
  const settings = await db.companySettings.findFirst({ where: { companyId: null } });
  const name: string = settings?.companyName?.trim() || 'My Company';
  const base = slugify(name);
  const taken = new Set<string>((await prisma.company.findMany({ select: { slug: true } })).map((c) => c.slug));
  const slug = dedupeSlug(base, taken);

  // 3. Create the company, then stamp it onto every orphaned row (one transaction).
  const company = await prisma.company.create({ data: { name, slug } });
  console.log(`\nCreated company "${name}" (slug: ${slug}, id: ${company.id}). Stamping rows…`);

  const updates = MODELS.filter((m) => perModel[m] > 0).map((m) =>
    db[m].updateMany({ where: { companyId: null }, data: { companyId: company.id } }),
  );
  const results = await prisma.$transaction(updates);
  const stamped = results.reduce((s: number, r: { count: number }) => s + r.count, 0);

  console.log(`Backfill complete: ${stamped} rows adopted into ${company.id}.`);
  console.log('Reload /admin — the workspace should load now.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
