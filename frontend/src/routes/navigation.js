export const SETTINGS_ROUTES = [
  { slug: 'profile', tab: 'profile', label: 'Profile' },
  { slug: 'password', tab: 'password', label: 'Password' },
  { slug: 'security', tab: 'security', label: 'Sessions & security' },
  { slug: 'two-factor', tab: 'twoFactor', label: 'Two-factor authentication' },
  { slug: 'appearance', tab: 'theme', label: 'Appearance' },
  { slug: 'domains', tab: 'domains', label: 'Custom domains' },
  { slug: 'team', tab: 'teams', label: 'Team members' },
  { slug: 'api-keys', tab: 'apiKeys', label: 'API keys' },
  { slug: 'webhooks', tab: 'webhooks', label: 'Webhooks' },
  { slug: 'integrations', tab: 'mcp', label: 'AI & MCP integration' },
];
export const ADMIN_SECTIONS = ['overview', 'users', 'urls', 'payments', 'coupons', 'webhooks', 'revops', 'reconcile', 'approvals', 'audit', 'traces'];
export const settingsPath = tab => ['billing', 'subscription', 'refund', 'refunds'].includes(tab) ? '/billing' : '/settings/' + (SETTINGS_ROUTES.find(item => item.tab === tab || item.slug === tab)?.slug || 'profile');
export function legacySettingsLocation(search = '', fallback = 'profile') {
  const params = new URLSearchParams(search);
  const requested = params.get('tab') || fallback;
  const tab = ['billing', 'refund', 'refunds'].includes(requested) ? 'subscription' : requested;
  params.delete('tab');
  return settingsPath(tab) + (params.size ? '?' + params : '');
}

// Only known same-origin destinations can be used after authentication.
export function safeReturnTo(value, fallback = '/dashboard') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || [...value].some(char => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)) return fallback;
  try {
    const url = new URL(value, 'https://pburls.invalid');
    if (url.origin !== 'https://pburls.invalid' || /%2f|%5c/i.test(url.pathname)) return fallback;
    const known = ['/dashboard', '/pricing', '/help', '/settings', '/settings/billing', '/profile', '/billing', '/refund', '/refunds', '/admin'].includes(url.pathname)
      || SETTINGS_ROUTES.some(item => url.pathname === '/settings/' + item.slug)
      || ADMIN_SECTIONS.some(section => url.pathname === '/admin/' + section)
      || /^\/analytics\/[1-9][0-9]*$/.test(url.pathname);
    return known ? url.pathname + url.search + url.hash : fallback;
  } catch { return fallback; }
}
export const signInPath = (destination, mode = 'login') => '/auth?' + new URLSearchParams({ mode, next: safeReturnTo(destination) });

export function linkView(search) {
  const params = new URLSearchParams(search);
  return { query: (params.get('q') || '').slice(0, 200), status: ['All', 'Active', 'Expired'].includes(params.get('status')) ? params.get('status') : 'All', sort: ['newest', 'oldest', 'clicks'].includes(params.get('sort')) ? params.get('sort') : 'newest', page: Math.min(100000, Math.max(1, Math.floor(Number(params.get('page')) || 1))), showCreate: params.get('create') === '1' };
}
export function updateLinkView(search, patch) {
  const next = new URLSearchParams(search);
  const fields = { query: ['q', ''], status: ['status', 'All'], sort: ['sort', 'newest'], page: ['page', 1], showCreate: ['create', false] };
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.hasOwn(fields, key)) continue;
    const [name, fallback] = fields[key];
    if (value === fallback || value == null) next.delete(name);
    else next.set(name, key === 'showCreate' ? '1' : String(value));
  }
  return next;
}

export function routeTitle(pathname, search = '') {
  if (pathname === '/') return 'PBUrls — Short links, QR codes & analytics';
  if (pathname === '/auth') return (['register', 'signup'].includes(new URLSearchParams(search).get('mode')) ? 'Create an account' : 'Sign in') + ' | PBUrls';
  if (pathname === '/oauth/callback') return 'Completing sign-in | PBUrls';
  if (pathname === '/dashboard') return 'Links overview | PBUrls';
  if (pathname === '/billing') return 'Plans & billing | PBUrls';
  if (pathname.startsWith('/analytics/')) return 'Link analytics | PBUrls';
  if (pathname.startsWith('/settings/')) return (SETTINGS_ROUTES.find(item => pathname === '/settings/' + item.slug)?.label || 'Page not found') + ' | PBUrls';
  if (pathname.startsWith('/admin/')) return ADMIN_SECTIONS.includes(pathname.split('/').at(-1)) ? (pathname.split('/').at(-1).replace('revops', 'Revenue operations').replace('reconcile', 'Reconciliation').replace(/^./, c => c.toUpperCase())) + ' · Administration | PBUrls' : 'Page not found | PBUrls';
  if (pathname.startsWith('/demo')) return (pathname === '/demo/admin' ? 'Admin demo' : 'Workspace demo') + ' | PBUrls';
  if (pathname === '/pricing') return 'Plans & pricing | PBUrls';
  if (pathname === '/help') return 'Help & guides | PBUrls';
  if (pathname.startsWith('/p/')) return 'Password-protected link | PBUrls';
  return 'Page not found | PBUrls';
}
