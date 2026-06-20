-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('VACATION', 'SICK', 'PERSONAL', 'PARENTAL', 'BEREAVEMENT');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "ReqStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "CandidateStage" AS ENUM ('APPLIED', 'AI_SCREENED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewState" AS ENUM ('DRAFT', 'SELF_EVALUATION', 'MANAGER_EVALUATION', 'CALIBRATED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PipState" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OffboardingOwner" AS ENUM ('MANAGER', 'IT_OPS', 'HR_PAYROLL');

-- CreateEnum
CREATE TYPE "CarrierStatus" AS ENUM ('CONNECTED', 'FILE_BASED', 'NOT_CONNECTED');

-- CreateEnum
CREATE TYPE "CarrierMethod" AS ENUM ('API', 'CSV_SFTP');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('RUNNING', 'AWAITING_APPROVAL', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DocAccess" AS ENUM ('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'SUPER_ADMIN');

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "days" INTEGER NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requisition" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "province" "Province" NOT NULL,
    "type" "EmploymentType" NOT NULL,
    "salaryMin" INTEGER NOT NULL,
    "salaryMax" INTEGER NOT NULL,
    "status" "ReqStatus" NOT NULL DEFAULT 'DRAFT',
    "applicants" INTEGER NOT NULL DEFAULT 0,
    "openedDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "stage" "CandidateStage" NOT NULL DEFAULT 'APPLIED',
    "matchScore" INTEGER NOT NULL,
    "appliedDate" TIMESTAMP(3) NOT NULL,
    "interviewDate" TIMESTAMP(3),
    "strengths" TEXT[],
    "gaps" TEXT[],

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceReview" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "cycle" TEXT NOT NULL,
    "state" "ReviewState" NOT NULL DEFAULT 'DRAFT',
    "score" DOUBLE PRECISION,
    "due" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pip" (
    "id" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "employeeId" TEXT,
    "manager" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "state" "PipState" NOT NULL DEFAULT 'DRAFT',
    "signedByManager" BOOLEAN NOT NULL DEFAULT false,
    "signedByEmployee" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingCourse" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "province" "Province",
    "due" TIMESTAMP(3),

    CONSTRAINT "TrainingCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OffboardingTask" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "owner" "OffboardingOwner" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "blocking" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OffboardingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenefitsCarrier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CarrierStatus" NOT NULL,
    "enrolled" INTEGER NOT NULL DEFAULT 0,
    "method" "CarrierMethod" NOT NULL,
    "lastSync" TEXT NOT NULL,

    CONSTRAINT "BenefitsCarrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "status" "AgentStatus" NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "affected" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT NOT NULL,
    "time" TEXT NOT NULL,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultDocument" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "access" "DocAccess" NOT NULL,
    "uploaded" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT,

    CONSTRAINT "VaultDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryBenchmark" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "low" INTEGER NOT NULL,
    "high" INTEGER NOT NULL,
    "current" INTEGER NOT NULL,

    CONSTRAINT "SalaryBenchmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_idx" ON "LeaveRequest"("employeeId");

-- CreateIndex
CREATE INDEX "Candidate_requisitionId_idx" ON "Candidate"("requisitionId");

-- CreateIndex
CREATE INDEX "PerformanceReview_employeeId_idx" ON "PerformanceReview"("employeeId");

-- CreateIndex
CREATE INDEX "VaultDocument_employeeId_idx" ON "VaultDocument"("employeeId");

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultDocument" ADD CONSTRAINT "VaultDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
