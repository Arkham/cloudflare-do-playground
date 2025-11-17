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

#### Batcher Example

```bash
# Queue items to be batched (they'll be processed together after 10 seconds)
curl -X POST http://localhost:8787/batcher?name=foo -d "Request 1"
curl -X POST http://localhost:8787/batcher?name=foo -d "Request 2"
curl -X POST http://localhost:8787/batcher?name=foo -d "Request 3"

# Each request returns:
# {"queued": 1}
# {"queued": 2}
# {"queued": 3}

# After 10 seconds, the alarm fires and processes all items together
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

## Available Scripts

- `npm run dev` - Start development server
- `npm run deploy` - Deploy to Cloudflare Workers
- `npm run type-check` - Run TypeScript type checking across all packages
- `npm run build` - Build all packages

## Durable Objects

This playground includes three example Durable Objects:

### 1. Counter

A simple counter demonstrating:

- Persistent storage using `this.state.storage`
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

- `POST /batcher?name=<name>` - Queue a request to be batched (send text in body)

**How it works:**

- When the first request arrives, an alarm is set for 10 seconds in the future
- All subsequent requests within that 10-second window are added to the batch
- After 10 seconds, the `alarm()` method is triggered automatically
- The alarm processes all batched items together and clears the batch
- This is useful for aggregating requests to external APIs to reduce API calls

**Example:**

```bash
# Queue multiple items (each will be batched)
curl -X POST http://localhost:8787/batcher?name=foo -d "Item 1"
curl -X POST http://localhost:8787/batcher?name=foo -d "Item 2"
curl -X POST http://localhost:8787/batcher?name=foo -d "Item 3"

# After 10 seconds, all items are processed together
# Check your worker logs to see the batch processing
```

## Creating New Durable Objects

1. Create a new file in `packages/durable-objects/src/`:

```typescript
export class MyDurableObject implements DurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState, env: unknown) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    // Your logic here
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

4. Update migration:

```toml
[[ migrations ]]
tag = "v2"  # increment version
new_classes = ["Counter", "ChatRoom", "MyDurableObject"]
```

5. Import and export in `packages/worker/src/index.ts`:

```typescript
import { MyDurableObject } from "durable-objects";
export { MyDurableObject };
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
