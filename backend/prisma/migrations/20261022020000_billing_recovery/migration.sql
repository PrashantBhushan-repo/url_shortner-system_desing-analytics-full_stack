CREATE TABLE "BillingRecoveryJob" (
  "id" TEXT PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "user_id" TEXT,
  "due_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease_until" TIMESTAMP(3),
  "lease_token" TEXT,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "review_required" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BillingRecoveryJob_due_at_idx" ON "BillingRecoveryJob"("due_at");
CREATE INDEX "BillingRecoveryJob_review_required_idx" ON "BillingRecoveryJob"("review_required");
