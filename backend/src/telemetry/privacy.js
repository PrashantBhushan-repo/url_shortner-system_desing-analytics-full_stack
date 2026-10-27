// Export an explicit allowlist. SQL, URLs, headers, IDs and exception text can
// contain credentials or customer data, even when collected by auto instrumentation.
const safeKeys = new Set([
  'http.route', 'http.request.method', 'http.method', 'http.response.status_code',
  'http.status_code', 'http.server.duration_ms', 'db.system', 'db.system.name',
  'db.operation', 'db.operation.name', 'messaging.system', 'messaging.destination.name',
  'messaging.destination.kind', 'messaging.operation', 'messaging.job.name',
  'messaging.job.attempts', 'business.domain', 'business.operation', 'cache.hit',
  'exception.type', 'rpc.system',
]);
export const safeAttributes = (attributes = {}) => Object.fromEntries(
  Object.entries(attributes).filter(([key]) => safeKeys.has(key)),
);

export class PrivateTraceExporter {
  constructor(exporter) { this.exporter = exporter; }
  export(spans, callback) {
    this.exporter.export(spans.map(span => ({
      ...span,
      // Preserve SDK span methods used by the OTLP serializer.
      spanContext: () => span.spanContext(),
      duration: span.duration,
      droppedAttributesCount: span.droppedAttributesCount,
      droppedEventsCount: span.droppedEventsCount,
      droppedLinksCount: span.droppedLinksCount,
      name: /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/.test(span.name)
        ? `${span.attributes['http.request.method'] || span.attributes['http.method'] || span.name.split(' ')[0]} ${span.attributes['http.route'] || 'request'}`
        : span.name,
      attributes: safeAttributes(span.attributes),
      status: { code: span.status.code },
      events: span.events.map(event => ({ ...event, attributes: safeAttributes(event.attributes) })),
      links: [],
    })), callback);
  }
  shutdown() { return this.exporter.shutdown(); }
  forceFlush() { return this.exporter.forceFlush?.() || Promise.resolve(); }
}
