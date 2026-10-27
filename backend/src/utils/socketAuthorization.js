import { assertUrlAccess } from "./urlAccess.js";

export function createSocketAuthorization({ verifyToken, findUser, findUrl }) {
  const authenticate = async token => {
    const claims = verifyToken(token);
    const user = await findUser(claims.userId);
    if (!user || user.status !== "ACTIVE" || (claims.tokenVersion !== undefined && claims.tokenVersion !== user.tokenVersion)) throw new Error("Authentication required");
    return { ...user, expiresAt: claims.exp ? claims.exp * 1000 : null };
  };
  return { authenticate, authorizeRoom: async (token, id) => { const user = await authenticate(token); await assertUrlAccess(id, user, findUrl); return user; } };
}
