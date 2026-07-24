import express from "express";
import { listPlansAdmin, updatePlanAdmin, listSubscriptionsAdmin } from "../controllers/adminPlan.controller.js";
import { authMiddleware, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Admin-only plan management endpoints
router.use(authMiddleware);
router.use(authorize("ADMIN"));

router.get("/plans", listPlansAdmin);
router.patch("/plans/:id", updatePlanAdmin);
router.get("/subscriptions", listSubscriptionsAdmin);

export default router;
