import express from "express";
import { createDomain, verifyDomain, listDomains } from "../controllers/domain.controller.js";
import { authMiddleware, requireOwnership } from "../middlewares/auth.middleware.js";
import { requireFeature } from "../middlewares/planLimit.middleware.js";
import prisma from "../config/prismaClient.js";

const router = express.Router();

// Custom domain endpoints require authentication and plan level custom domain access
router.use(authMiddleware);
router.use(requireFeature("custom_domain_allowed"));

router.post("/", createDomain);
router.post("/:id/verify", requireOwnership("CustomDomain", async (req) => {
  const domain = await prisma.customDomain.findUnique({ where: { id: BigInt(req.params.id) } });
  return domain?.user_id;
}), verifyDomain);
router.get("/", listDomains);

export default router;

