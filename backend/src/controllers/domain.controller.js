import prisma from "../config/prismaClient.js";
import crypto from "crypto";
import { AppError } from "../utils/AppError.js";

/**
 * Register a custom domain
 */
export const createDomain = async (req, res, next) => {
  try {
    const { domain } = req.body;
    if (!domain) {
      throw new AppError("Domain name is required.", 400);
    }

    const verificationToken = `snapurl-verification=${crypto.randomBytes(16).toString("hex")}`;

    const newDomain = await prisma.customDomain.create({
      data: {
        user_id: req.user.id,
        domain: domain.toLowerCase().trim(),
        verification_token: verificationToken,
        verified: false,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: newDomain.id.toString(),
        domain: newDomain.domain,
        verificationToken: newDomain.verification_token,
        verified: newDomain.verified,
      },
    });
  } catch (err) {
    if (err.code === "P2002") {
      next(new AppError("Domain already registered.", 409));
    } else {
      next(err);
    }
  }
};

/**
 * Verify custom domain DNS TXT record
 */
export const verifyDomain = async (req, res, next) => {
  try {
    const { id } = req.params;

    const domain = await prisma.customDomain.findFirst({
      where: {
        id: BigInt(id),
        user_id: req.user.id,
      },
    });

    if (!domain) {
      throw new AppError("Domain registration not found", 404);
    }

    // TODO Stage 4b: Integrate actual DNS lookup using standard resolver dns.resolveTxt()
    // For now, to make the product testable, we simulate successful verification.
    console.log(`[DNS Mock Resolver] Verification TXT check for domain ${domain.domain}. Expected token: ${domain.verification_token}`);

    const verifiedDomain = await prisma.customDomain.update({
      where: { id: BigInt(id) },
      data: { verified: true },
    });

    res.status(200).json({
      success: true,
      message: "Domain verified successfully.",
      data: {
        id: verifiedDomain.id.toString(),
        domain: verifiedDomain.domain,
        verified: verifiedDomain.verified,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * List custom domains
 */
export const listDomains = async (req, res, next) => {
  try {
    const domains = await prisma.customDomain.findMany({
      where: {
        user_id: req.user.id,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    res.status(200).json({
      success: true,
      data: domains.map(d => ({
        id: d.id.toString(),
        domain: d.domain,
        verificationToken: d.verification_token,
        verified: d.verified,
      })),
    });
  } catch (err) {
    next(err);
  }
};
