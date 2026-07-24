import prisma from "../config/prismaClient.js";
import { AppError } from "../utils/AppError.js";
import { getActiveSubscription } from "../services/planLimitService.js";

/**
 * Helper to get user's team members limit
 */
const getTeamMembersLimit = async (userId) => {
  const sub = await getActiveSubscription(userId);
  if (!sub || !sub.plan || !sub.plan.limit) {
    return 0;
  }
  return sub.plan.limit.team_members_allowed || 0;
};

/**
 * Create a new team
 */
export const createTeam = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      throw new AppError("Team name is required.", 400);
    }

    const limit = await getTeamMembersLimit(req.user.id);
    if (limit <= 0) {
      throw new AppError("Team support is not available on your current plan. Please upgrade to a Business plan.", 403);
    }

    const team = await prisma.team.create({
      data: {
        name,
        owner_id: req.user.id,
        members: {
          create: {
            user_id: req.user.id,
            role: "OWNER",
            status: "ACCEPTED",
            joined_at: new Date(),
          },
        },
      },
      include: {
        members: true,
      },
    });

    res.status(201).json({
      success: true,
      data: team,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Invite a user to a team
 */
export const inviteMember = async (req, res, next) => {
  try {
    const { teamId, email, role } = req.body;
    if (!teamId || !email) {
      throw new AppError("teamId and email are required.", 400);
    }

    // Verify requesting user is owner or admin of the team
    const requesterMember = await prisma.teamMember.findFirst({
      where: {
        team_id: teamId,
        user_id: req.user.id,
        status: "ACCEPTED",
      },
    });

    if (!requesterMember || (requesterMember.role !== "OWNER" && requesterMember.role !== "ADMIN")) {
      throw new AppError("Forbidden: Only team owners and admins can invite members.", 403);
    }

    // Find the target user by email
    const targetUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!targetUser) {
      throw new AppError("User with this email does not exist.", 404);
    }

    // Check plan seat limits of the team OWNER
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });
    const limit = await getTeamMembersLimit(team.owner_id);

    // Count current accepted team members
    const currentMemberCount = await prisma.teamMember.count({
      where: {
        team_id: teamId,
        status: "ACCEPTED",
      },
    });

    // Exclude the owner in counting, since they are included in members relation
    // If the limit is 10, the maximum number of additional members is 10.
    if (currentMemberCount >= limit + 1) { // +1 for the owner
      throw new AppError(`Maximum seat limit of ${limit} members on the team owner's plan has been reached.`, 403);
    }

    // Check if user is already in team (invited or active)
    const existingMembership = await prisma.teamMember.findUnique({
      where: {
        team_id_user_id: {
          team_id: teamId,
          user_id: targetUser.id,
        },
      },
    });

    if (existingMembership) {
      throw new AppError("User is already a member or has a pending invite.", 409);
    }

    const invitation = await prisma.teamMember.create({
      data: {
        team_id: teamId,
        user_id: targetUser.id,
        role: role || "MEMBER",
        status: "PENDING",
      },
    });

    res.status(201).json({
      success: true,
      data: invitation,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Accept a team invitation
 */
export const acceptInvite = async (req, res, next) => {
  try {
    const { teamId } = req.body;
    if (!teamId) {
      throw new AppError("teamId is required.", 400);
    }

    const membership = await prisma.teamMember.findFirst({
      where: {
        team_id: teamId,
        user_id: req.user.id,
        status: "PENDING",
      },
    });

    if (!membership) {
      throw new AppError("No pending invitation found for this team.", 404);
    }

    const updated = await prisma.teamMember.update({
      where: { id: membership.id },
      data: {
        status: "ACCEPTED",
        joined_at: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Revoke invitation or remove member
 */
export const revokeMember = async (req, res, next) => {
  try {
    const { teamId, userId } = req.body;
    if (!teamId || !userId) {
      throw new AppError("teamId and userId are required.", 400);
    }

    // Verify requesting user is owner or admin
    const requesterMember = await prisma.teamMember.findFirst({
      where: {
        team_id: teamId,
        user_id: req.user.id,
        status: "ACCEPTED",
      },
    });

    if (!requesterMember || (requesterMember.role !== "OWNER" && requesterMember.role !== "ADMIN")) {
      throw new AppError("Forbidden: Only team owners and admins can remove members.", 403);
    }

    const targetMembership = await prisma.teamMember.findUnique({
      where: {
        team_id_user_id: {
          team_id: teamId,
          user_id: userId,
        },
      },
    });

    if (!targetMembership) {
      throw new AppError("User is not a member of this team.", 404);
    }

    // Prevent removing the owner
    if (targetMembership.role === "OWNER") {
      throw new AppError("Cannot remove the team owner.", 403);
    }

    // Admins cannot remove other admins or owners
    if (requesterMember.role === "ADMIN" && targetMembership.role === "ADMIN") {
      throw new AppError("Admins cannot remove other admins.", 403);
    }

    await prisma.teamMember.delete({
      where: { id: targetMembership.id },
    });

    res.status(200).json({
      success: true,
      message: "Member removed successfully.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * List all members of a team
 */
export const listTeamMembers = async (req, res, next) => {
  try {
    const { teamId } = req.params;

    // Verify caller is a member
    const member = await prisma.teamMember.findFirst({
      where: {
        team_id: teamId,
        user_id: req.user.id,
        status: "ACCEPTED",
      },
    });

    if (!member) {
      throw new AppError("Unauthorized: You do not belong to this team.", 403);
    }

    const members = await prisma.teamMember.findMany({
      where: { team_id: teamId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: members,
    });
  } catch (err) {
    next(err);
  }
};
