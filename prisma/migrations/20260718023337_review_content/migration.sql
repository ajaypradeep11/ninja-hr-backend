-- Performance review content: self/manager evaluations (additive, nullable).
ALTER TABLE "PerformanceReview" ADD COLUMN "selfEvaluation" TEXT;
ALTER TABLE "PerformanceReview" ADD COLUMN "managerEvaluation" TEXT;
