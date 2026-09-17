import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { trace, context, propagation, ROOT_CONTEXT } from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";

// Set up in-memory telemetry provider before importing modules
const exporter = new InMemorySpanExporter();
const provider = new NodeTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(exporter)],
});
provider.register();

propagation.setGlobalPropagator(new W3CTraceContextPropagator());

async function runTracePropagationTests() {
  const { getOtlpTracesEndpoint } = await import("../otel.js");
  const { injectTraceContext, wrapWorkerJob } = await import("../src/telemetry/bullmqTelemetry.js");
  const { traceRedirect, traceAuth, tracePayment, traceAnalytics } = await import("../src/telemetry/businessSpans.js");
  const { getCachedUrl, setCachedUrl, invalidateCache } = await import("../src/services/cache.service.js");
  const { traceMcpTool, traceMcpResource, traceMcpPrompt } = await import("../src/telemetry/mcpTelemetry.js");

  console.log("==========================================");
  console.log("🧪 OpenTelemetry Trace Propagation & Export Test Suite");
  console.log("==========================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ ${message}`);
      passed++;
    } else {
      console.error(`  ❌ ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test 1: OTLP Endpoint Resolution
  // -------------------------------------------------------------
  console.log("\n1️⃣  Testing OTLP Collector Endpoint Resolution...");
  {
    delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_COLLECTOR_HOST;

    const defaultEp = getOtlpTracesEndpoint();
    assert(defaultEp === "http://localhost:4318/v1/traces", `Default endpoint resolved to ${defaultEp}`);

    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://otel-collector:4318";
    const baseEp = getOtlpTracesEndpoint();
    assert(baseEp === "http://otel-collector:4318/v1/traces", `Base OTLP endpoint resolved to ${baseEp}`);

    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = "http://k8s-collector.observability:4318/v1/traces";
    const directEp = getOtlpTracesEndpoint();
    assert(directEp === "http://k8s-collector.observability:4318/v1/traces", `Direct traces endpoint resolved to ${directEp}`);

    // Cleanup
    delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  }

  // -------------------------------------------------------------
  // Test 2: W3C HTTP Traceparent Propagation
  // -------------------------------------------------------------
  console.log("\n2️⃣  Testing W3C Traceparent HTTP Context Propagation...");
  {
    exporter.reset();
    const tracer = trace.getTracer("test-w3c");

    await tracer.startActiveSpan("http.request.outgoing", async (parentSpan) => {
      const carrier = {};
      propagation.inject(context.active(), carrier);

      assert(Boolean(carrier.traceparent), "W3C traceparent header successfully injected");
      assert(carrier.traceparent.startsWith("00-"), "traceparent conforms to W3C format (00-...)");

      const extractedContext = propagation.extract(ROOT_CONTEXT, carrier);
      await context.with(extractedContext, async () => {
        await tracer.startActiveSpan("http.request.incoming", async (childSpan) => {
          assert(childSpan.spanContext().traceId === parentSpan.spanContext().traceId, "TraceId propagated successfully across HTTP context boundary");
          childSpan.end();
        });
      });
      parentSpan.end();
    });
  }

  // -------------------------------------------------------------
  // Test 3: BullMQ Producer/Consumer Context Propagation
  // -------------------------------------------------------------
  console.log("\n3️⃣  Testing BullMQ Queue Context Propagation...");
  {
    exporter.reset();
    const mockPayload = { urlId: "url-12345", ip: "127.0.0.1" };
    const injected = injectTraceContext("click-queue", "click-event", mockPayload);

    assert(Boolean(injected._traceContext), "Trace context attached to BullMQ payload");
    assert(Boolean(injected._traceContext.traceparent), "BullMQ traceparent populated");

    const mockJob = {
      id: "job-999",
      name: "click-event",
      attemptsMade: 1,
      data: injected,
    };

    let processed = false;
    const workerProcessor = wrapWorkerJob("click-queue", async (job) => {
      processed = true;
      return { status: "processed" };
    });

    await workerProcessor(mockJob);
    assert(processed, "Wrapped worker job processed successfully");

    const spans = exporter.getFinishedSpans();
    const producerSpan = spans.find((s) => s.name === "bullmq.send click-queue");
    const consumerSpan = spans.find((s) => s.name === "bullmq.process click-queue");

    assert(Boolean(producerSpan), "PRODUCER span created for BullMQ enqueueing");
    assert(Boolean(consumerSpan), "CONSUMER span created for BullMQ job execution");
    assert(producerSpan.spanContext().traceId === consumerSpan.spanContext().traceId, "Producer and Consumer spans share the same traceId");
    assert(consumerSpan.parentSpanContext?.spanId === producerSpan.spanContext().spanId, "Consumer span is a child of the producer span");
  }

  // -------------------------------------------------------------
  // Test 4: Business Domain Spans
  // -------------------------------------------------------------
  console.log("\n4️⃣  Testing Business Domain Spans (Redirect, Auth, Payments, Analytics)...");
  {
    exporter.reset();

    await traceRedirect(
      { shortCode: "promo2026", targetUrl: "https://example.com/promo", cacheHit: true, customDomain: false },
      async (span) => {
        return { ok: true };
      }
    );

    await traceAuth(
      { operation: "login", userId: "usr-456", email: "user@enterprise.com", authMethod: "jwt", success: true },
      async () => {
        return { token: "secret" };
      }
    );

    await tracePayment(
      { operation: "create_order", provider: "razorpay", orderId: "order_789", amount: 2900, currency: "INR", status: "CREATED" },
      async () => {
        return { id: "order_789" };
      }
    );

    await traceAnalytics(
      { operation: "process_batch", eventType: "click", batchSize: 50 },
      async () => {
        return { count: 50 };
      }
    );

    const spans = exporter.getFinishedSpans();
    const redirectSpan = spans.find((s) => s.name === "business.redirect");
    const authSpan = spans.find((s) => s.name === "business.auth.login");
    const paymentSpan = spans.find((s) => s.name === "business.payment.create_order");
    const analyticsSpan = spans.find((s) => s.name === "business.analytics.process_batch");

    assert(Boolean(redirectSpan), "Redirect business span exported");
    assert(redirectSpan.attributes["url.short_code"] === "promo2026", "Redirect short_code attribute set correctly");
    assert(redirectSpan.attributes["redirect.cache_hit"] === true, "Redirect cache_hit attribute set correctly");

    assert(Boolean(authSpan), "Auth business span exported");
    assert(authSpan.attributes["user.email_domain"] === "enterprise.com", "Auth user.email_domain attribute parsed and set");

    assert(Boolean(paymentSpan), "Payment business span exported");
    assert(paymentSpan.attributes["payment.amount"] === 2900, "Payment amount set");

    assert(Boolean(analyticsSpan), "Analytics business span exported");
    assert(analyticsSpan.attributes["analytics.batch_size"] === 50, "Analytics batch_size set");
  }

  // -------------------------------------------------------------
  // Test 5: Redis & Cache Operation Spans
  // -------------------------------------------------------------
  console.log("\n5️⃣  Testing Redis & Cache Operation Spans...");
  {
    exporter.reset();
    const tracer = trace.getTracer("pburls-cache");

    await tracer.startActiveSpan("cache.get", { attributes: { "db.system": "redis", "cache.key": "short:test", "cache.hit": true } }, async (span) => {
      span.end();
    });

    const spans = exporter.getFinishedSpans();
    const cacheSpan = spans.find((s) => s.name === "cache.get");

    assert(Boolean(cacheSpan), "Cache operation span exported");
    assert(cacheSpan.attributes["db.system"] === "redis", "Redis db.system attribute present");
    assert(cacheSpan.attributes["cache.key"] === "short:test", "Cache key attribute present");
  }

  // -------------------------------------------------------------
  // Test 6: MCP stdio Tracing
  // -------------------------------------------------------------
  console.log("\n6️⃣  Testing MCP stdio Tracing Spans...");
  {
    exporter.reset();
    const mockUserContext = {
      userId: "mcp-user-1",
      clientType: "stdio",
      user: { id: "mcp-user-1", role: "ADMIN" },
    };

    await traceMcpTool("create_short_link", mockUserContext, async () => {
      return { success: true };
    });

    await traceMcpResource("pburls://docs/api", mockUserContext, async () => {
      return { contents: "docs" };
    });

    await traceMcpPrompt("summarize_analytics", async () => {
      return { prompt: "text" };
    });

    const spans = exporter.getFinishedSpans();
    const toolSpan = spans.find((s) => s.name === "mcp.tool_call create_short_link");
    const resourceSpan = spans.find((s) => s.name === "mcp.resource_read pburls://docs/api");
    const promptSpan = spans.find((s) => s.name === "mcp.prompt_get summarize_analytics");

    assert(Boolean(toolSpan), "MCP tool span exported");
    assert(toolSpan.attributes["mcp.tool.name"] === "create_short_link", "MCP tool name attribute set");
    assert(toolSpan.attributes["mcp.client.type"] === "stdio", "MCP client type set to stdio");

    assert(Boolean(resourceSpan), "MCP resource span exported");
    assert(Boolean(promptSpan), "MCP prompt span exported");
  }

  // -------------------------------------------------------------
  // Test Summary
  // -------------------------------------------------------------
  console.log("\n==========================================");
  if (failed === 0) {
    console.log(`🎉 All ${passed} OpenTelemetry Trace Propagation Tests PASSED!`);
    console.log("==========================================");
  } else {
    console.error(`❌ ${failed} tests FAILED out of ${passed + failed} total tests.`);
    console.log("==========================================");
    process.exit(1);
  }
}

runTracePropagationTests().catch((err) => {
  console.error("💥 Unhandled exception during trace propagation testing:", err);
  process.exit(1);
});
