import express from "express";
import { createTeam, inviteMember, acceptInvite, revokeMember, listTeamMembers, listUserTeams } from "../controllers/team.controller.js";
import { authMiddleware, requireTeamRole } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", listUserTeams);
router.post("/", createTeam);
router.post("/invite", requireTeamRole("OWNER", "ADMIN"), inviteMember);
router.post("/accept", acceptInvite);
router.post("/revoke", requireTeamRole("OWNER", "ADMIN"), revokeMember);
router.get("/:teamId/members", requireTeamRole("OWNER", "ADMIN", "MEMBER"), listTeamMembers);


export default router;

