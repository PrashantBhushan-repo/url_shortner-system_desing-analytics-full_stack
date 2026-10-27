import { trace, context, propagation, SpanKind, SpanStatusCode, ROOT_CONTEXT } from "@opentelemetry/api";
import { queueJobDuration, queueJobsTotal, queueWaitDuration, queueEndToEnd } from "./metrics.js";
import { logger } from './logger.js';

const getTracer = () => trace.getTracer("pburls-bullmq");

/**
 * Injects W3C trace context (traceparent/tracestate) into a BullMQ job's payload
 * and creates a PRODUCER span representing the job enqueueing event.
 *
 * @param {string} queueName - Name of the BullMQ queue (e.g. "click-queue")
 * @param {string} jobName - Name of the job (e.g. "click-event")
 * @param {Object} data - Original job payload data object
 * @returns {Object} Updated data object containing injected _traceContext
 */
export const injectTraceContext = (queueName, jobName, data = {}) => {
  const span = getTracer().startSpan(`bullmq.send ${queueName}`, {
    kind: SpanKind.PRODUCER,
    attributes: {
      "messaging.system": "bullmq",
      "messaging.destination.name": queueName,
      "messaging.destination.kind": "queue",
      "messaging.operation": "publish",
      "messaging.job.name": jobName,
    },
  });

  if (data?.urlId) {
    span.setAttribute("url.id", String(data.urlId));
  }

  const carrier = {};
  const spanContext = trace.setSpan(context.active(), span);
  propagation.inject(spanContext, carrier);

  span.end();

  return {
    ...data,
    _traceContext: carrier,
  };
};

/**
 * Wraps a BullMQ worker job processor function with OpenTelemetry CONSUMER span
 * and extracts the incoming trace context from the job's payload.
 *
 * @param {string} queueName - Name of the BullMQ queue
 * @param {Function} processor - Job processor callback function (job) => Promise<any>
 * @returns {Function} Wrapped processor function
 */
export const wrapWorkerJob = (queueName, processor) => {
  return async (job) => {
    const parentContext = job?.data?._traceContext
      ? propagation.extract(ROOT_CONTEXT, job.data._traceContext)
      : context.active();

    const spanName = `bullmq.process ${queueName}`;
    return context.with(parentContext, async () => {
      return getTracer().startActiveSpan(
        spanName,
        {
          kind: SpanKind.CONSUMER,
          attributes: {
            "messaging.system": "bullmq",
            "messaging.destination.name": queueName,
            "messaging.destination.kind": "queue",
            "messaging.operation": "process",
            "messaging.job.id": String(job.id || "unknown"),
            "messaging.job.name": String(job.name || "unknown"),
            "messaging.job.attempts": job.attemptsMade || 0,
          },
        },
        async (span) => {
          const startedAt = process.hrtime.bigint();
          const wait = Math.max(0, (Date.now() - Number(job.timestamp || Date.now())) / 1000);
          queueWaitDuration.observe({ queue: queueName }, wait);
          let outcome = "success";
          if (job.data?.urlId) {
            span.setAttribute("url.id", String(job.data.urlId));
          }

          try {
            const result = await processor(job);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (error) {
            outcome = "failed";
            span.recordException(error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message || "Job processing failed",
            });
            throw error;
          } finally {
            const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
            queueJobsTotal.inc({ queue: queueName, outcome });
            queueJobDuration.observe({ queue: queueName }, durationSeconds);
            if (outcome === 'success') queueEndToEnd.observe({ queue: queueName }, wait + durationSeconds);
            if (outcome === 'failed') logger.error('queue.job.failed', { queue: queueName, outcome, duration_ms: durationSeconds * 1000 });
            span.end();
          }
        }
      );
    });
  };
};
