ALTER TABLE "CompanySettings" ALTER COLUMN "companyName" SET DEFAULT 'NinjaHR';

UPDATE "CompanySettings"
SET "companyName" = 'NinjaHR'
WHERE "id" = 'default'
  AND "companyName" = 'TestHR Inc.';
