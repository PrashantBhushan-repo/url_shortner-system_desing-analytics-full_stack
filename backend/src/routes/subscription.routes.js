import express from "express";
import { getSubscriptionInfo, changeSubscription, cancelSubscription, resumeSubscription, getInvoices, requestRefund, syncRefund, getBillingProfile, saveBillingProfile } from "../controllers/subscription.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { createLimiter } from '../middlewares/rateLimit.middleware.js';

const router = express.Router();

// Self-service subscription endpoints
router.use(authMiddleware);
router.use(createLimiter({ windowMs: 60000, max: 60, prefix: 'subscription', message: 'Too many billing requests. Please wait a minute before retrying.' }));

router.get("/", getSubscriptionInfo);
router.post("/change", changeSubscription);
router.post("/cancel", cancelSubscription);
router.post("/resume", resumeSubscription);
router.get("/invoices", getInvoices);
router.post("/refund-request", requestRefund);
router.post("/invoices/:id/refund-sync", syncRefund);
router.get("/billing-profile", getBillingProfile);
router.put("/billing-profile", saveBillingProfile);

export default router;
