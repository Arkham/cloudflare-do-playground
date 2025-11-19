import type { RateLimiter } from "durable-objects";
export {
  Counter,
  ChatRoom,
  Batcher,
  RateLimiter,
  Location,
} from "durable-objects";

interface Env {
  COUNTER: DurableObjectNamespace;
  CHAT_ROOM: DurableObjectNamespace;
  BATCHER: DurableObjectNamespace;
  RATE_LIMITER: DurableObjectNamespace<RateLimiter>;
  LOCATION: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Route to Counter Durable Object
    if (url.pathname.startsWith("/counter")) {
      const id = env.COUNTER.idFromName("global-counter");
      const stub = env.COUNTER.get(id);
      return stub.fetch(request);
    }

    // Route to ChatRoom Durable Object
    if (url.pathname.startsWith("/chat")) {
      const roomName = url.searchParams.get("room") || "default";
      const id = env.CHAT_ROOM.idFromName(roomName);
      const stub = env.CHAT_ROOM.get(id);
      return stub.fetch(request);
    }

    // Route to Batcher Durable Object
    if (url.pathname.startsWith("/batcher")) {
      const batcherName = url.searchParams.get("name") || "default";
      const id = env.BATCHER.idFromName(batcherName);
      const stub = env.BATCHER.get(id);
      return stub.fetch(request);
    }

    // Route to RateLimiter Durable Object
    if (url.pathname.startsWith("/rate-limit")) {
      const ip = request.headers.get("CF-Connecting-IP") || "default-ip";
      const id = env.RATE_LIMITER.idFromName(ip);
      const stub = env.RATE_LIMITER.get(id);
      return stub.fetch(request);
    }

    // Route to Location Durable Object
    if (url.pathname.startsWith("/location")) {
      const id = env.LOCATION.idFromName("A");
      const stub = env.LOCATION.get(id);
      return stub.fetch(request);
    }

    // Default response with usage instructions
    return new Response(
      JSON.stringify(
        {
          message: "Cloudflare Durable Objects Playground",
          endpoints: {
            counter: {
              increment: "GET /counter/increment",
              decrement: "GET /counter/decrement",
              value: "GET /counter/value",
              reset: "POST /counter/reset",
            },
            chat: {
              send: "POST /chat/send?room=<room_name>",
              messages: "GET /chat/messages?room=<room_name>",
              websocket: "GET /chat/ws?room=<room_name> (upgrade to WebSocket)",
            },
            batcher: {
              queue: "POST /batcher?name=<batcher_name> (with text body)",
              description: "Batches requests for 10 seconds before processing",
            },
            rateLimit: {
              check: "GET /rate-limit",
              description:
                "Token bucket rate limiter based on client IP (10,000 token capacity, 1ms per request)",
            },
            location: {
              check: "GET /location",
              description:
                "Demonstrates in-memory state. Tracks location across requests until DO is evicted from memory.",
            },
          },
        },
        null,
        2
      ),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  },
};
