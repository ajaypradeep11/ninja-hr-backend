-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CandidateSource" AS ENUM ('CAREERS', 'INDEED', 'LINKEDIN');

-- CreateEnum
CREATE TYPE "TemplateTrigger" AS ENUM ('APPLICATION_RECEIVED', 'INTERVIEW_SCHEDULED', 'REJECTED', 'MANUAL');

-- CreateEnum
CREATE TYPE "Recommendation" AS ENUM ('STRONG_YES', 'YES', 'NO', 'STRONG_NO');

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "anonymizedAt" TIMESTAMP(3),
ADD COLUMN     "consentAt" TIMESTAMP(3),
ADD COLUMN     "consentVersion" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "portalToken" TEXT,
ADD COLUMN     "resumeText" TEXT,
ADD COLUMN     "source" "CandidateSource" NOT NULL DEFAULT 'CAREERS',
ADD COLUMN     "withdrawnAt" TIMESTAMP(3),
ALTER COLUMN "matchScore" SET DEFAULT 0,
ALTER COLUMN "appliedDate" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Requisition" ADD COLUMN     "costOfHire" INTEGER,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "indeedEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "indeedUrl" TEXT,
ADD COLUMN     "jd" TEXT,
ADD COLUMN     "linkedinEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionFeedback" TEXT,
ADD COLUMN     "slug" TEXT;

-- CreateTable
CREATE TABLE "RequisitionApproval" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "RequisitionApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiringTeamMember" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "isPanelMember" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "HiringTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreScreenQuestion" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "question" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PreScreenQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreScreenAnswer" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,

    CONSTRAINT "PreScreenAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "trigger" "TemplateTrigger" NOT NULL DEFAULT 'MANUAL',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CommunicationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationLog" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "templateId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentById" TEXT,
    "visibleToCandidate" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScorecardCriterion" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ScorecardCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScorecardSubmission" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "panelistId" TEXT NOT NULL,
    "recommendation" "Recommendation" NOT NULL,
    "overallNotes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScorecardSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScorecardRating" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "ScorecardRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentAuditEvent" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT,
    "candidateId" TEXT,
    "actorId" TEXT,
    "event" TEXT NOT NULL,
    "detail" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequisitionApproval_requisitionId_idx" ON "RequisitionApproval"("requisitionId");

-- CreateIndex
CREATE INDEX "RequisitionApproval_approverId_idx" ON "RequisitionApproval"("approverId");

-- CreateIndex
CREATE UNIQUE INDEX "RequisitionApproval_requisitionId_approverId_key" ON "RequisitionApproval"("requisitionId", "approverId");

-- CreateIndex
CREATE INDEX "HiringTeamMember_requisitionId_idx" ON "HiringTeamMember"("requisitionId");

-- CreateIndex
CREATE INDEX "HiringTeamMember_employeeId_idx" ON "HiringTeamMember"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "HiringTeamMember_requisitionId_employeeId_key" ON "HiringTeamMember"("requisitionId", "employeeId");

-- CreateIndex
CREATE INDEX "PreScreenQuestion_requisitionId_idx" ON "PreScreenQuestion"("requisitionId");

-- CreateIndex
CREATE UNIQUE INDEX "PreScreenAnswer_candidateId_questionId_key" ON "PreScreenAnswer"("candidateId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationTemplate_name_key" ON "CommunicationTemplate"("name");

-- CreateIndex
CREATE INDEX "CommunicationLog_candidateId_idx" ON "CommunicationLog"("candidateId");

-- CreateIndex
CREATE INDEX "ScorecardCriterion_requisitionId_idx" ON "ScorecardCriterion"("requisitionId");

-- CreateIndex
CREATE INDEX "ScorecardSubmission_candidateId_idx" ON "ScorecardSubmission"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "ScorecardSubmission_candidateId_panelistId_key" ON "ScorecardSubmission"("candidateId", "panelistId");

-- CreateIndex
CREATE UNIQUE INDEX "ScorecardRating_submissionId_criterionId_key" ON "ScorecardRating"("submissionId", "criterionId");

-- CreateIndex
CREATE INDEX "RecruitmentAuditEvent_requisitionId_idx" ON "RecruitmentAuditEvent"("requisitionId");

-- CreateIndex
CREATE INDEX "RecruitmentAuditEvent_candidateId_idx" ON "RecruitmentAuditEvent"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_portalToken_key" ON "Candidate"("portalToken");

-- CreateIndex
CREATE UNIQUE INDEX "Requisition_slug_key" ON "Requisition"("slug");

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionApproval" ADD CONSTRAINT "RequisitionApproval_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionApproval" ADD CONSTRAINT "RequisitionApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringTeamMember" ADD CONSTRAINT "HiringTeamMember_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringTeamMember" ADD CONSTRAINT "HiringTeamMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreScreenQuestion" ADD CONSTRAINT "PreScreenQuestion_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreScreenAnswer" ADD CONSTRAINT "PreScreenAnswer_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreScreenAnswer" ADD CONSTRAINT "PreScreenAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "PreScreenQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CommunicationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScorecardCriterion" ADD CONSTRAINT "ScorecardCriterion_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScorecardSubmission" ADD CONSTRAINT "ScorecardSubmission_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScorecardSubmission" ADD CONSTRAINT "ScorecardSubmission_panelistId_fkey" FOREIGN KEY ("panelistId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScorecardRating" ADD CONSTRAINT "ScorecardRating_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ScorecardSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScorecardRating" ADD CONSTRAINT "ScorecardRating_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "ScorecardCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentAuditEvent" ADD CONSTRAINT "RecruitmentAuditEvent_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentAuditEvent" ADD CONSTRAINT "RecruitmentAuditEvent_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
