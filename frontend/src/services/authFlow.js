export function authErrorMessage(error, fallback = 'Unable to continue. Please try again.') {
  if (!error.response) return 'Cannot reach the server. Check your connection and try again.';
  if (error.response.status >= 500) return 'The sign-in service is temporarily unavailable. Please try again shortly.';
  const { details, message } = error.response.data || {};
  return (Array.isArray(details) ? details.map(item => item.message).filter(Boolean).join('. ') : '') || message || fallback;
}

export function passwordIsStrong(password) {
  return password.length >= 8 && password.length <= 128 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
}

export function requireAuthData(response, field) {
  const value = response.data?.data?.[field];
  if (!value || typeof value !== 'string') throw new Error('Incomplete authentication response');
  return value;
}
