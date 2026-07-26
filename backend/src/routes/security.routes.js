import express from "express";
import {
  listSessions,
  deleteSession,
  revokeAllOtherSessions,
  getLoginHistory,
  revokeAllSessions,
} from "../controllers/security.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { authGeneralLimiter, authSensitiveLimiter } from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/sessions", authGeneralLimiter, listSessions);
router.delete("/sessions/:id", authSensitiveLimiter, deleteSession);
router.post("/sessions/revoke-all", authSensitiveLimiter, revokeAllOtherSessions);
router.post("/sessions/revoke-all-absolute", authSensitiveLimiter, revokeAllSessions);
router.get("/login-history", authGeneralLimiter, getLoginHistory);

export default router;
