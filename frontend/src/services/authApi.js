import API from "./urlApi";

export const registerUser = (payload) => API.post("/auth/register", payload);
export const verifyEmail = (payload) => API.post("/auth/verify-email", payload);
export const resendOtp = (payload) => API.post("/auth/resend-otp", payload);
export const loginUser = (payload) => API.post("/auth/login", payload);
export const verifyLoginOtp = (payload) => API.post("/auth/verify-login-otp", payload);
export const forgotPassword = (payload) => API.post("/auth/forgot-password", payload);
export const resetPassword = (payload) => API.post("/auth/reset-password", payload);
export const changePassword = (payload, token) => API.post("/auth/change-password", payload, { headers: { Authorization: `Bearer ${token}` } });
export const getProfile = (token) => API.get("/auth/profile", { headers: { Authorization: `Bearer ${token}` } });
export const updateProfile = (payload, token) => API.put("/auth/profile", payload, { headers: { Authorization: `Bearer ${token}` } });
export const getSecuritySessions = (token) => API.get("/security/sessions", { headers: { Authorization: `Bearer ${token}` } });
export const getLoginHistory = (token) => API.get("/security/login-history", { headers: { Authorization: `Bearer ${token}` } });
export const revokeSecuritySession = (sessionId, token) => API.delete(`/security/sessions/${sessionId}`, { headers: { Authorization: `Bearer ${token}` } });
export const revokeAllSecuritySessions = (token) => API.post("/security/sessions/revoke-all", {}, { headers: { Authorization: `Bearer ${token}` } });
export const revokeAllAbsoluteSecuritySessions = (token) => API.post("/security/sessions/revoke-all-absolute", {}, { headers: { Authorization: `Bearer ${token}` } });
export const setupTwoFactor = (token) => API.post("/auth/2fa/setup", {}, { headers: { Authorization: `Bearer ${token}` } });
export const enableTwoFactor = (payload, token) => API.post("/auth/2fa/enable", payload, { headers: { Authorization: `Bearer ${token}` } });
export const disableTwoFactor = (payload, token) => API.post("/auth/2fa/disable", payload, { headers: { Authorization: `Bearer ${token}` } });

export const changeEmailRequest = (payload, token) => API.post("/auth/change-email/request", payload, { headers: { Authorization: `Bearer ${token}` } });
export const changeEmailConfirm = (payload, token) => API.post("/auth/change-email/confirm", payload, { headers: { Authorization: `Bearer ${token}` } });
export const deleteAccount = (payload, token) => API.delete("/auth/delete-account", { data: payload, headers: { Authorization: `Bearer ${token}` } });

export const forceChangePassword = (payload) => API.post("/auth/force-change-password", payload);
export const evaluatorBypass = (role) => API.post("/auth/evaluator-bypass", { role });
