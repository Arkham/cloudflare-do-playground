import type {
  RateLimiter,
  MyDurableObject as MyDurableObjectType,
} from "durable-objects";
export {
  Counter,
  ChatRoom,
  Batcher,
  RateLimiter,
  Location,
  Session,
  Streamer,
  MyDurableObject,
  RpcDO,
  KVStore,
  LatencyTester,
} from "durable-objects";

interface Env {
  COUNTER: DurableObjectNamespace;
  CHAT_ROOM: DurableObjectNamespace;
  BATCHER: DurableObjectNamespace;
  RATE_LIMITER: DurableObjectNamespace<RateLimiter>;
  LOCATION: DurableObjectNamespace;
  SESSION: DurableObjectNamespace;
  STREAMER: DurableObjectNamespace;
  MY_DURABLE_OBJECT: DurableObjectNamespace<MyDurableObjectType>;
  KV_STORE: DurableObjectNamespace;
  LATENCY_TESTER: DurableObjectNamespace;
  KV_CACHE: KVNamespace;
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

    // Route to Session Durable Object
    if (url.pathname.startsWith("/session")) {
      const sessionId = url.searchParams.get("id") || "default";
      const id = env.SESSION.idFromName(sessionId);
      const stub = env.SESSION.get(id);
      return stub.fetch(request);
    }

    // Route to Streamer Durable Object
    if (url.pathname.startsWith("/streamer")) {
      const id = env.STREAMER.idFromName("default");
      const stub = env.STREAMER.get(id);
      const response = await stub.fetch(request);

      // If not a stream response, just return it
      if (!response.ok || !response.body) {
        return response;
      }

      // Check if this is the stream endpoint
      if (url.pathname === "/streamer/stream") {
        // Consume the stream and cancel after 5 messages
        const reader = response.body
          .pipeThrough(new TextDecoderStream())
          .getReader();

        const data: string[] = [];
        let i = 0;

        while (true) {
          // Cancel the stream after 5 messages
          if (i >= 5) {
            await reader.cancel();
            break;
          }

          const { value, done } = await reader.read();

          if (value) {
            const trimmed = value.trim();
            if (trimmed) {
              console.log(`Got value: ${trimmed}`);
              data.push(trimmed);
              i++;
            }
          }

          if (done) {
            break;
          }
        }

        return Response.json({
          message: "Stream cancelled after 5 messages",
          values: data,
        });
      }

      return response;
    }

    // Route to KVStore Durable Object
    if (url.pathname.startsWith("/kv-store")) {
      const roomId = url.searchParams.get("room") || "default";
      const id = env.KV_STORE.idFromName(roomId);
      const stub = env.KV_STORE.get(id);

      // Pass the request to the Durable Object, rewriting the path
      // to remove the /kv-store prefix
      const newUrl = new URL(request.url);
      newUrl.pathname = newUrl.pathname.replace("/kv-store", "");

      return stub.fetch(newUrl.toString(), request);
    }

    // Route to LatencyTester Durable Object
    if (url.pathname.startsWith("/latency-test")) {
      const locationHint = url.searchParams.get("locationHint");
      const baseName = url.searchParams.get("name") || "test";

      // Create a unique DO name for each location hint
      // This ensures each location gets its own DO instance
      const doName = locationHint ? `${baseName}-${locationHint}` : baseName;

      // Create the ID with the location-specific name
      const id = env.LATENCY_TESTER.idFromName(doName);

      // Get the stub with optional location hint
      // The location hint is only respected on the first get() call
      const stub = locationHint
        ? env.LATENCY_TESTER.get(id, {
            locationHint: locationHint as DurableObjectLocationHint,
          })
        : env.LATENCY_TESTER.get(id);

      // Measure the full round-trip time
      const startTime = Date.now();
      const objectResponse = await stub.fetch(request);
      const totalLatency = Date.now() - startTime;

      const data = (await objectResponse.json()) as Record<string, unknown>;

      return Response.json({
        ...data,
        totalLatency,
        locationHint: locationHint || "none",
        doName,
      });
    }

    // Route to RPC Target Durable Object
    if (url.pathname.startsWith("/rpc")) {
      const id: DurableObjectId = env.MY_DURABLE_OBJECT.idFromName(
        url.pathname
      );
      const stub = env.MY_DURABLE_OBJECT.get(id);

      // Set the Durable Object metadata using the RpcTarget
      // Notice that no await is needed here
      const rpcTarget = stub.setMetaData(id.name ?? "default");

      // Call the Durable Object method using the RpcTarget.
      // The DO identifier is stored in the Durable Object's storage
      const greeting = await rpcTarget.computeMessage("world");

      // Call the Durable Object method that does not use the Durable Object identifier
      const simpleGreeting = await rpcTarget.simpleGreeting("world");

      // Get the initialization timestamp as a separate field
      const initializedAt = await rpcTarget.getInitializedAt();

      // Clean up the RpcTarget.
      // Note: Symbol.dispose cleanup is handled automatically by the runtime
      console.log("RpcTarget will be cleaned up automatically.");

      return Response.json({
        greeting,
        simpleGreeting,
        initializedAt,
      });
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
            session: {
              set: "POST /session/set?id=<session_id> (with JSON body {key, value})",
              get: "GET /session/get?id=<session_id>&key=<key>",
              all: "GET /session/all?id=<session_id>",
              description:
                "Auto-cleanup pattern. Session data deletes after 30 seconds of inactivity.",
            },
            streamer: {
              stream: "GET /streamer/stream",
              description:
                "Streaming response pattern. Streams incrementing counter values, worker cancels after 5 messages.",
            },
            rpc: {
              greet: "GET /rpc",
              description:
                "RPC Target pattern. Demonstrates using RpcTarget to pass metadata and call DO methods without direct fetch.",
            },
            kvStore: {
              put: "PUT /kv-store/kv?room=<room_id> (with JSON body {key: string, value: string})",
              get: "GET /kv-store/kv?room=<room_id>&key=<key>",
              delete: "DELETE /kv-store/kv?room=<room_id>&key=<key>",
              stats: "GET /kv-store/stats?room=<room_id>",
              list: "GET /kv-store/list?room=<room_id>&prefix=<prefix>&limit=<limit>",
              description:
                "Workers KV integration. Demonstrates accessing KV namespace from within a Durable Object.",
            },
            latencyTest: {
              test: "GET /latency-test?locationHint=<hint>&name=<do_name>",
              description:
                "Latency testing. Tests DO latency with optional location hints (wnam, enam, sam, weur, eeur, apac, oc, afr, me).",
              hints: [
                "wnam - Western North America",
                "enam - Eastern North America",
                "sam - South America",
                "weur - Western Europe",
                "eeur - Eastern Europe",
                "apac - Asia-Pacific",
                "oc - Oceania",
                "afr - Africa",
                "me - Middle East",
              ],
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
