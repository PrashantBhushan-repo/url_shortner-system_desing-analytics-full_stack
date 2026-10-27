CREATE TABLE "BillingProfile" (
  "user_id" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL DEFAULT '', "email" TEXT NOT NULL DEFAULT '',
  "company" TEXT NOT NULL DEFAULT '', "address" TEXT NOT NULL DEFAULT '',
  "city" TEXT NOT NULL DEFAULT '', "region" TEXT NOT NULL DEFAULT '',
  "postal_code" TEXT NOT NULL DEFAULT '', "country" TEXT NOT NULL DEFAULT 'IN',
  "tax_id" TEXT NOT NULL DEFAULT '', "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "BillingCheckout" (
  "id" TEXT PRIMARY KEY, "user_id" TEXT NOT NULL, "request_key" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL, "plan_id" TEXT NOT NULL,
  "billing_cycle" "BillingCycle" NOT NULL, "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL, "coupon_id" TEXT, "status" TEXT NOT NULL DEFAULT 'CREATING',
  "payment_id" TEXT UNIQUE, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  UNIQUE("user_id", "request_key")
);
CREATE INDEX "BillingCheckout_user_id_status_idx" ON "BillingCheckout"("user_id", "status");
CREATE TABLE "BillingRefund" (
  "id" TEXT PRIMARY KEY, "payment_id" TEXT NOT NULL UNIQUE, "user_id" TEXT NOT NULL,
  "amount" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "gateway_refund_id" TEXT UNIQUE, "reason" TEXT NOT NULL, "note" TEXT NOT NULL DEFAULT '',
  "failure_reason" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "BillingRefund_user_id_status_idx" ON "BillingRefund"("user_id", "status");
