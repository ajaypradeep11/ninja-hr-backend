-- OnboardingCase.employeeId was introduced UNIQUE, which asserted "one case per
-- employee forever". That is not true: a rehire (or any second case opened for
-- the same person) links a new case to the existing Employee and blew up on the
-- unique index — surfacing as a 500 at activation. One employee, many cases
-- over time; reads take the newest.
DROP INDEX "OnboardingCase_employeeId_key";

CREATE INDEX "OnboardingCase_employeeId_idx" ON "OnboardingCase"("employeeId");

-- The introducing migration could only backfill ONE case per employee (the
-- unique index forbade more). Now that many are allowed, link the rest.
UPDATE "OnboardingCase" c
SET "employeeId" = e."id"
FROM "Employee" e
WHERE e."email" = c."personalEmail"
  AND c."employeeId" IS NULL;
