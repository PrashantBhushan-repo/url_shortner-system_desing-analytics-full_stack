import { isIP } from 'node:net';

export function parseTrustProxy(value = 'loopback') {
  if (value === 'false' || value === '0') return false;
  const entries = value.split(',').map(item => item.trim()).filter(Boolean);
  if (!entries.length) return false;
  for (const entry of entries) {
    if (['loopback', 'linklocal', 'uniquelocal'].includes(entry)) continue;
    const [address, bits, ...extra] = entry.split('/');
    const version = isIP(address);
    if (!version || extra.length || (bits !== undefined && (!/^\d+$/.test(bits) || Number(bits) > (version === 4 ? 32 : 128)))) throw new Error('TRUST_PROXY must contain trusted proxy IPs/CIDRs, subnet names, or false');
  }
  return entries;
}
