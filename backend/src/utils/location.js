import geoip from 'geoip-lite';
import { isIP } from 'node:net';

export function normalizeIpAddress(value) {
  if (typeof value !== 'string') return null;
  let ip = value.trim().toLowerCase();
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
    const hex = ip.match(/^([a-f0-9]{1,4}):([a-f0-9]{1,4})$/);
    if (hex) { const high = parseInt(hex[1], 16), low = parseInt(hex[2], 16); ip = `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`; }
  }
  return isIP(ip) ? ip : null;
}

export function isPublicIpAddress(value) {
  const ip = normalizeIpAddress(value);
  if (!ip) return false;
  if (isIP(ip) === 6) return /^[23]/.test(ip) && !ip.startsWith('2001:db8:');
  const [a, b, c] = ip.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113));
}

// Local lookups avoid third-party API quotas and per-click network requests.
// A bounded LRU cache also caches misses. Private traffic has no invented location.
export function createLocationResolver(lookup, { maxEntries = 10000, ttl = 3600000, now = Date.now } = {}) {
  const cache = new Map();
  return async value => {
    const ip = normalizeIpAddress(value);
    if (!isPublicIpAddress(ip)) return null;
    const cached = cache.get(ip);
    if (cached && cached.expires > now()) { cache.delete(ip); cache.set(ip, cached); return cached.value; }
    cache.delete(ip);
    let result = null;
    try {
      const found = lookup(ip);
      if (found) result = { country: found.country || null, region: found.region || null, city: found.city || null, timezone: found.timezone || null, ll: Array.isArray(found.ll) && found.ll.length === 2 && found.ll.every(Number.isFinite) && Math.abs(found.ll[0]) <= 90 && Math.abs(found.ll[1]) <= 180 ? found.ll : null };
    } catch { /* Unresolved traffic remains unknown. */ }
    cache.set(ip, { value: result, expires: now() + (result ? ttl : Math.min(ttl, 300000)) });
    if (cache.size > maxEntries) cache.delete(cache.keys().next().value);
    return result;
  };
}

export const resolveGeoLocation = createLocationResolver(ip => geoip.lookup(ip));
