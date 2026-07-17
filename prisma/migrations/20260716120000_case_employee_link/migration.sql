-- Links an onboarding case to the Employee it provisions. Set at invite
-- acceptance (PRE_HIRE), so provisioning is idempotent by identity rather than
-- by email, and the new hire's own session can find their case.
ALTER TABLE "OnboardingCase" ADD COLUMN "employeeId" TEXT;

CREATE UNIQUE INDEX "OnboardingCase_employeeId_key" ON "OnboardingCase"("employeeId");

ALTER TABLE "OnboardingCase"
  ADD CONSTRAINT "OnboardingCase_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: cases activated before this column existed already created their
-- Employee, matched by the personalEmail the case was invited with. The column
-- is UNIQUE, so where several cases were invited with the same address only the
-- most recent one may claim that employee (DISTINCT ON picks exactly one).
UPDATE "OnboardingCase" c
SET "employeeId" = m."employeeId"
FROM (
  SELECT DISTINCT ON (e."id") c2."id" AS "caseId", e."id" AS "employeeId"
  FROM "OnboardingCase" c2
  JOIN "Employee" e ON e."email" = c2."personalEmail"
  ORDER BY e."id", c2."createdAt" DESC
) m
WHERE c."id" = m."caseId";
