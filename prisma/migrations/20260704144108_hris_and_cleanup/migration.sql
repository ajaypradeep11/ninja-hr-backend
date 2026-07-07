-- CreateEnum
CREATE TYPE "PayFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'SEMIMONTHLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "WorkEligibility" AS ENUM ('CITIZEN', 'PERMANENT_RESIDENT', 'WORK_PERMIT', 'STUDY_PERMIT');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "addressCity" TEXT,
ADD COLUMN     "addressPostal" TEXT,
ADD COLUMN     "addressProvince" "Province",
ADD COLUMN     "addressStreet" TEXT,
ADD COLUMN     "bankAccount" TEXT,
ADD COLUMN     "bankInstitution" TEXT,
ADD COLUMN     "bankTransit" TEXT,
ADD COLUMN     "employeeNumber" TEXT,
ADD COLUMN     "employmentType" "EmploymentType",
ADD COLUMN     "payFrequency" "PayFrequency",
ADD COLUMN     "personalEmail" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "preferredName" TEXT,
ADD COLUMN     "pronouns" TEXT,
ADD COLUMN     "sin" TEXT,
ADD COLUMN     "td1FederalOnFile" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "td1ProvincialOnFile" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "workEligibility" "WorkEligibility",
ADD COLUMN     "workLocation" TEXT,
ADD COLUMN     "workPermitExpiry" TIMESTAMP(3);

-- DropTable
DROP TABLE "BenefitsCarrier";

-- DropEnum
DROP TYPE "CarrierMethod";

-- DropEnum
DROP TYPE "CarrierStatus";

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "altPhone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmergencyContact_employeeId_idx" ON "EmergencyContact"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
