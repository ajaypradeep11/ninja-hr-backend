-- CreateEnum
CREATE TYPE "GuideSection" AS ENUM ('TECHNICAL_FIT', 'CULTURE_ADD', 'COMMUNICATION', 'OVERALL');

-- CreateTable
CREATE TABLE "InterviewGuideEntry" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "authorId" TEXT,
    "section" "GuideSection" NOT NULL,
    "body" TEXT NOT NULL,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewGuideEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewGuideEntry_candidateId_idx" ON "InterviewGuideEntry"("candidateId");

-- AddForeignKey
ALTER TABLE "InterviewGuideEntry" ADD CONSTRAINT "InterviewGuideEntry_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewGuideEntry" ADD CONSTRAINT "InterviewGuideEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

