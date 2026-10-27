ALTER TABLE "BillingCheckout" ADD CONSTRAINT "BillingCheckout_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingRefund" ADD CONSTRAINT "BillingRefund_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
