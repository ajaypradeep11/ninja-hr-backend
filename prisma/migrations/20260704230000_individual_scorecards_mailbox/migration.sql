-- CreateEnum
CREATE TYPE "CommDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- DropForeignKey
ALTER TABLE "InterviewGuideEntry" DROP CONSTRAINT "InterviewGuideEntry_authorId_fkey";

-- DropForeignKey
ALTER TABLE "InterviewGuideEntry" DROP CONSTRAINT "InterviewGuideEntry_candidateId_fkey";

-- AlterTable
ALTER TABLE "CommunicationLog" ADD COLUMN     "direction" "CommDirection" NOT NULL DEFAULT 'OUTBOUND',
ADD COLUMN     "fromAddress" TEXT;

-- DropTable
DROP TABLE "InterviewGuideEntry";

-- DropEnum
DROP TYPE "GuideSection";

