import geoip from 'geoip-lite';

const PRIVATE_IP_PREFIXES = ['10.', '192.168.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.'];

const isPrivateOrLoopbackIp = (ip) => {
  if (!ip) return true;
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
  return PRIVATE_IP_PREFIXES.some((prefix) => ip.startsWith(prefix));
};

export const normalizeIpAddress = (value) => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed === 'unknown' || trimmed === 'undefined') return null;

  if (trimmed.startsWith('::ffff:')) {
    return trimmed.replace('::ffff:', '');
  }

  return trimmed;
};

const lookupWithIpApi = async (ip) => {
  if (!ip || ip === 'unknown') return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    if (!data) return null;

    return {
      country: data.country_code || data.country || null,
      region: data.region_code || data.region || null,
      city: data.city || null,
      ll: data.latitude != null && data.longitude != null ? [Number(data.latitude), Number(data.longitude)] : null,
      timezone: data.timezone || null,
    };
  } catch {
    return null;
  }
};

export const resolveGeoLocation = async (ipAddress) => {
  const normalizedIp = normalizeIpAddress(ipAddress);

  if (!normalizedIp) {
    return null;
  }

  const localGeo = geoip.lookup(normalizedIp);
  if (localGeo && (localGeo.country || localGeo.city || localGeo.region)) {
    return localGeo;
  }

  if (isPrivateOrLoopbackIp(normalizedIp)) {
    return null;
  }

  return lookupWithIpApi(normalizedIp);
};
