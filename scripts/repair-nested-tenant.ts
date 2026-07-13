// scripts/repair-nested-tenant.ts
// Repairs child rows created by NESTED Prisma writes before the explicit
// companyId stamping fix: the tenant extension only intercepts top-level
// operations, so rows nested under a parent create (checklist tasks, audit
// entries, requisition approvals, …) were born with companyId NULL. They
// display fine (relation includes bypass tenant scoping) but every scoped
// mutation matches 0 rows — "tasks show but can't be marked done".
//
// Fix: copy the PARENT row's companyId onto any NULL child. Safe + idempotent:
// only touches rows whose companyId IS NULL and whose parent has one. Unlike
// backfill-tenant.ts (single pre-tenancy workspace adoption), this is correct
// with any number of companies because tenancy is derived per-row from the
// parent, never guessed.
//
// Run against the target DB (reads DATABASE_URL):  npx tsx scripts/repair-nested-tenant.ts
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/platform/database/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** child table → [parent table, FK column on the child] (Prisma default table names). */
const LINKS: Record<string, [string, string]> = {
  ChecklistTask: ['OnboardingCase', 'caseId'],
  CaseDocument: ['OnboardingCase', 'caseId'],
  ConsentEntry: ['OnboardingCase', 'caseId'],
  AuditEntry: ['OnboardingCase', 'caseId'],
  RequisitionApproval: ['Requisition', 'requisitionId'],
  HiringTeamMember: ['Requisition', 'requisitionId'],
  PreScreenQuestion: ['Requisition', 'requisitionId'],
  ScorecardCriterion: ['Requisition', 'requisitionId'],
  Candidate: ['Requisition', 'requisitionId'],
  PreScreenAnswer: ['Candidate', 'candidateId'],
  CandidateResume: ['Candidate', 'candidateId'],
  CandidateNote: ['Candidate', 'candidateId'],
  ScorecardSubmission: ['Candidate', 'candidateId'],
  ScorecardRating: ['ScorecardSubmission', 'submissionId'],
  User: ['Employee', 'employeeId'],
  EmergencyContact: ['Employee', 'employeeId'],
};

async function main(): Promise<void> {
  let total = 0;
  for (const [child, [parent, fk]] of Object.entries(LINKS)) {
    const n = await prisma.$executeRawUnsafe(
      `UPDATE "${child}" c SET "companyId" = p."companyId"
         FROM "${parent}" p
        WHERE c."${fk}" = p."id"
          AND c."companyId" IS NULL
          AND p."companyId" IS NOT NULL`,
    );
    if (n > 0) console.log(`  ${child}: ${n} row(s) inherited companyId from ${parent}`);
    total += n;
  }
  console.log(
    total === 0
      ? 'Nothing to repair — no tenantless child rows with a tenanted parent.'
      : `\nRepair complete: ${total} row(s) fixed. Checklist tasks etc. are mutable again.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
