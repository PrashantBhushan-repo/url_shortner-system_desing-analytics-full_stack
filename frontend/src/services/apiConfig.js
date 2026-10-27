// Same-origin requests preserve cookies when developing on localhost or 127.0.0.1.
export const API_BASE_URL = (import.meta.env?.VITE_API_URL || '/api').replace(/\/$/, '');

// Socket.IO expects the server origin, not the HTTP API's /api path.
export const getSocketOrigin = (apiBaseUrl, pageOrigin) => new URL(apiBaseUrl || '/api', pageOrigin).origin;
