import prisma from "../config/prismaClient.js";

export const createUser = async (data) => {
  const freePlan = await prisma.plan.findUnique({ where: { key: "free" } });
  if (!freePlan) {
    throw new Error("Free plan not found in database.");
  }
  return await prisma.user.create({
    data: {
      ...data,
      subscriptions: {
        create: {
          plan_id: freePlan.id,
          billing_cycle: "MONTHLY",
          status: "ACTIVE",
        }
      }
    }
  });
};

export const findUserByEmail = async (email) => {
  return await prisma.user.findUnique({ where: { email } });
};

export const findUserById = async (id) => {
  return await prisma.user.findUnique({ where: { id } });
};

export const markEmailVerified = async (id) =>
  await prisma.user.update({ where: { id }, data: { emailVerified: true } });

export const updateUserPassword = async (id, passwordHash) =>
  await prisma.user.update({ where: { id }, data: { passwordHash } });

export const updateUserProfile = async (id, data) =>
  await prisma.user.update({ where: { id }, data });

export const createRefreshToken = async (data) => {
  return await prisma.refreshToken.create({ data });
};

export const findRefreshTokenById = async (id) => {
  return await prisma.refreshToken.findUnique({ where: { id } });
};

export const revokeRefreshToken = async (id) => {
  return await prisma.refreshToken.update({ where: { id }, data: { revoked: true } });
};

export const revokeRefreshTokensByUserId = async (userId) => {
  return await prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true },
  });
};

export const findActiveRefreshTokenByHash = async (tokenHash) => {
  return await prisma.refreshToken.findFirst({
    where: { tokenHash, revoked: false, expiresAt: { gt: new Date() } },
  });
};

export const findRefreshTokenByHash = async (tokenHash) => {
  return await prisma.refreshToken.findFirst({
    where: { tokenHash },
  });
};

export const revokeRefreshTokenByHash = async (tokenHash) => {
  return await prisma.refreshToken.updateMany({
    where: { tokenHash, revoked: false },
    data: { revoked: true },
  });
};

export const incrementTokenVersion = async (userId) =>
  prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });

export const createLoginEvent = async ({ userId, ip, device, success, location, reason, riskLevel }) =>
  prisma.loginEvent.create({
    data: {
      userId: userId || null,
      ip,
      device,
      success,
      location: location || null,
      reason: reason || null,
      riskLevel: riskLevel || null,
    },
  });

export const revokeRefreshTokenByIdAndUser = async (id, userId) => {
  const result = await prisma.refreshToken.updateMany({
    where: { id, userId, revoked: false },
    data: { revoked: true },
  });
  return result.count > 0;
};

export const revokeOtherRefreshTokens = async (userId, currentTokenHash) => {
  return await prisma.refreshToken.updateMany({
    where: {
      userId,
      tokenHash: { not: currentTokenHash },
      revoked: false,
    },
    data: { revoked: true },
  });
};
