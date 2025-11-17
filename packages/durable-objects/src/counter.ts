/**
 * Counter Durable Object
 *
 * A simple counter that demonstrates:
 * - Persistent storage using this.ctx.storage
 * - State management across requests
 * - HTTP request handling
 */

import { DurableObject } from "cloudflare:workers";

export class Counter extends DurableObject<Record<string, never>> {
  constructor(ctx: DurableObjectState, env: Record<string, never>) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Get current counter value
    if (url.pathname === "/counter/value") {
      const value = (await this.ctx.storage.get<number>("counter")) ?? 0;
      return new Response(JSON.stringify({ value }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Increment counter
    if (url.pathname === "/counter/increment") {
      const current = (await this.ctx.storage.get<number>("counter")) ?? 0;
      const newValue = current + 1;
      await this.ctx.storage.put("counter", newValue);
      return new Response(
        JSON.stringify({ value: newValue, action: "incremented" }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Decrement counter
    if (url.pathname === "/counter/decrement") {
      const current = (await this.ctx.storage.get<number>("counter")) ?? 0;
      const newValue = current - 1;
      await this.ctx.storage.put("counter", newValue);
      return new Response(
        JSON.stringify({ value: newValue, action: "decremented" }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Reset counter
    if (url.pathname === "/counter/reset" && request.method === "POST") {
      await this.ctx.storage.put("counter", 0);
      return new Response(JSON.stringify({ value: 0, action: "reset" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      "Counter endpoint. Try /counter/value, /counter/increment, or /counter/decrement",
      {
        status: 404,
      }
    );
  }
}
