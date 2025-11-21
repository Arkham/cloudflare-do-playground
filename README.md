# Cloudflare Durable Objects Playground

A workspaces-enabled TypeScript project for experimenting with Cloudflare Durable Objects.

## Project Structure

This is a monorepo using npm workspaces with two packages:

```
cloudflare-do-playground/
├── packages/
│   ├── worker/          # Cloudflare Worker entry point
│   └── durable-objects/ # Durable Object implementations
├── package.json         # Root workspace configuration (with workspaces field)
├── tsconfig.json        # Shared TypeScript config
└── .gitignore
```

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- npm (v7 or higher, comes with Node.js)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (installed as dev dependency)
- Cloudflare account (for deployment)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

This starts the Wrangler dev server with local Durable Objects support.

### 3. Test the Endpoints

#### Counter Example

```bash
# Get current counter value
curl http://localhost:8787/counter/value

# Increment counter
curl http://localhost:8787/counter/increment

# Decrement counter
curl http://localhost:8787/counter/decrement

# Reset counter
curl -X POST http://localhost:8787/counter/reset
```

#### Chat Room Example (HTTP API)

```bash
# Send a message
curl -X POST http://localhost:8787/chat/send?room=lobby \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, world!", "username": "Alice"}'

# Get message history
curl http://localhost:8787/chat/messages?room=lobby
```

#### Chat Room Example (WebSocket)

You can test WebSocket connections using a WebSocket client or browser console:

```javascript
const ws = new WebSocket("ws://localhost:8787/chat/ws?room=lobby");

ws.onopen = () => {
  console.log("Connected to chat room");
  ws.send(
    JSON.stringify({
      type: "message",
      text: "Hello from WebSocket!",
      username: "Alice",
    })
  );
};

ws.onmessage = (event) => {
  console.log("Received:", JSON.parse(event.data));
};
```

#### Batcher Example

```bash
# Batching mode: Queue items to be batched (they'll be processed together after 10 seconds)
curl -X POST http://localhost:8787/batcher?name=foo -d "Request 1"
curl -X POST http://localhost:8787/batcher?name=foo -d "Request 2"
curl -X POST http://localhost:8787/batcher?name=foo -d "Request 3"

# Debouncing mode: Send JSON with debounce flag (resets timer on each request)
curl -X POST http://localhost:8787/batcher?name=bar \
  -H "Content-Type: application/json" \
  -d '{"debounce": true, "data": "Message 1"}'
curl -X POST http://localhost:8787/batcher?name=bar \
  -H "Content-Type: application/json" \
  -d '{"debounce": true, "data": "Message 2"}'

# Each request returns:
# {"queued": 1, "debounce": false}
# {"queued": 2, "debounce": true}
# etc.

# Batching mode: After 10 seconds from first request, alarm fires
# Debouncing mode: After 10 seconds of silence, alarm fires
```

#### Rate Limiter Example

```bash
# Make a request (will be allowed if tokens available)
curl http://localhost:8787/rate-limit

# Success response:
# {"success":true,"message":"Request allowed - upstream resource would be called here"}

# Make multiple requests rapidly to trigger rate limiting
for i in {1..100}; do
  curl http://localhost:8787/rate-limit
  sleep 0.01
done

# Eventually you'll see rate limited responses:
# {"error":"Rate limit exceeded","retry_after_ms":1}
```

#### Location Example (In-Memory State)

```bash
# First request - location will be null
curl http://localhost:8787/location

# Second request (within a short time) - shows previous location
curl http://localhost:8787/location

# Wait several minutes, then request again - DO may be evicted and restarted
# You'll see the first request message again
```

#### Session Example (Auto-Cleanup Pattern)

```bash
# Store session data
curl -X POST http://localhost:8787/session/set?id=user123 \
  -H "Content-Type: application/json" \
  -d '{"key": "username", "value": "alice"}'

# Get session data
curl http://localhost:8787/session/get?id=user123&key=username

# Get all session data
curl http://localhost:8787/session/all?id=user123

# Wait 30+ seconds without making requests, then check again
# Session data will be automatically deleted
curl http://localhost:8787/session/all?id=user123
```

#### Streamer Example (Streaming Response Pattern)

```bash
# Request the stream endpoint (worker will collect 5 messages and cancel)
curl http://localhost:8787/streamer/stream

# Response after collecting 5 messages:
# {"message":"Stream cancelled after 5 messages","values":["0","1","2","3","4"]}

# Get info about the streamer
curl http://localhost:8787/streamer
```

#### RPC Target Example

```bash
# Call the RPC Target endpoint
curl http://localhost:8787/rpc

# Response:
# {
#   "greeting": "Hello, world! The identifier of this DO is /rpc",
#   "simpleGreeting": "Hello, world! This doesn't use the DO identifier.",
#   "initializedAt": "2024-01-15T10:30:45.123Z"
# }

# Call it again immediately - you'll see the SAME timestamp (DO is still in memory)
curl http://localhost:8787/rpc

# Wait several minutes, then call again - if the DO was evicted, you'll see a NEW timestamp
```

#### KV Store Example

```bash
# Write to KV
curl -X PUT 'http://localhost:8787/kv-store/kv?room=my-room' \
  -H "Content-Type: application/json" \
  -d '{"key": "user:123", "value": "Alice"}'

# Read from KV
curl 'http://localhost:8787/kv-store/kv?room=my-room&key=user:123'

# List keys with prefix
curl 'http://localhost:8787/kv-store/list?room=my-room&prefix=user:&limit=10'

# Get statistics
curl 'http://localhost:8787/kv-store/stats?room=my-room'

# Delete from KV
curl -X DELETE 'http://localhost:8787/kv-store/kv?room=my-room&key=user:123'
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run deploy` - Deploy to Cloudflare Workers
- `npm run type-check` - Run TypeScript type checking across all packages
- `npm run build` - Build all packages
- `npm run test:latency <worker-url> [requests]` - Run latency tests across all supported locations

## Durable Objects

This playground includes the following Durable Objects:

### 1. Counter

A simple counter demonstrating:

- Persistent storage using `this.ctx.storage`
- State management across requests
- HTTP request handling

**Endpoints:**

- `GET /counter/value` - Get current counter value
- `GET /counter/increment` - Increment counter
- `GET /counter/decrement` - Decrement counter
- `POST /counter/reset` - Reset counter to 0

### 2. ChatRoom

A real-time chat room demonstrating:

- WebSocket connections
- Broadcasting messages to multiple clients
- Message history storage
- Connection state management

**Endpoints:**

- `GET /chat/ws?room=<name>` - WebSocket connection (upgrade required)
- `POST /chat/send?room=<name>` - Send message via HTTP
- `GET /chat/messages?room=<name>` - Get message history

### 3. Batcher

A request batcher demonstrating:

- Alarm functionality for scheduled processing
- Batching multiple requests over a time window
- Automatic processing after a delay
- State persistence during batching

**Endpoints:**

- `POST /batcher?name=<name>` - Queue a request to be batched
  - Send plain text for batching mode
  - Send JSON with `{"debounce": true, ...}` for debouncing mode

**How it works:**

The Batcher supports two modes:

**Batching mode** (default):

- When the first request arrives, an alarm is set for 10 seconds in the future
- All subsequent requests within that 10-second window are added to the batch
- After 10 seconds from the first request, the `alarm()` method is triggered automatically
- This is useful for aggregating requests to external APIs to reduce API calls

**Debouncing mode** (`debounce: true` in JSON payload):

- Each new request resets the alarm to 10 seconds from now
- The batch only processes after 10 seconds of silence (no new requests)
- Useful for scenarios like search input where you want to wait for user to finish typing

In both modes:

- The alarm processes all batched items together and clears the batch
- Items are stored persistently until processed

**Example:**

```bash
# Batching mode: Queue multiple items (plain text or JSON without debounce flag)
curl -X POST http://localhost:8787/batcher?name=foo -d "Item 1"
curl -X POST http://localhost:8787/batcher?name=foo -d "Item 2"
curl -X POST http://localhost:8787/batcher?name=foo -d "Item 3"
# Processes after 10 seconds from first request

# Debouncing mode: Send with debounce flag
curl -X POST http://localhost:8787/batcher?name=bar \
  -H "Content-Type: application/json" \
  -d '{"debounce": true, "data": "Item 1"}'
curl -X POST http://localhost:8787/batcher?name=bar \
  -H "Content-Type: application/json" \
  -d '{"debounce": true, "data": "Item 2"}'
# Processes after 10 seconds of silence

# Check your worker logs to see the batch processing
```

### 4. RateLimiter

A token bucket rate limiter demonstrating:

- Alarm functionality for periodic token refills
- Per-IP rate limiting using Durable Object instances
- Token bucket algorithm implementation
- Automatic state management with alarms

**Endpoints:**

- `GET /rate-limit` - Check rate limit and consume a token

**How it works:**

The RateLimiter implements a token bucket algorithm:

- Each client IP gets its own Durable Object instance (identified by IP address)
- Token bucket capacity: 10,000 tokens
- Token consumption rate: 1 millisecond per request
- Token refill: 5,000 tokens every 5 seconds (via alarms)

**Token Bucket Algorithm:**

1. Initially, each IP has 10,000 tokens available
2. Each request consumes 1 token
3. If tokens are available, the request is allowed (returns 200)
4. If no tokens are available, the request is rate-limited (returns 429)
5. An alarm periodically refills tokens (adds 5,000 tokens every 5 seconds, up to capacity)
6. The alarm automatically reschedules itself to keep refilling tokens

**Example:**

```bash
# Make a request (will be allowed if tokens available)
curl http://localhost:8787/rate-limit

# Success response (200):
# {
#   "success": true,
#   "message": "Request allowed - upstream resource would be called here"
# }

# Rate limited response (429):
# {
#   "error": "Rate limit exceeded",
#   "retry_after_ms": 1
# }

# Make multiple requests rapidly to test rate limiting
for i in {1..100}; do curl http://localhost:8787/rate-limit; echo; done

# Try again within 5 seconds to see rate limiting kick in
for i in {1..100}; do curl http://localhost:8787/rate-limit; echo; done
```

**Configuration:**

You can adjust the rate limiting parameters by modifying the static constants in `rate-limiter.ts`:

```typescript
static readonly milliseconds_per_request = 10;      // Time cost per request
static readonly milliseconds_for_updates = 5000;   // Refill interval
static readonly capacity = 100;                  // Maximum tokens
```

### 5. In-Memory State

An in-memory state example demonstrating:

- In-memory state that persists only while the Durable Object is active
- Understanding Durable Object lifecycle and memory eviction
- The difference between in-memory vs persistent storage

**Endpoints:**

- `GET /location` - Check and update location state

**How it works:**

The Location Durable Object tracks location across requests, but only in memory:

- On the first request, `this.location` is `null` because the constructor was just called
- Each request updates `this.location` with the current city from Cloudflare's edge data
- If the Durable Object stays in memory, subsequent requests will see the previous location
- When the Durable Object is evicted from memory due to inactivity, `this.location` resets to `null`

**Example:**

```bash
# First request - location will be null
curl http://localhost:8787/location

# Response:
# This is the first request, you called the constructor, so this.location was null.
# You will set this.location to be your city: (San Francisco). Try reloading the page.

# Second request (within a short time) - location will show previous value
curl http://localhost:8787/location

# Response:
# The Durable Object was already loaded and running because it recently handled a request.
#
# Previous Location: San Francisco
# New Location: San Francisco

# Wait a while (several minutes), then request again - DO may be evicted and restarted
# You'll see the first request message again with null location
```

**Key Concepts:**

This example demonstrates the Durable Object lifecycle:

1. **Constructor call**: Happens when the DO is created or loaded into memory
2. **Memory retention**: While active, the DO stays in memory with state preserved
3. **Eviction**: After prolonged inactivity, Cloudflare evicts the DO from memory
4. **Recreation**: Next request after eviction triggers a new constructor call

This is different from using `this.ctx.storage` which persists data across evictions. In-memory state is useful for temporary caching, connection pools, or stateful operations that don't need long-term persistence.

### 6. Session (Auto-Cleanup Pattern)

A session store demonstrating:

- Auto-cleanup using alarms with a TTL pattern
- Activity-based persistence (active = persists, inactive = auto-deletes)
- Controlled data lifecycle management
- Practical session management

**Endpoints:**

- `POST /session/set?id=<session_id>` - Store session data (JSON body: `{key, value}`)
- `GET /session/get?id=<session_id>&key=<key>` - Retrieve session data
- `GET /session/all?id=<session_id>` - Get all session data

**How it works:**

The Session Durable Object implements an auto-cleanup pattern using alarms:

1. **Every request resets the TTL**: Each `fetch()` call sets an alarm for 30 seconds in the future
2. **Activity extends the session**: If another request comes before the alarm fires, the alarm is **overwritten** with a new one
3. **Inactivity triggers cleanup**: If no requests come for 30 seconds, the `alarm()` handler fires and calls `deleteAll()`

**Example:**

```bash
# Store some session data
curl -X POST http://localhost:8787/session/set?id=user123 \
  -H "Content-Type: application/json" \
  -d '{"key": "username", "value": "alice"}'

curl -X POST http://localhost:8787/session/set?id=user123 \
  -H "Content-Type: application/json" \
  -d '{"key": "cart_items", "value": "3"}'

# Retrieve specific key
curl 'http://localhost:8787/session/get?id=user123&key=username'
# Response: {"key":"username","value":"alice","exists":true,"ttl_seconds":30,...}

# Get all session data
curl http://localhost:8787/session/all?id=user123
# Response: {"data":{"username":"alice","cart_items":"3"},"count":2,...}

# Keep making requests within 30 seconds - session stays alive
curl http://localhost:8787/session/all?id=user123  # Resets TTL
# ... wait 15 seconds ...
curl http://localhost:8787/session/all?id=user123  # Resets TTL again

# Wait 30+ seconds without any requests, then check
sleep 35
curl http://localhost:8787/session/all?id=user123
# Response: {"data":{},"count":0,...}  # All data auto-deleted!
```

**Key Concepts:**

This pattern creates **activity-based persistence**:

- **Active sessions** (receiving requests) = data persists indefinitely (alarm keeps resetting)
- **Inactive sessions** (no requests) = data auto-deletes after TTL expires

**Comparison with Location example:**

- **Location (In-Memory State)**: Resets when Cloudflare evicts the DO from memory (you have no control)
- **Session (Auto-Cleanup)**: You explicitly control when data is deleted based on inactivity (using persistent storage + alarms)

**Common Use Cases:**

1. **User sessions** - Auto-expire after inactivity
2. **Shopping carts** - Clear abandoned carts after 30 minutes
3. **Temporary caches** - Auto-clear stale cached data
4. **Chat rooms** - Delete room data when everyone leaves
5. **Rate limit windows** - Reset counters after inactivity
6. **Cost optimization** - Automatically clean up storage you no longer need

### 7. Streamer (Streaming Response Pattern)

A streaming response example demonstrating:

- ReadableStream API for progressive data delivery
- Async generators for incremental data production
- Stream cancellation with AbortController/AbortSignal
- Stream consumption and cancellation from the worker

**Endpoints:**

- `GET /streamer/stream` - Get a streaming response (worker cancels after 5 messages)
- `GET /streamer` - Info endpoint

**How it works:**

The Streamer Durable Object demonstrates streaming responses:

1. **Durable Object creates a stream**: The DO returns a ReadableStream that produces data incrementally
2. **Async generator produces data**: An async generator yields values (incrementing counter) every second
3. **Worker consumes the stream**: The worker reads from the stream progressively
4. **Worker cancels the stream**: After collecting 5 messages, the worker calls `reader.cancel()`
5. **Cancellation propagates**: The cancel signal propagates to the DO, stopping the async generator

**Example:**

```bash
# Request the stream endpoint
curl http://localhost:8787/streamer/stream

# The worker will:
# 1. Connect to the Streamer DO
# 2. Start receiving streamed values (0, 1, 2, 3, 4)
# 3. After 5 messages, cancel the stream
# 4. Return collected values

# Response:
# {
#   "message": "Stream cancelled after 5 messages",
#   "values": ["0", "1", "2", "3", "4"]
# }
```

**Key Concepts:**

This pattern demonstrates **streaming responses with proper cancellation**:

- **ReadableStream**: Allows progressive data delivery without buffering everything in memory
- **AbortController**: Provides a way to cancel ongoing operations
- **Stream cancellation**: When the consumer cancels, the producer is notified and can clean up

**Comparison with other patterns:**

- **Counter (Request-Response)**: Each request is independent, blocking until complete
- **Streamer (Streaming)**: Single request, multiple progressive responses, can be cancelled mid-stream

**Common Use Cases:**

1. **Server-Sent Events (SSE)** - Push real-time notifications to clients
2. **Large file processing** - Process and stream results chunk-by-chunk
3. **Real-time data feeds** - Stock prices, sensor data, log streaming
4. **Progressive rendering** - Stream HTML/JSON as it's generated
5. **Long-running computations** - Stream results as they're computed
6. **AI/LLM responses** - Stream tokens as they're generated (like ChatGPT)

**Implementation Details:**

The Durable Object:

```typescript
// Creates a ReadableStream from an async generator
const stream = new ReadableStream({
  async start(controller) {
    for await (const value of dataSource(abortController.signal)) {
      controller.enqueue(new TextEncoder().encode(String(value) + "\n"));
    }
  },
  cancel() {
    console.log("Stream cancelled by client");
    abortController.abort();
  },
});
```

The Worker:

```typescript
// Consumes the stream and cancels after 5 messages
const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
let i = 0;
while (true) {
  if (i >= 5) {
    await reader.cancel(); // Propagates to DO's cancel() handler
    break;
  }
  const { value, done } = await reader.read();
  // ... process value ...
  i++;
}
```

### 8. RPC Target (RpcTarget Pattern)

An RPC Target example demonstrating:

- Using `RpcTarget` to expose methods without HTTP fetch
- Passing metadata and state between worker and Durable Object
- Separating public API from internal implementation
- Direct method invocation without HTTP overhead
- Tracking Durable Object lifecycle with initialization timestamps

**Endpoints:**

- `GET /rpc` - Call Durable Object methods via RpcTarget

**How it works:**

The RPC Target pattern uses Cloudflare's `RpcTarget` class to enable direct method calls to Durable Objects without using the `fetch()` API:

1. **RpcDO extends RpcTarget**: Create a class that extends `RpcTarget` and wraps the Durable Object
2. **Metadata initialization**: The DO's `setMetaData()` method returns an `RpcDO` instance with stored context
3. **Direct method calls**: The worker calls methods on the RpcTarget, which are forwarded to the DO
4. **No await on initialization**: The RpcTarget is created without awaiting, enabling immediate method calls
5. **Automatic cleanup**: The runtime handles cleanup of RpcTarget instances automatically

**Example:**

```bash
# Call the RPC endpoint
curl http://localhost:8787/rpc

# Response:
# {
#   "greeting": "Hello, world! The identifier of this DO is /rpc",
#   "simpleGreeting": "Hello, world! This doesn't use the DO identifier.",
#   "initializedAt": "2024-01-15T10:30:45.123Z"
# }

# The initialization timestamp demonstrates when the DO constructor was called.
# This timestamp will remain the same as long as the DO stays in memory.
# If the DO is evicted and later recreated, you'll see a new timestamp.
```

**Key Concepts:**

This pattern demonstrates **RPC-style communication with Durable Objects**:

- **RpcTarget**: Enables method calls without HTTP overhead
- **Metadata passing**: Store and pass context (like DO identifiers) between calls
- **Selective exposure**: Only methods in the RpcTarget class are accessible from the worker
- **Type safety**: Full TypeScript support for method signatures

**Comparison with other patterns:**

- **Counter (fetch API)**: Uses HTTP request/response cycle for all communication
- **RPC Target**: Direct method invocation, bypassing HTTP serialization

**Common Use Cases:**

1. **Internal services** - When DO methods are called from workers, not external clients
2. **Performance-critical paths** - Reduce overhead of HTTP serialization
3. **Complex method signatures** - Pass rich objects without manual serialization
4. **Microservices architecture** - Service-to-service communication
5. **Stateful computations** - Pass context and state between calls efficiently

**Implementation Details:**

The RpcDO class (wraps the Durable Object):

```typescript
export class RpcDO extends RpcTarget {
  constructor(private mainDo: MyDurableObject, private doIdentifier: string) {
    super();
  }

  async computeMessage(userName: string) {
    return this.mainDo.computeMessage(userName, this.doIdentifier);
  }

  async simpleGreeting(userName: string) {
    return this.mainDo.simpleGreeting(userName);
  }

  async getInitializedAt() {
    return this.mainDo.getInitializedAt();
  }
}
```

The Durable Object:

```typescript
export class MyDurableObject extends DurableObject {
  private initializedAt: string;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    // Store the timestamp when this Durable Object was initialized
    this.initializedAt = new Date().toISOString();
    console.log(`Durable Object initialized at: ${this.initializedAt}`);
  }

  async setMetaData(doIdentifier: string) {
    await this.ctx.storage.put("doIdentifier", doIdentifier);
    return new RpcDO(this, doIdentifier);
  }

  async computeMessage(userName: string, doIdentifier: string) {
    const storedIdentifier = await this.ctx.storage.get<string>("doIdentifier");
    return `Hello, ${userName}! The identifier of this DO is ${doIdentifier}`;
  }

  async simpleGreeting(userName: string) {
    return `Hello, ${userName}! This doesn't use the DO identifier.`;
  }

  async getInitializedAt() {
    return this.initializedAt;
  }
}
```

The Worker:

```typescript
// Get Durable Object stub
const id = env.MY_DURABLE_OBJECT.idFromName(url.pathname);
const stub = env.MY_DURABLE_OBJECT.get(id);

// Create RpcTarget (no await needed)
const rpcTarget = stub.setMetaData(id.name ?? "default");

// Call methods directly
const greeting = await rpcTarget.computeMessage("world");
const simpleGreeting = await rpcTarget.simpleGreeting("world");

// Get the initialization timestamp as a separate field
const initializedAt = await rpcTarget.getInitializedAt();

// Cleanup is handled automatically by the runtime
console.log("RpcTarget will be cleaned up automatically.");

// Return structured response
return Response.json({
  greeting,
  simpleGreeting,
  initializedAt,
});
```

**Benefits:**

- **Less boilerplate**: No need to parse URLs, handle HTTP methods, or serialize/deserialize
- **Type safety**: Method signatures are preserved, enabling IDE autocomplete and type checking
- **Performance**: Reduced overhead compared to HTTP fetch
- **Flexibility**: Mix public (fetch) and internal (RPC) APIs in the same DO

### 9. KV Store (Workers KV Integration)

A KV integration example demonstrating:

- Accessing Workers KV namespace from within a Durable Object
- Using KV for high-performance read operations
- Combining KV (distributed cache) with DO storage (transactional data)
- Tracking metadata about KV operations in DO storage
- Hybrid storage strategies

**Endpoints:**

- `PUT /kv-store/kv?room=<room_id>` - Write to KV (JSON body: `{key: string, value: string}`)
- `GET /kv-store/kv?room=<room_id>&key=<key>` - Read from KV
- `DELETE /kv-store/kv?room=<room_id>&key=<key>` - Delete from KV
- `GET /kv-store/stats?room=<room_id>` - Get operation statistics
- `GET /kv-store/list?room=<room_id>&prefix=<prefix>&limit=<limit>` - List keys with prefix

**How it works:**

The KVStore Durable Object demonstrates how to use Workers KV from within a Durable Object:

1. **KV namespace binding**: The DO receives the KV namespace via its `env` parameter
2. **Write operations**: Data is written to KV using `env.KV_CACHE.put()`
3. **Read operations**: Data is read from KV using `env.KV_CACHE.get()`
4. **Metadata tracking**: Operation counts and last accessed keys are tracked in DO storage
5. **Hybrid storage**: Combines KV (fast reads) with DO storage (transactional writes)

**Example:**

```bash
# Write a key-value pair to KV
curl -X PUT 'http://localhost:8787/kv-store/kv?room=my-room' \
  -H "Content-Type: application/json" \
  -d '{"key": "user:123", "value": "Alice"}'

# Response:
# {
#   "success": true,
#   "message": "Wrote key \"user:123\" to KV",
#   "write_count": 1
# }

# Write more data
curl -X PUT 'http://localhost:8787/kv-store/kv?room=my-room' \
  -H "Content-Type: application/json" \
  -d '{"key": "user:456", "value": "Bob"}'

curl -X PUT 'http://localhost:8787/kv-store/kv?room=my-room' \
  -H "Content-Type: application/json" \
  -d '{"key": "product:789", "value": "Laptop"}'

# Read a value from KV
curl 'http://localhost:8787/kv-store/kv?room=my-room&key=user:123'

# Response:
# {
#   "key": "user:123",
#   "value": "Alice",
#   "found": true,
#   "read_count": 1
# }

# List keys with a prefix
curl 'http://localhost:8787/kv-store/list?room=my-room&prefix=user:&limit=10'

# Response:
# {
#   "keys": ["user:123", "user:456"],
#   "list_complete": true,
#   "cursor": null,
#   "count": 2
# }

# Get statistics about operations
curl 'http://localhost:8787/kv-store/stats?room=my-room'

# Response:
# {
#   "statistics": {
#     "total_writes": 3,
#     "total_reads": 1,
#     "last_key_written": "product:789",
#     "last_key_read": "user:123"
#   },
#   "note": "Statistics are tracked in Durable Object storage, while actual data is in KV"
# }

# Delete a key from KV
curl -X DELETE 'http://localhost:8787/kv-store/kv?room=my-room&key=user:123'

# Response:
# {
#   "success": true,
#   "message": "Deleted key \"user:123\" from KV"
# }
```

**Key Concepts:**

This pattern demonstrates **combining Workers KV with Durable Objects**:

- **KV namespace access**: DOs can access KV namespaces passed through the `env` parameter
- **Complementary storage**: Use KV for read-heavy data, DO storage for write-heavy/transactional data
- **Metadata tracking**: Track KV operations in DO storage for analytics and monitoring
- **Multi-instance isolation**: Each DO instance (by room ID) can track its own statistics

**Comparison with other patterns:**

- **Counter (DO storage only)**: Uses only Durable Object storage for all data
- **KV Store (Hybrid)**: Uses KV for data storage and DO storage for metadata/statistics

**Common Use Cases:**

1. **Caching layer** - Use KV as a fast read cache with DO coordinating cache invalidation
2. **User sessions** - Store session data in KV, track active sessions in DO
3. **Content distribution** - Cache rendered content in KV, manage updates through DO
4. **Configuration management** - Store config in KV, update atomically through DO
5. **Rate limiting with persistence** - Use DO for rate limiting logic, KV for allowlists/blocklists
6. **Analytics aggregation** - Write raw events to KV, aggregate in DO, flush to external systems

**Storage Strategy Comparison:**

| Feature               | Workers KV                 | Durable Object Storage          |
| --------------------- | -------------------------- | ------------------------------- |
| **Read Performance**  | Very fast (edge-cached)    | Fast (but not edge-cached)      |
| **Write Performance** | Eventually consistent      | Strongly consistent             |
| **Read Cost**         | Free reads                 | Storage API charges             |
| **Write Cost**        | Per write + storage        | Included in request cost        |
| **Consistency**       | Eventually consistent      | Strong consistency              |
| **Best For**          | Read-heavy, cacheable data | Write-heavy, transactional data |

**Implementation Details:**

The Durable Object receives the KV namespace binding:

```typescript
interface Env {
  KV_CACHE: KVNamespace;
}

export class KVStore extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // env.KV_CACHE is now available
  }

  async fetch(request: Request): Promise<Response> {
    // Write to KV
    await this.env.KV_CACHE.put("some-key", "some-value");

    // Read from KV
    const value = await this.env.KV_CACHE.get("some-key");

    // Track metadata in DO storage
    const writeCount = (await this.ctx.storage.get<number>("write_count")) || 0;
    await this.ctx.storage.put("write_count", writeCount + 1);

    return Response.json({ value });
  }
}
```

The Worker binds both the DO and KV namespace:

```typescript
interface Env {
  KV_STORE: DurableObjectNamespace;
  KV_CACHE: KVNamespace; // Same namespace passed to DO
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const roomId = new URL(request.url).searchParams.get("room") || "default";
    const id = env.KV_STORE.idFromName(roomId);
    const stub = env.KV_STORE.get(id);

    // The DO will have access to env.KV_CACHE
    return stub.fetch(request);
  },
};
```

### 10. LatencyTester (Location Hints & Latency Testing)

A latency testing example demonstrating:

- Using location hints to control DO placement
- Testing latency across different geographic regions
- Fetching Cloudflare trace data to determine actual DO location
- Automated testing across all supported locations
- Understanding how location affects performance

**Endpoints:**

- `GET /latency-test?locationHint=<hint>&name=<base_name>` - Test latency with optional location hint

**How it works:**

The LatencyTester Durable Object demonstrates location hints for optimal DO placement:

1. **Location hints**: Each location hint creates a **unique Durable Object** in the specified region
2. **Trace data**: The DO fetches Cloudflare's `/cdn-cgi/trace` to report its actual data center
3. **Latency measurement**: The worker measures round-trip time and processing time
4. **Persistent location**: Once created, a DO stays in its location (doesn't move)

**Example:**

```bash
# Test Eastern North America
curl 'http://localhost:8787/latency-test?locationHint=enam'

# Response:
# {
#   "trace": {
#     "colo": "EWR",
#     "loc": "US",
#     ...
#   },
#   "processingTime": 45,
#   "timestamp": "2025-11-21T12:34:56.789Z",
#   "totalLatency": 123,
#   "locationHint": "enam",
#   "doName": "test-enam"
# }

# Test Western Europe
curl 'http://localhost:8787/latency-test?locationHint=weur'

# Test without location hint
curl 'http://localhost:8787/latency-test'
```

**Supported Location Hints:**

According to [Cloudflare's documentation](https://developers.cloudflare.com/durable-objects/reference/data-location/#provide-a-location-hint):

- `wnam` - Western North America
- `enam` - Eastern North America
- `sam` - South America
- `weur` - Western Europe
- `eeur` - Eastern Europe
- `apac` - Asia-Pacific
- `oc` - Oceania
- `afr` - Africa
- `me` - Middle East

**Automated Testing:**

Run the included test script to benchmark all locations:

```bash
# Test with 50 requests per location (default)
npm run test:latency https://your-worker.workers.dev

# Test with custom number of requests
npm run test:latency https://your-worker.workers.dev 100
```

The script will:
- Create a unique DO for each of the 9 supported locations
- Make N requests to each DO
- Calculate average, min, and max latencies
- Sort results by average latency
- Report which colos (data centers) each DO is running in
- Save detailed results to a JSON file

**Example output:**

```
======================================================================
RESULTS (sorted by average latency)
======================================================================

1. Eastern North America (enam)
   Average Total Latency:  98.45ms
   Min/Max Latency:        85ms / 125ms
   Average Processing:     42.3ms
   Network Latency:        56.15ms
   Colos:                  EWR

2. Western Europe (weur)
   Average Total Latency:  145.67ms
   Min/Max Latency:        130ms / 180ms
   Average Processing:     43.1ms
   Network Latency:        102.57ms
   Colos:                  LHR, AMS
...
```

**Key Concepts:**

This pattern demonstrates **geographic optimization for Durable Objects**:

- **Location hints are best effort**: Not guaranteed, but Cloudflare tries to place DOs optimally
- **First call matters**: Location hint only respected on the first `get()` call for a DO
- **Unique names per location**: Each location needs its own DO (we append location to name)
- **Persistent placement**: DOs don't move after creation (dynamic relocation planned for future)

**Use Cases:**

1. **Optimizing global applications** - Determine which regions to target for your users
2. **Understanding latency patterns** - See how distance affects response times
3. **Capacity planning** - Decide where to pre-create DOs for best performance
4. **Comparing locations** - Find the fastest region for your specific deployment
5. **Debugging** - Verify that DOs are being created in expected locations

**Best Practices:**

1. **Don't pre-create DOs**: Let production traffic create them naturally, or use explicit location hints
2. **Use representative locations**: Create DOs close to where your users are
3. **Monitor over time**: Latency can vary, so test periodically
4. **Consider jurisdictions**: For compliance (GDPR, FedRAMP), use [jurisdiction constraints](https://developers.cloudflare.com/durable-objects/reference/data-location/#restrict-durable-objects-to-a-jurisdiction) instead

**Further Reading:**

See [docs/LATENCY_TESTING.md](docs/LATENCY_TESTING.md) for detailed documentation and advanced usage.

## Creating New Durable Objects

1. Create a new file in `packages/durable-objects/src/`:

```typescript
import { DurableObject } from "cloudflare:workers";

export class MyDurableObject extends DurableObject<Record<string, never>> {
  constructor(ctx: DurableObjectState, env: Record<string, never>) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    // Your logic here - access storage via this.ctx.storage
    return new Response("Hello from Durable Object!");
  }
}
```

2. Export it from `packages/durable-objects/src/index.ts`:

```typescript
export { MyDurableObject } from "./my-durable-object";
```

3. Add binding in `packages/worker/wrangler.toml`:

```toml
[[ durable_objects.bindings ]]
name = "MY_DO"
class_name = "MyDurableObject"
script_name = "do-playground-worker"
```

4. Add new migration:

```toml
[[ migrations ]]
tag = "v8"  # increment version from current (v7 is RPC Target/MyDurableObject)
new_sqlite_classes = ["MyNewDurableObject"]
```

5. Re-export in `packages/worker/src/index.ts`:

```typescript
export {
  Counter,
  ChatRoom,
  Batcher,
  RateLimiter,
  Location,
  Session,
  Streamer,
  MyDurableObject,
} from "durable-objects";
```

6. Add to Env interface and routing:

```typescript
interface Env {
  MY_DO: DurableObjectNamespace;
  // ... other bindings
}
```

## Deployment

### Configure Wrangler

First, authenticate with Cloudflare:

```bash
npx wrangler login
```

### Deploy

```bash
npm run deploy
```

The worker will be deployed to your Cloudflare account. Note the URL provided after deployment.

## Learn More

- [Cloudflare Durable Objects Documentation](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [npm Workspaces](https://docs.npmjs.com/cli/using-npm/workspaces)

## License

MIT
