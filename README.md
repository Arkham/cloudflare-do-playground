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

## Available Scripts

- `npm run dev` - Start development server
- `npm run deploy` - Deploy to Cloudflare Workers
- `npm run type-check` - Run TypeScript type checking across all packages
- `npm run build` - Build all packages

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
tag = "v5"  # increment version from current (v4 is Location)
new_sqlite_classes = ["MyDurableObject"]
```

5. Re-export in `packages/worker/src/index.ts`:

```typescript
export {
  Counter,
  ChatRoom,
  Batcher,
  RateLimiter,
  Location,
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
