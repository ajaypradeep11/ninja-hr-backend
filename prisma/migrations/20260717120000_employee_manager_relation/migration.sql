-- `manager` was a free-text name that two access checks compared against the
-- actor's name — duplicates leaked and renames re-pointed access. Replace it
-- with a real link.
ALTER TABLE "Employee" ADD COLUMN "managerId" TEXT;

CREATE INDEX "Employee_managerId_idx" ON "Employee"("managerId");

ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill only where the name resolves to EXACTLY ONE employee in the SAME
-- company. Ambiguous or unmatched names stay null: a wrong link would hand
-- someone access to a stranger's record, which is the bug being fixed.
UPDATE "Employee" e
SET "managerId" = m."id"
FROM "Employee" m
WHERE m."name" = e."manager"
  AND m."companyId" IS NOT DISTINCT FROM e."companyId"
  AND m."id" <> e."id"
  AND (SELECT count(*) FROM "Employee" m2
       WHERE m2."name" = e."manager" AND m2."companyId" IS NOT DISTINCT FROM e."companyId") = 1;

-- A cycle would make the org chart render forever; none should exist, but a
-- self-link is trivially possible from the old free text.
UPDATE "Employee" SET "managerId" = NULL WHERE "managerId" = "id";

ALTER TABLE "Employee" DROP COLUMN "manager";
