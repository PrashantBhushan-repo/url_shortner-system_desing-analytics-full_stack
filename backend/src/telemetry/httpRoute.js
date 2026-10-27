export const isProbe = req => /^\/(health|ready|metrics)(\?|$)/.test(req.originalUrl || req.url || '');
export const httpRoute = req => typeof req.route?.path === 'string'
  ? `${req.baseUrl || ''}${req.route.path}` : 'unmatched';
export const httpMethod = req => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(req.method)
  ? req.method : 'OTHER';
