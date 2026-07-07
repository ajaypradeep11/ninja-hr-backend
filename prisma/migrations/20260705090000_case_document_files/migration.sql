-- AlterTable
ALTER TABLE "CaseDocument" ADD COLUMN     "data" BYTEA,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "size" INTEGER;

