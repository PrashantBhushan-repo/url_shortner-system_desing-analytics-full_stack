import API, { getAccessToken } from './urlApi.js';

let scriptPromise;
export function loadCheckoutScript() {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => fail(), 15000);
    function fail() { clearTimeout(timer); script.remove(); scriptPromise = null; reject(new Error('Secure checkout could not load. Check your connection and try again.')); }
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.async = true;
    script.onload = () => { clearTimeout(timer); if (!window.Razorpay) return fail(); resolve(); };
    script.onerror = fail;
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export async function startBillingCheckout({ user, planKey, billingCycle, couponCode = '', expectedPurchaseId = null, onStage = () => {} }) {
  if (!user?.id) throw new Error('Sign in to continue to checkout.');
  const accessToken = getAccessToken();
  const key = `billing-checkout:${user.id}:${JSON.stringify([planKey, billingCycle, couponCode.trim().toUpperCase()])}`;
  let requestKey;
  try { requestKey = sessionStorage.getItem(key); } catch { /* private browsing can disable storage */ }
  requestKey ||= crypto.randomUUID();
  try { sessionStorage.setItem(key, requestKey); } catch { /* server also protects concurrent checkouts */ }
  const assertSession = () => { if (getAccessToken() !== accessToken) throw new Error('Your account changed. Reopen billing in the current account.'); };
  onStage('Creating your secure order…');
  let response;
  try { response = await API.post('/payments/create-order', { planKey, billingCycle, couponCode, requestKey, expectedPurchaseId }); }
  catch (error) {
    if (error.response?.data?.code === 'CHECKOUT_REJECTED') {
      // The server confirmed that the previous reservation never produced a charge.
      requestKey = crypto.randomUUID();
      try { sessionStorage.setItem(key, requestKey); } catch { /* optional cache */ }
      response = await API.post('/payments/create-order', { planKey, billingCycle, couponCode, requestKey, expectedPurchaseId });
    } else {
      if (error.response?.data?.code === 'PAYMENT_REJECTED') {
        try { sessionStorage.removeItem(key); } catch { /* optional cache */ }
      }
      throw error;
    }
  }
  assertSession();
  const order = response.data?.data;
  if (!order?.paymentId) throw new Error('Checkout is unavailable. Refresh billing and try again.');
  const clearKey = () => { try { sessionStorage.removeItem(key); } catch { /* optional cache */ } };
  if (order.status === 'CAPTURED' || response.data.zeroCharge) { clearKey(); return { status: order.fulfillmentStatus === 'REVIEW_REQUIRED' ? 'REVIEW_REQUIRED' : 'CAPTURED', paymentId: order.paymentId }; }
  if (order.status === 'AUTHORIZED') return { status: 'AUTHORIZED', paymentId: order.paymentId };
  if (['REFUNDED', 'PARTIALLY_REFUNDED'].includes(order.status)) { clearKey(); throw new Error('This previous checkout has already been refunded. Start a new checkout.'); }
  await loadCheckoutScript(); assertSession();
  onStage('Complete payment in the secure checkout window.');
  return new Promise((resolve, reject) => {
    let finishing = false;
    const checkout = new window.Razorpay({
      key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency,
      name: 'PBUrls', description: `${planKey} · ${billingCycle.toLowerCase()} access`,
      prefill: { name: user.name || '', email: user.email || '' }, theme: { color: '#287848' },
      modal: { ondismiss: () => { if (!finishing) resolve({ status: 'DISMISSED', paymentId: order.paymentId }); } },
      handler: async result => {
        finishing = true;
        try {
          assertSession(); onStage('Confirming payment with the provider…');
          const verified = await API.post('/payments/verify', result);
          const status = verified.data?.data?.fulfillmentStatus === 'REVIEW_REQUIRED' ? 'REVIEW_REQUIRED' : verified.data?.data?.status;
          if (['CAPTURED','REVIEW_REQUIRED'].includes(status)) clearKey();
          resolve({ status: status || 'AUTHORIZED', paymentId: order.paymentId });
        } catch (error) {
          error.paymentId = order.paymentId;
          error.paymentUncertain = true;
          reject(error);
        }
      },
    });
    checkout.on('payment.failed', () => { finishing = true; checkout.close(); resolve({ status: 'FAILED', paymentId: order.paymentId }); });
    checkout.open();
  });
}
