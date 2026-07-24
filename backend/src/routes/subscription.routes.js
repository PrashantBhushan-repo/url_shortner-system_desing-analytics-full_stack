import express from "express";
import { getSubscriptionInfo, changeSubscription, cancelSubscription, resumeSubscription, getInvoices } from "../controllers/subscription.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Self-service subscription endpoints
router.use(authMiddleware);

router.get("/", getSubscriptionInfo);
router.post("/change", changeSubscription);
router.post("/cancel", cancelSubscription);
router.post("/resume", resumeSubscription);
router.get("/invoices", getInvoices);

export default router;
