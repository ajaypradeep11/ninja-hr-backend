-- CreateEnum
CREATE TYPE "Province" AS ENUM ('ON', 'BC', 'AB', 'QC', 'SK', 'MB', 'NS', 'NB');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'PRE_HIRE', 'ON_STATUTORY_LEAVE', 'OFFBOARDING', 'TERMINATED');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('INVITED', 'FORMS_IN_PROGRESS', 'PENDING_VERIFICATION', 'READY_TO_ACTIVATE', 'ACTIVE');

-- CreateEnum
CREATE TYPE "TaskOwner" AS ENUM ('HR', 'FINANCE', 'IT_OPS', 'MANAGER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DataAccess" AS ENUM ('GENERAL', 'BANKING', 'MEDICAL');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('PENDING', 'NEEDS_VERIFICATION', 'VERIFIED');

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "province" "Province" NOT NULL,
    "email" TEXT NOT NULL,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "manager" TEXT,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "salary" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingCase" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "province" "Province" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "personalEmail" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'INVITED',
    "forms" JSONB NOT NULL,
    "policiesAttached" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTask" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "owner" "TaskOwner" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "dataAccess" "DataAccess" NOT NULL DEFAULT 'GENERAL',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChecklistTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseDocument" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "status" "DocStatus" NOT NULL DEFAULT 'NEEDS_VERIFICATION',
    "signedAt" TIMESTAMP(3),
    "signedBy" TEXT,
    "ip" TEXT,

    CONSTRAINT "CaseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentEntry" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "policy" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT NOT NULL,

    CONSTRAINT "ConsentEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event" TEXT NOT NULL,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingCase_token_key" ON "OnboardingCase"("token");

-- CreateIndex
CREATE INDEX "ChecklistTask_caseId_idx" ON "ChecklistTask"("caseId");

-- CreateIndex
CREATE INDEX "CaseDocument_caseId_idx" ON "CaseDocument"("caseId");

-- CreateIndex
CREATE INDEX "ConsentEntry_caseId_idx" ON "ConsentEntry"("caseId");

-- CreateIndex
CREATE INDEX "AuditEntry_caseId_idx" ON "AuditEntry"("caseId");

-- AddForeignKey
ALTER TABLE "ChecklistTask" ADD CONSTRAINT "ChecklistTask_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OnboardingCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDocument" ADD CONSTRAINT "CaseDocument_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OnboardingCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentEntry" ADD CONSTRAINT "ConsentEntry_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OnboardingCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OnboardingCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
