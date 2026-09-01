import crypto from "crypto";
import prisma from "../config/prismaClient.js";
import { config } from "../config/config.js";
import { AppError } from "../utils/AppError.js";
import { createUser, findUserByEmail } from "../repositories/user.repository.js";
import { generateAuthUrl, getOauthUser } from "../services/oauth.service.js";
import { issueTokenPair } from "../services/auth.service.js";

export const redirectToProvider = async (req, res) => {
  const { provider } = req.params;
  
  if (!["google", "github", "microsoft", "amazon"].includes(provider)) {
    return res.status(400).json({ success: false, message: `Unsupported provider: ${provider}` });
  }

  // Generate a cryptographically secure random state parameter to prevent CSRF attacks
  const state = crypto.randomBytes(16).toString("hex");

  // Save the state in a secure HTTP-only cookie
  res.cookie("oauth_state", state, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    maxAge: 5 * 60 * 1000, // 5 minutes
  });

  const authUrl = generateAuthUrl(provider, state);
  res.redirect(authUrl);
};

export const handleProviderCallback = async (req, res, next) => {
  const { provider } = req.params;
  const { code, state } = req.query;
  const savedState = req.cookies.oauth_state;

  // Clear state cookie immediately
  res.clearCookie("oauth_state");

  try {
    if (!["google", "github", "microsoft", "amazon"].includes(provider)) {
      throw new AppError(`Unsupported provider: ${provider}`, 400);
    }

    if (!code) {
      throw new AppError("Authorization code is missing from callback query.", 400);
    }

    // CSRF verification
    if (!state || !savedState || state !== savedState) {
      throw new AppError("Invalid OAuth state. Possible CSRF attack detected.", 400);
    }

    // Exchange authorization code for user profile info
    const oauthUser = await getOauthUser(provider, code);

    // Resolve user account
    let user = await findUserByEmail(oauthUser.email);

    if (user) {
      // User exists, check if they need to be linked
      const updates = {};
      if (!user.oauthProvider) {
        updates.oauthProvider = provider.toUpperCase();
      }
      if (!user.oauthId) {
        updates.oauthId = oauthUser.oauthId;
      }
      if (!user.emailVerified) {
        updates.emailVerified = true;
      }
      if (!user.profileImage && oauthUser.profileImage) {
        updates.profileImage = oauthUser.profileImage;
      }

      if (Object.keys(updates).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updates,
        });
      }
    } else {
      // Create a new user with verified status and link subscription
      user = await createUser({
        name: oauthUser.name,
        email: oauthUser.email,
        passwordHash: null, // Password is null for OAuth-only users
        oauthProvider: provider.toUpperCase(),
        oauthId: oauthUser.oauthId,
        emailVerified: true,
        profileImage: oauthUser.profileImage,
      });
    }

    // Check account status
    if (user.status === "SUSPENDED" || user.status === "BANNED") {
      throw new AppError(`Your account is currently ${user.status.toLowerCase()}.`, 403);
    }

    // Generate JWT token pair
    const tokenResult = await issueTokenPair(user, req);

    // Set refresh token cookie matching the normal login settings
    const cookieMaxAge = user.role === "ADMIN"
      ? 8 * 60 * 60 * 1000
      : config.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000;

    res.cookie("refreshToken", tokenResult.refreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === "production",
      sameSite: "lax",
      maxAge: cookieMaxAge,
    });

    // Redirect the user to the frontend callback redirect route
    const frontendRedirectUrl = `${config.clientUrl}/oauth/callback?token=${tokenResult.accessToken}`;
    res.redirect(frontendRedirectUrl);

  } catch (err) {
    console.error("OAuth Callback Error Handling:", err.message);
    
    // Redirect to frontend error page or auth page with error parameter
    const errorMsg = encodeURIComponent(err.message || "Failed to authenticate via OAuth.");
    res.redirect(`${config.clientUrl}/auth?error=${errorMsg}`);
  }
};
