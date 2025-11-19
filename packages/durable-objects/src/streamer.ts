import { DurableObject } from "cloudflare:workers";

/**
 * Send incremented counter value every second
 * This async generator demonstrates how to produce data incrementally
 * and handle cancellation via AbortSignal
 */
async function* dataSource(signal: AbortSignal) {
  let counter = 0;
  while (!signal.aborted) {
    yield counter++;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  console.log("Data source cancelled");
}

/**
 * Streamer Durable Object
 *
 * This example demonstrates streaming responses with ReadableStream.
 * Shows how to:
 * - Create a streaming response from a Durable Object
 * - Use async generators to produce data incrementally
 * - Handle stream cancellation properly with AbortController
 * - Consume and cancel streams from the worker
 *
 * Key concepts:
 * - ReadableStream API for progressive data delivery
 * - AbortController/AbortSignal for cancellation
 * - Stream cancellation propagation between DO and Worker
 * - TextEncoder/TextDecoder for stream data encoding
 *
 * Common use cases:
 * 1. Server-Sent Events (SSE) - Push notifications to clients
 * 2. Large file processing - Process and stream results incrementally
 * 3. Real-time data feeds - Stock prices, sensor data, logs
 * 4. Progressive rendering - Stream HTML/JSON as it's generated
 * 5. Long-running computations - Stream results as they're computed
 */
export class Streamer extends DurableObject<Record<string, never>> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Stream endpoint - returns incrementing counter values
    if (url.pathname === "/streamer/stream") {
      const abortController = new AbortController();

      const stream = new ReadableStream({
        async start(controller) {
          // Check if request was already cancelled
          if (request.signal.aborted) {
            controller.close();
            abortController.abort();
            return;
          }

          // Stream data from the async generator
          for await (const value of dataSource(abortController.signal)) {
            controller.enqueue(new TextEncoder().encode(String(value) + "\n"));
          }
        },
        cancel() {
          console.log("Stream cancelled by client");
          abortController.abort();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    // Info endpoint
    return new Response(
      JSON.stringify({
        message: "Streamer Durable Object",
        endpoints: {
          stream: "GET /streamer/stream",
        },
        info: "Streams incrementing counter values every second. The worker cancels after 5 messages.",
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
}
