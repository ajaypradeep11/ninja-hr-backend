-- Participatory review flow: submission + acknowledgment timestamps (additive).
ALTER TABLE "PerformanceReview" ADD COLUMN "selfSubmittedAt" TIMESTAMP(3);
ALTER TABLE "PerformanceReview" ADD COLUMN "managerSubmittedAt" TIMESTAMP(3);
ALTER TABLE "PerformanceReview" ADD COLUMN "acknowledgedAt" TIMESTAMP(3);
