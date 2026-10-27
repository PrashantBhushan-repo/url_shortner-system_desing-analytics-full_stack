export const OAUTH_PROVIDERS = ['google', 'github', 'microsoft', 'amazon'];

const configuredValue = value => typeof value === 'string' && value.trim() && !/(your[_ -]|placeholder|replace[_ -]|example\.com|xxx)/i.test(value);

export function publicAuthOptions(config) {
  return {
    providers: OAUTH_PROVIDERS.filter(provider => {
      const settings = config.oauth[provider];
      if (!settings || !configuredValue(settings.clientId) || !configuredValue(settings.clientSecret)) return false;
      try { return ['http:', 'https:'].includes(new URL(settings.redirectUri).protocol); } catch { return false; }
    }).map(id => ({ id, url: `${config.baseUrl.replace(/\/$/, '')}/api/auth/oauth/${id}` })),
  };
}
