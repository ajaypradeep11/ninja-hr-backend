-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "EmergencyContact" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Requisition" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "RequisitionApproval" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "HiringTeamMember" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "PreScreenQuestion" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "CandidateResume" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "CandidateNote" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "PreScreenAnswer" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "CommunicationTemplate" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "CommunicationLog" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "GuideTemplateSection" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "ScorecardCriterion" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "ScorecardSubmission" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "ScorecardRating" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "RecruitmentAuditEvent" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "PerformanceReview" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Pip" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "TrainingCourse" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "TrainingAssignment" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "OffboardingTask" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "AgentRun" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "VaultDocument" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "SalaryBenchmark" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "companyId" TEXT,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OnboardingCase" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "ChecklistTask" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "CaseDocument" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "ConsentEntry" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "AuditEntry" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "GoalUpdate" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "OneOnOne" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "FeedbackRequest" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Kudos" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "LetterTemplate" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "CalcRule" ADD COLUMN     "companyId" TEXT;

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Employee_companyId_idx" ON "Employee"("companyId");

-- CreateIndex
CREATE INDEX "EmergencyContact_companyId_idx" ON "EmergencyContact"("companyId");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "LeaveRequest_companyId_idx" ON "LeaveRequest"("companyId");

-- CreateIndex
CREATE INDEX "Requisition_companyId_idx" ON "Requisition"("companyId");

-- CreateIndex
CREATE INDEX "RequisitionApproval_companyId_idx" ON "RequisitionApproval"("companyId");

-- CreateIndex
CREATE INDEX "HiringTeamMember_companyId_idx" ON "HiringTeamMember"("companyId");

-- CreateIndex
CREATE INDEX "PreScreenQuestion_companyId_idx" ON "PreScreenQuestion"("companyId");

-- CreateIndex
CREATE INDEX "Candidate_companyId_idx" ON "Candidate"("companyId");

-- CreateIndex
CREATE INDEX "CandidateResume_companyId_idx" ON "CandidateResume"("companyId");

-- CreateIndex
CREATE INDEX "CandidateNote_companyId_idx" ON "CandidateNote"("companyId");

-- CreateIndex
CREATE INDEX "PreScreenAnswer_companyId_idx" ON "PreScreenAnswer"("companyId");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_companyId_idx" ON "CommunicationTemplate"("companyId");

-- CreateIndex
CREATE INDEX "CommunicationLog_companyId_idx" ON "CommunicationLog"("companyId");

-- CreateIndex
CREATE INDEX "GuideTemplateSection_companyId_idx" ON "GuideTemplateSection"("companyId");

-- CreateIndex
CREATE INDEX "ScorecardCriterion_companyId_idx" ON "ScorecardCriterion"("companyId");

-- CreateIndex
CREATE INDEX "ScorecardSubmission_companyId_idx" ON "ScorecardSubmission"("companyId");

-- CreateIndex
CREATE INDEX "ScorecardRating_companyId_idx" ON "ScorecardRating"("companyId");

-- CreateIndex
CREATE INDEX "RecruitmentAuditEvent_companyId_idx" ON "RecruitmentAuditEvent"("companyId");

-- CreateIndex
CREATE INDEX "PerformanceReview_companyId_idx" ON "PerformanceReview"("companyId");

-- CreateIndex
CREATE INDEX "Pip_companyId_idx" ON "Pip"("companyId");

-- CreateIndex
CREATE INDEX "TrainingCourse_companyId_idx" ON "TrainingCourse"("companyId");

-- CreateIndex
CREATE INDEX "TrainingAssignment_companyId_idx" ON "TrainingAssignment"("companyId");

-- CreateIndex
CREATE INDEX "OffboardingTask_companyId_idx" ON "OffboardingTask"("companyId");

-- CreateIndex
CREATE INDEX "AgentRun_companyId_idx" ON "AgentRun"("companyId");

-- CreateIndex
CREATE INDEX "VaultDocument_companyId_idx" ON "VaultDocument"("companyId");

-- CreateIndex
CREATE INDEX "SalaryBenchmark_companyId_idx" ON "SalaryBenchmark"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySettings_companyId_key" ON "CompanySettings"("companyId");

-- CreateIndex
CREATE INDEX "OnboardingCase_companyId_idx" ON "OnboardingCase"("companyId");

-- CreateIndex
CREATE INDEX "ChecklistTask_companyId_idx" ON "ChecklistTask"("companyId");

-- CreateIndex
CREATE INDEX "CaseDocument_companyId_idx" ON "CaseDocument"("companyId");

-- CreateIndex
CREATE INDEX "ConsentEntry_companyId_idx" ON "ConsentEntry"("companyId");

-- CreateIndex
CREATE INDEX "AuditEntry_companyId_idx" ON "AuditEntry"("companyId");

-- CreateIndex
CREATE INDEX "Goal_companyId_idx" ON "Goal"("companyId");

-- CreateIndex
CREATE INDEX "GoalUpdate_companyId_idx" ON "GoalUpdate"("companyId");

-- CreateIndex
CREATE INDEX "OneOnOne_companyId_idx" ON "OneOnOne"("companyId");

-- CreateIndex
CREATE INDEX "FeedbackRequest_companyId_idx" ON "FeedbackRequest"("companyId");

-- CreateIndex
CREATE INDEX "Kudos_companyId_idx" ON "Kudos"("companyId");

-- CreateIndex
CREATE INDEX "LetterTemplate_companyId_idx" ON "LetterTemplate"("companyId");

-- CreateIndex
CREATE INDEX "CalcRule_companyId_idx" ON "CalcRule"("companyId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionApproval" ADD CONSTRAINT "RequisitionApproval_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringTeamMember" ADD CONSTRAINT "HiringTeamMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreScreenQuestion" ADD CONSTRAINT "PreScreenQuestion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateResume" ADD CONSTRAINT "CandidateResume_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateNote" ADD CONSTRAINT "CandidateNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreScreenAnswer" ADD CONSTRAINT "PreScreenAnswer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationTemplate" ADD CONSTRAINT "CommunicationTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuideTemplateSection" ADD CONSTRAINT "GuideTemplateSection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScorecardCriterion" ADD CONSTRAINT "ScorecardCriterion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScorecardSubmission" ADD CONSTRAINT "ScorecardSubmission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScorecardRating" ADD CONSTRAINT "ScorecardRating_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentAuditEvent" ADD CONSTRAINT "RecruitmentAuditEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pip" ADD CONSTRAINT "Pip_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCourse" ADD CONSTRAINT "TrainingCourse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffboardingTask" ADD CONSTRAINT "OffboardingTask_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultDocument" ADD CONSTRAINT "VaultDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryBenchmark" ADD CONSTRAINT "SalaryBenchmark_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingCase" ADD CONSTRAINT "OnboardingCase_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTask" ADD CONSTRAINT "ChecklistTask_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDocument" ADD CONSTRAINT "CaseDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentEntry" ADD CONSTRAINT "ConsentEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalUpdate" ADD CONSTRAINT "GoalUpdate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneOnOne" ADD CONSTRAINT "OneOnOne_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRequest" ADD CONSTRAINT "FeedbackRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kudos" ADD CONSTRAINT "Kudos_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterTemplate" ADD CONSTRAINT "LetterTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalcRule" ADD CONSTRAINT "CalcRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

