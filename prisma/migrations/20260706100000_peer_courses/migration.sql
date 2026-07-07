-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'REJECTED');

-- AlterTable
ALTER TABLE "TrainingCourse" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "status" "CourseStatus" NOT NULL DEFAULT 'PUBLISHED';

-- AddForeignKey
ALTER TABLE "TrainingCourse" ADD CONSTRAINT "TrainingCourse_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

