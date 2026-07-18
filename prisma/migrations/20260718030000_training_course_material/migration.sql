-- Training courses can carry an uploaded material file (PDF/slides) alongside
-- the optional external content link. Additive + nullable: existing courses
-- stay valid and simply have no attached file. Bytes are stored inline,
-- mirroring VaultDocument; list reads omit "materialData".
ALTER TABLE "TrainingCourse" ADD COLUMN "materialFileName" TEXT;
ALTER TABLE "TrainingCourse" ADD COLUMN "materialMimeType" TEXT;
ALTER TABLE "TrainingCourse" ADD COLUMN "materialSize" INTEGER;
ALTER TABLE "TrainingCourse" ADD COLUMN "materialData" BYTEA;
