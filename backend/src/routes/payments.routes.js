import express from "express";
import { createOrder, verifySignature, validateCoupon, verifyMockPayment, failMockPayment, listActiveCouponsPublic, syncPayment, syncCheckout } from "../controllers/payments.controller.js";
import { authMiddleware, optionalAuthMiddleware } from "../middlewares/auth.middleware.js";
import { createLimiter } from '../middlewares/rateLimit.middleware.js';

const router = express.Router();

// Public / Guest accessible endpoints for pricing previews
router.get("/active-coupons", listActiveCouponsPublic);
router.post("/validate-coupon", optionalAuthMiddleware, validateCoupon);

// Authenticated checkout endpoints
router.use(authMiddleware);
router.use(createLimiter({ windowMs: 60000, max: 30, prefix: 'billing', message: 'Too many payment requests. Wait a minute and check payment status.' }));
router.post("/create-order", createOrder);
router.post("/verify", verifySignature);
router.post("/:id/sync", syncPayment);
router.post("/checkouts/:id/sync", syncCheckout);
router.post("/mock-verify", verifyMockPayment);
router.post("/mock-fail", failMockPayment);

export default router;
