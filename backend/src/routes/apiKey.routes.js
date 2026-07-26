import express from "express";
import { generateApiKey, listApiKeys, revokeApiKey } from "../controllers/apiKey.controller.js";
import { authMiddleware, requireOwnership } from "../middlewares/auth.middleware.js";
import { requireFeature } from "../middlewares/planLimit.middleware.js";
import prisma from "../config/prismaClient.js";

const router = express.Router();

// All API key endpoints require auth and plan level API access
router.use(authMiddleware);
router.use(requireFeature("api_access"));

router.post("/", generateApiKey);
router.get("/", listApiKeys);
router.delete("/:id", requireOwnership("ApiKey", async (req) => {
  const apiKey = await prisma.apiKey.findUnique({ where: { id: req.params.id } });
  return apiKey?.user_id;
}), revokeApiKey);

export default router;

