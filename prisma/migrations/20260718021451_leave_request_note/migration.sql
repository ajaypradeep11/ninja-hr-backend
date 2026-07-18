-- Add the employee free-text note to leave requests (additive, nullable).
ALTER TABLE "LeaveRequest" ADD COLUMN "note" TEXT;
