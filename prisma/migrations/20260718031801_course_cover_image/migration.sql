-- Optional course cover image (additive, nullable).
ALTER TABLE "TrainingCourse" ADD COLUMN "coverImageMimeType" TEXT;
ALTER TABLE "TrainingCourse" ADD COLUMN "coverImageData" BYTEA;
