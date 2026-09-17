import { trace, SpanStatusCode, SpanKind } from "@opentelemetry/api";
import { recordBusinessOperation } from "./metrics.js";

const getTracer = () => trace.getTracer("pburls-business");

/**
 * Generic helper to wrap a business operation inside an OpenTelemetry span.
 *
 * @param {string} spanName - Descriptive name of the span (e.g. "business.redirect")
 * @param {Object} attributes - Contextual attributes for the span
 * @param {Function} fn - Async or sync function to execute within span context: (span) => Promise<any>
 * @param {Object} [options={}] - Additional span options (e.g. kind)
 * @returns {Promise<any>} Result of the function
 */
export const traceBusinessSpan = async (spanName, attributes = {}, fn, options = {}) => {
  return getTracer().startActiveSpan(
    spanName,
    {
      kind: options.kind || SpanKind.INTERNAL,
      attributes: {
        "app.system": "pburls",
        ...attributes,
      },
    },
    async (span) => {
      let outcome = "success";
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        outcome = "error";
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message || "Operation failed",
        });
        throw error;
      } finally {
        recordBusinessOperation(
          attributes["business.domain"],
          spanName.replace(/^business\./, ""),
          outcome,
        );
        span.end();
      }
    }
  );
};

/**
 * Business span wrapper for URL Redirection flows.
 *
 * @param {Object} details - { shortCode, targetUrl, cacheHit, customDomain, userId }
 * @param {Function} fn
 */
export const traceRedirect = async ({ shortCode, targetUrl, cacheHit, customDomain, userId }, fn) => {
  const attributes = {
    "business.domain": "redirect",
    "url.short_code": String(shortCode || ""),
    "url.target_url": String(targetUrl || ""),
    "redirect.cache_hit": Boolean(cacheHit),
    "redirect.custom_domain": Boolean(customDomain),
  };
  if (userId) {
    attributes["user.id"] = String(userId);
  }
  return traceBusinessSpan("business.redirect", attributes, fn, { kind: SpanKind.SERVER });
};

/**
 * Business span wrapper for Authentication operations (Login, Register, 2FA, OAuth, JWT Verify).
 *
 * @param {Object} details - { operation, userId, email, authMethod, success }
 * @param {Function} fn
 */
export const traceAuth = async ({ operation, userId, email, authMethod, success }, fn) => {
  const attributes = {
    "business.domain": "authentication",
    "auth.operation": String(operation || "unknown"),
    "auth.method": String(authMethod || "jwt"),
  };
  if (userId) attributes["user.id"] = String(userId);
  if (email) {
    const domain = email.includes("@") ? email.split("@")[1] : "unknown";
    attributes["user.email_domain"] = domain;
  }
  if (typeof success === "boolean") attributes["auth.success"] = success;

  return traceBusinessSpan(`business.auth.${operation || "operation"}`, attributes, fn);
};

/**
 * Business span wrapper for Payment & Billing operations (Razorpay order creation, webhooks, subscriptions).
 *
 * @param {Object} details - { operation, provider, orderId, paymentId, amount, currency, status }
 * @param {Function} fn
 */
export const tracePayment = async ({ operation, provider = "razorpay", orderId, paymentId, amount, currency = "INR", status }, fn) => {
  const attributes = {
    "business.domain": "payments",
    "payment.operation": String(operation || "unknown"),
    "payment.provider": String(provider),
    "payment.currency": String(currency),
  };
  if (orderId) attributes["payment.order_id"] = String(orderId);
  if (paymentId) attributes["payment.id"] = String(paymentId);
  if (typeof amount === "number") attributes["payment.amount"] = amount;
  if (status) attributes["payment.status"] = String(status);

  return traceBusinessSpan(`business.payment.${operation || "operation"}`, attributes, fn);
};

/**
 * Business span wrapper for Analytics tracking & batch processing.
 *
 * @param {Object} details - { operation, eventType, batchSize, urlId }
 * @param {Function} fn
 */
export const traceAnalytics = async ({ operation, eventType, batchSize, urlId }, fn) => {
  const attributes = {
    "business.domain": "analytics",
    "analytics.operation": String(operation || "unknown"),
  };
  if (eventType) attributes["analytics.event_type"] = String(eventType);
  if (typeof batchSize === "number") attributes["analytics.batch_size"] = batchSize;
  if (urlId) attributes["url.id"] = String(urlId);

  return traceBusinessSpan(`business.analytics.${operation || "operation"}`, attributes, fn);
};
