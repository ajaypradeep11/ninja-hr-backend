-- AlterTable
ALTER TABLE "ScorecardCriterion" ADD COLUMN     "guidance" TEXT;

-- CreateTable
CREATE TABLE "GuideTemplateSection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER,
    "guidance" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "GuideTemplateSection_pkey" PRIMARY KEY ("id")
);

