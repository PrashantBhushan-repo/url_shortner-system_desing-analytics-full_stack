import axios from "axios";
import { config } from "../config/config.js";
import { AppError } from "../utils/AppError.js";

const getOAuthConfig = (provider) => {
  const provConfig = config.oauth[provider];
  if (!provConfig || !provConfig.clientId || !provConfig.clientSecret) {
    throw new AppError(`${provider.toUpperCase()} OAuth credentials are not configured on the server.`, 501);
  }
  return provConfig;
};

export const generateAuthUrl = (provider, state) => {
  const oauthConf = getOAuthConfig(provider);
  const encodedRedirect = encodeURIComponent(oauthConf.redirectUri);
  const encodedState = encodeURIComponent(state);

  switch (provider) {
    case "google":
      return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${oauthConf.clientId}&redirect_uri=${encodedRedirect}&response_type=code&scope=openid%20email%20profile&state=${encodedState}&access_type=offline&prompt=select_account`;
    
    case "github":
      return `https://github.com/login/oauth/authorize?client_id=${oauthConf.clientId}&redirect_uri=${encodedRedirect}&scope=read:user%20user:email&state=${encodedState}`;
    
    case "microsoft":
      return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${oauthConf.clientId}&redirect_uri=${encodedRedirect}&response_type=code&scope=openid%20email%20profile%20User.Read&state=${encodedState}&response_mode=query`;
    
    case "amazon":
      return `https://www.amazon.com/ap/oa?client_id=${oauthConf.clientId}&redirect_uri=${encodedRedirect}&response_type=code&scope=profile&state=${encodedState}`;

    default:
      throw new AppError(`Unsupported provider: ${provider}`, 400);
  }
};

export const getGoogleUser = async (code) => {
  const oauthConf = getOAuthConfig("google");
  try {
    const tokenRes = await axios.post("https://oauth2.googleapis.com/token", {
      client_id: oauthConf.clientId,
      client_secret: oauthConf.clientSecret,
      code,
      redirect_uri: oauthConf.redirectUri,
      grant_type: "authorization_code",
    });

    const { access_token } = tokenRes.data;
    const userRes = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { sub, email, name, picture } = userRes.data;
    if (!email) {
      throw new AppError("No email address returned from Google.", 400);
    }

    return {
      oauthId: sub,
      email: email.toLowerCase(),
      name: name || email.split("@")[0],
      profileImage: picture || null,
    };
  } catch (error) {
    console.error("Google OAuth Error:", error.response?.data || error.message);
    throw new AppError("Failed to authenticate with Google OAuth.", 401);
  }
};

export const getGithubUser = async (code) => {
  const oauthConf = getOAuthConfig("github");
  try {
    const tokenRes = await axios.post("https://github.com/login/oauth/access_token", {
      client_id: oauthConf.clientId,
      client_secret: oauthConf.clientSecret,
      code,
      redirect_uri: oauthConf.redirectUri,
    }, {
      headers: { Accept: "application/json" }
    });

    const { access_token } = tokenRes.data;
    if (!access_token) {
      throw new AppError("No access token returned from GitHub.", 401);
    }

    // Get GitHub Profile info
    const userRes = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `token ${access_token}` },
    });

    const { id, name, login, avatar_url } = userRes.data;

    // Get GitHub verified email address
    const emailsRes = await axios.get("https://api.github.com/user/emails", {
      headers: { Authorization: `token ${access_token}` },
    });

    const primaryEmailObj = emailsRes.data.find(e => e.primary && e.verified) || emailsRes.data.find(e => e.verified) || emailsRes.data[0];
    const email = primaryEmailObj?.email;

    if (!email) {
      throw new AppError("No verified email address found in GitHub profile.", 400);
    }

    return {
      oauthId: String(id),
      email: email.toLowerCase(),
      name: name || login || email.split("@")[0],
      profileImage: avatar_url || null,
    };
  } catch (error) {
    console.error("GitHub OAuth Error:", error.response?.data || error.message);
    throw new AppError("Failed to authenticate with GitHub OAuth.", 401);
  }
};

export const getMicrosoftUser = async (code) => {
  const oauthConf = getOAuthConfig("microsoft");
  try {
    const params = new URLSearchParams();
    params.append("client_id", oauthConf.clientId);
    params.append("client_secret", oauthConf.clientSecret);
    params.append("code", code);
    params.append("redirect_uri", oauthConf.redirectUri);
    params.append("grant_type", "authorization_code");

    const tokenRes = await axios.post("https://login.microsoftonline.com/common/oauth2/v2.0/token", params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });

    const { access_token } = tokenRes.data;
    const userRes = await axios.get("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { id, displayName, mail, userPrincipalName } = userRes.data;
    const email = mail || userPrincipalName;

    if (!email) {
      throw new AppError("No email address returned from Microsoft account.", 400);
    }

    return {
      oauthId: id,
      email: email.toLowerCase(),
      name: displayName || email.split("@")[0],
      profileImage: null, // Microsoft profile images require extra binary handling, keep it null for simplicity
    };
  } catch (error) {
    console.error("Microsoft OAuth Error:", error.response?.data || error.message);
    throw new AppError("Failed to authenticate with Microsoft OAuth.", 401);
  }
};

export const getAmazonUser = async (code) => {
  const oauthConf = getOAuthConfig("amazon");
  try {
    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", oauthConf.redirectUri);
    params.append("client_id", oauthConf.clientId);
    params.append("client_secret", oauthConf.clientSecret);

    const tokenRes = await axios.post("https://api.amazon.com/auth/o2/token", params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });

    const { access_token } = tokenRes.data;
    const userRes = await axios.get("https://api.amazon.com/user/profile", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { user_id, email, name } = userRes.data;
    if (!email) {
      throw new AppError("No email address returned from Amazon profile.", 400);
    }

    return {
      oauthId: user_id,
      email: email.toLowerCase(),
      name: name || email.split("@")[0],
      profileImage: null,
    };
  } catch (error) {
    console.error("Amazon OAuth Error:", error.response?.data || error.message);
    throw new AppError("Failed to authenticate with Amazon OAuth.", 401);
  }
};

export const getOauthUser = async (provider, code) => {
  switch (provider) {
    case "google":
      return getGoogleUser(code);
    case "github":
      return getGithubUser(code);
    case "microsoft":
      return getMicrosoftUser(code);
    case "amazon":
      return getAmazonUser(code);
    default:
      throw new AppError(`Unsupported provider: ${provider}`, 400);
  }
};
