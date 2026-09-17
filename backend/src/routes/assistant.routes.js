import { Router } from "express";
import { handleAssistantChat, syncKnowledgeBaseController } from "../controllers/assistant.controller.js";
import { authMiddleware, optionalAuthMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/chat", optionalAuthMiddleware, handleAssistantChat);
router.post("/sync", authMiddleware, syncKnowledgeBaseController);

export default router;
