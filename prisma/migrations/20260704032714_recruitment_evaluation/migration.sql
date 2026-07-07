-- CreateEnum
CREATE TYPE "ResumeParseStatus" AS ENUM ('PENDING', 'PARSED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ScorecardStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- AlterTable
ALTER TABLE "ScorecardSubmission" ADD COLUMN     "interviewDate" TIMESTAMP(3),
ADD COLUMN     "status" "ScorecardStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "CandidateResume" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "parsedPhone" TEXT,
    "parsedSkills" TEXT[],
    "parsedWorkHistory" JSONB,
    "parseStatus" "ResumeParseStatus" NOT NULL DEFAULT 'PENDING',
    "parsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateResume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateNote" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CandidateResume_candidateId_key" ON "CandidateResume"("candidateId");

-- CreateIndex
CREATE INDEX "CandidateNote_candidateId_idx" ON "CandidateNote"("candidateId");

-- AddForeignKey
ALTER TABLE "CandidateResume" ADD CONSTRAINT "CandidateResume_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateNote" ADD CONSTRAINT "CandidateNote_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateNote" ADD CONSTRAINT "CandidateNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
