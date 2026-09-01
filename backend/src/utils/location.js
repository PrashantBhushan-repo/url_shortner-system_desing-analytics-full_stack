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
    // 1. Try ip-api.com (45 requests per minute limit)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      if (data && data.status === 'success') {
        return {
          country: data.countryCode || null,
          region: data.region || null,
          city: data.city || null,
          ll: data.lat != null && data.lon != null ? [Number(data.lat), Number(data.lon)] : null,
          timezone: data.timezone || null,
        };
      }
    }
  } catch (err) {
    console.warn("[GeoIP] ip-api.com query failed, trying ipapi.co fallback:", err.message);
  }

  try {
    // 2. Fallback to ipapi.co (1000 requests per day limit)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      if (data && !data.error) {
        return {
          country: data.country_code || data.country || null,
          region: data.region_code || data.region || null,
          city: data.city || null,
          ll: data.latitude != null && data.longitude != null ? [Number(data.latitude), Number(data.longitude)] : null,
          timezone: data.timezone || null,
        };
      }
    }
  } catch (err) {
    console.warn("[GeoIP] ipapi.co fallback query failed:", err.message);
  }

  return null;
};

export const resolveGeoLocation = async (ipAddress) => {
  const normalizedIp = normalizeIpAddress(ipAddress);

  if (!normalizedIp) {
    return null;
  }

  // Handle local development private/loopback IPs by resolving the developer's public IP
  if (isPrivateOrLoopbackIp(normalizedIp)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const response = await fetch('http://ip-api.com/json/', {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (response.ok) {
        const data = await response.json();
        if (data && data.status === 'success') {
          return {
            country: data.countryCode || 'IN',
            region: data.region || 'MH',
            city: data.city || 'Nagpur',
            ll: [data.lat || 21.1458, data.lon || 79.0882],
            timezone: data.timezone || 'Asia/Kolkata',
          };
        }
      }
    } catch {
      // Return Nagpur default
      return {
        country: 'IN',
        region: 'MH',
        city: 'Nagpur',
        ll: [21.1458, 79.0882],
        timezone: 'Asia/Kolkata',
      };
    }
  }

  // Try local geoip-lite lookup first
  const localGeo = geoip.lookup(normalizedIp);
  
  // If localGeo succeeded and has high specificity (includes city), return it
  if (localGeo && localGeo.country && localGeo.city) {
    return localGeo;
  }

  // Fallback to high-accuracy API if city/region is missing
  const apiGeo = await lookupWithIpApi(normalizedIp);
  if (apiGeo) {
    return apiGeo;
  }

  // Default fallback to whatever localGeo was able to extract
  return localGeo || null;
};
