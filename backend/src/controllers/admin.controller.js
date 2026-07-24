import prisma from "../config/prismaClient.js";
import { AppError } from "../utils/AppError.js";
import { sendEmail } from "../utils/mailer.js";
import { invalidateUserStatusCache } from "../middlewares/auth.middleware.js";

/**
 * List all users with pagination, search, and filtering
 */
export const listUsersAdmin = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { search, status, role, plan } = req.query;

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status) {
      where.status = status;
    }
    if (role) {
      where.role = role;
    }
    if (plan) {
      where.subscriptions = {
        some: {
          plan: { key: plan },
          status: "ACTIVE",
        },
      };
    }

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          subscriptions: {
            where: { status: "ACTIVE" },
            include: { plan: true },
            take: 1,
          },
          _count: {
            select: { urls: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    const userIds = users.map((u) => u.id);
    const lastLogins = await prisma.loginEvent.findMany({
      where: {
        userId: { in: userIds },
        success: true,
      },
      orderBy: { createdAt: "desc" },
      distinct: ["userId"],
    });

    const lastLoginMap = Object.fromEntries(lastLogins.map((e) => [e.userId, e.createdAt]));

    const formattedUsers = users.map((u) => {
      const activeSub = u.subscriptions[0];
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        planKey: activeSub ? activeSub.plan.key : "free",
        urlCount: u._count.urls,
        createdAt: u.createdAt,
        lastLogin: lastLoginMap[u.id] || null,
      };
    });

    res.status(200).json({
      success: true,
      data: formattedUsers,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get full details of a single user
 */
export const getUserDetailAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        phone: true,
        timezone: true,
        language: true,
        bio: true,
        profileImage: true,
        twoFactorEnabled: true,
        emailVerified: true,
      },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const activeSessions = await prisma.refreshToken.findMany({
      where: { userId: id, revoked: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    const recentLoginHistory = await prisma.loginEvent.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const subscription = await prisma.subscription.findFirst({
      where: { user_id: id, status: "ACTIVE" },
      include: { plan: true },
      orderBy: { started_at: "desc" },
    });

    const urlCount = await prisma.url.count({
      where: { user_id: id },
    });

    res.status(200).json({
      success: true,
      data: {
        profile: user,
        activeSessions,
        currentSubscription: subscription,
        urlCount,
        recentLoginHistory,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update user status (ACTIVE, SUSPENDED, BANNED)
 */
export const updateUserStatusAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!["ACTIVE", "SUSPENDED", "BANNED"].includes(status)) {
      throw new AppError("Invalid status value", 400);
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const previousStatus = user.status;
    if (previousStatus === status) {
      return res.status(200).json({
        success: true,
        message: `User status is already ${status}`,
        data: { id: user.id, status: user.status },
      });
    }

    // Save metadata for the audit log wrapper
    req.auditMetadata = {
      previousStatus,
      newStatus: status,
      reason: reason || "No reason provided",
    };

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status },
    });

    // Invalidate Redis cache immediately
    await invalidateUserStatusCache(id);

    if (status === "SUSPENDED" || status === "BANNED") {
      // Force session revoking everywhere by changing tokenVersion & revoking refresh tokens
      await prisma.user.update({
        where: { id },
        data: { tokenVersion: { increment: 1 } },
      });
      await prisma.refreshToken.updateMany({
        where: { userId: id, revoked: false },
        data: { revoked: true },
      });

      // Send status email notification
      try {
        await sendEmail({
          to: user.email,
          subject: status === "SUSPENDED" ? "⚠️ Account Suspended" : "🚫 Account Banned",
          html: `
            <div style="font-family: Arial, sans-serif; padding: 24px; color: #0f172a; background-color: #f8fafc; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0;">
              <h2 style="color: #b91c1c; font-weight: 800;">Account Status Update</h2>
              <p>Hello <strong>${user.name}</strong>,</p>
              <p>Your SnapURL account status has been changed to <strong>${status}</strong>.</p>
              ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
              <p style="color: #64748b; font-size: 14px; margin-top: 20px;">If you believe this was an error, please contact support.</p>
            </div>
          `,
        });
      } catch (mailErr) {
        console.warn("Failed to send status notification email:", mailErr.message);
      }
    }

    res.status(200).json({
      success: true,
      message: `User status updated to ${status}`,
      data: {
        id: updatedUser.id,
        status: updatedUser.status,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Promote/Demote User Role (USER <-> ADMIN) with last-admin safety guardrail
 */
export const updateUserRoleAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!["USER", "ADMIN"].includes(role)) {
      throw new AppError("Invalid role value", 400);
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const previousRole = user.role;
    if (previousRole === role) {
      return res.status(200).json({
        success: true,
        message: `User role is already ${role}`,
        data: { id: user.id, role: user.role },
      });
    }

    // Guard rail: Do not demote the last remaining active admin
    if (previousRole === "ADMIN" && role === "USER") {
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN", status: "ACTIVE" },
      });

      if (adminCount <= 1) {
        throw new AppError("Cannot demote the last remaining active admin.", 400);
      }
    }

    req.auditMetadata = {
      previousRole,
      newRole: role,
    };

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
    });

    res.status(200).json({
      success: true,
      message: `User role updated to ${role}`,
      data: {
        id: updatedUser.id,
        role: updatedUser.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * List all URLs across users (searchable & filterable)
 */
export const listUrlsAdmin = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { search, status } = req.query;

    const where = {};
    if (search) {
      where.OR = [
        { long_url: { contains: search, mode: "insensitive" } },
        { short_code: { contains: search, mode: "insensitive" } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { name: { contains: search, mode: "insensitive" } } },
      ];
    }
    if (status === "active") {
      where.is_active = true;
    } else if (status === "inactive") {
      where.is_active = false;
    }

    const [urls, total] = await prisma.$transaction([
      prisma.url.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
      }),
      prisma.url.count({ where }),
    ]);

    const formattedUrls = urls.map((u) => ({
      ...u,
      id: u.id.toString(),
      custom_domain_id: u.custom_domain_id ? u.custom_domain_id.toString() : null,
    }));

    res.status(200).json({
      success: true,
      data: formattedUrls,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Moderate Delete URL (Hard delete with mandatory reason)
 */
export const moderateDeleteUrlAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      throw new AppError("A moderation reason is required", 400);
    }

    const url = await prisma.url.findUnique({
      where: { id: BigInt(id) },
    });

    if (!url) {
      throw new AppError("URL not found", 404);
    }

    req.auditMetadata = {
      shortCode: url.short_code,
      longUrl: url.long_url,
      userId: url.user_id,
      reason,
    };

    // Hard delete (automatically cascades to click / stats tables)
    await prisma.url.delete({
      where: { id: BigInt(id) },
    });

    res.status(200).json({
      success: true,
      message: "URL permanently removed by moderation",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * List admin audit logs (searchable & filterable)
 */
export const listAuditLogsAdmin = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { adminId, action, targetType, startDate, endDate } = req.query;

    const where = {};
    if (adminId) {
      where.admin_id = adminId;
    }
    if (action) {
      where.action = action;
    }
    if (targetType) {
      where.target_type = targetType;
    }
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at.gte = new Date(startDate);
      }
      if (endDate) {
        where.created_at.lte = new Date(endDate);
      }
    }

    const [logs, total] = await prisma.$transaction([
      prisma.adminAuditLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          admin: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};
