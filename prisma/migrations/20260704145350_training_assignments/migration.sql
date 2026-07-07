-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED');

-- AlterTable
ALTER TABLE "TrainingCourse" DROP COLUMN "due",
DROP COLUMN "mandatory",
DROP COLUMN "progress",
DROP COLUMN "province",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "contentUrl" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "durationMins" INTEGER,
ADD COLUMN     "passMark" INTEGER;

-- CreateTable
CREATE TABLE "TrainingAssignment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "TrainingStatus" NOT NULL DEFAULT 'ASSIGNED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TrainingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingAssignment_employeeId_idx" ON "TrainingAssignment"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingAssignment_courseId_employeeId_key" ON "TrainingAssignment"("courseId", "employeeId");

-- AddForeignKey
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
