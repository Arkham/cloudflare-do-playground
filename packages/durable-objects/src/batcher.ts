/**
 * Batcher Durable Object
 *
 * Demonstrates alarm functionality:
 * - Uses alarms to batch requests over a time window
 * - Persistent storage of batched items
 * - Automatic processing after delay
 */

import { DurableObject } from "cloudflare:workers";

const SECONDS = 10;

export class Batcher extends DurableObject<Record<string, never>> {
  private count: number = 0;

  constructor(ctx: DurableObjectState, env: Record<string, never>) {
    super(ctx, env);

    // Initialize count from storage on startup
    this.ctx.blockConcurrencyWhile(async () => {
      const vals = await this.ctx.storage.list({ reverse: true, limit: 1 });
      this.count =
        vals.size === 0 ? 0 : parseInt(vals.keys().next().value as string);
    });
  }

  async fetch(request: Request): Promise<Response> {
    this.count++;

    // If there is no alarm currently set, set one for 10 seconds from now
    // Any further POSTs in the next 10 seconds will be part of this batch.
    const currentAlarm = await this.ctx.storage.getAlarm();
    if (currentAlarm == null) {
      this.ctx.storage.setAlarm(Date.now() + 1000 * SECONDS);
    }

    // Add the request to the batch.
    const body = await request.text();
    await this.ctx.storage.put(this.count.toString(), body);

    return new Response(JSON.stringify({ queued: this.count }), {
      headers: {
        "content-type": "application/json;charset=UTF-8",
      },
    });
  }

  async alarm(): Promise<void> {
    const vals = await this.ctx.storage.list<string>();

    // In a real application, you would send this to an actual service
    // For demo purposes, we'll log the batch items
    const batchItems = Array.from(vals.values());

    console.log(`Processing batch of ${batchItems.length} items:`, batchItems);

    // Uncomment below to send to an actual service:
    // await fetch("http://example.com/some-upstream-service", {
    //   method: "POST",
    //   body: JSON.stringify(batchItems),
    // });

    await this.ctx.storage.deleteAll();
    this.count = 0;
  }
}
