import express from "express";
import { createOrder, verifySignature, validateCoupon, verifyMockPayment, failMockPayment, listActiveCouponsPublic } from "../controllers/payments.controller.js";
import { authMiddleware, optionalAuthMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public / Guest accessible endpoints for pricing previews
router.get("/active-coupons", listActiveCouponsPublic);
router.post("/validate-coupon", optionalAuthMiddleware, validateCoupon);

// Authenticated checkout endpoints
router.use(authMiddleware);
router.post("/create-order", createOrder);
router.post("/verify", verifySignature);
router.post("/mock-verify", verifyMockPayment);
router.post("/mock-fail", failMockPayment);

export default router;
