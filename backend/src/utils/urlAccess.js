import { AppError } from "./AppError.js";

export function parseUrlId(rawId) {
  if (!/^\d+$/.test(String(rawId)) || BigInt(rawId) < 1n || BigInt(rawId) > 9223372036854775807n) throw new AppError("Invalid URL ID", 400);
  return BigInt(rawId);
}

export async function assertUrlAccess(rawId, user, findUrl) {
  const id = parseUrlId(rawId);
  if (!user?.id) throw new AppError("Authentication required", 401);
  const url = await findUrl(id);
  if (!url || (user.role !== "ADMIN" && url.user_id !== user.id)) throw new AppError("URL not found", 404);
  return url;
}
