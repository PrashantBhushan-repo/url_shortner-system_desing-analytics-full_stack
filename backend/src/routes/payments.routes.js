import express from "express";
import { createOrder, verifySignature, validateCoupon, verifyMockPayment, failMockPayment } from "../controllers/payments.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/create-order", createOrder);
router.post("/verify", verifySignature);
router.post("/validate-coupon", validateCoupon);
router.post("/mock-verify", verifyMockPayment);
router.post("/mock-fail", failMockPayment);

export default router;
