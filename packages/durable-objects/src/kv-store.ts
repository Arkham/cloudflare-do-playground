import { DurableObject } from "cloudflare:workers";

interface Env {
  KV_CACHE: KVNamespace;
}

/**
 * KVStore demonstrates using Workers KV from within a Durable Object
 *
 * This example shows how to:
 * - Access KV namespace from within a Durable Object
 * - Write data to KV
 * - Read data from KV
 * - Use KV as a cache layer alongside Durable Object storage
 *
 * Common use cases:
 * - Using KV for read-heavy cached data (high read performance)
 * - Using DO storage for write-heavy transactional data
 * - Combining both for hybrid storage strategies
 */
export class KVStore extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // PUT /kv - Write to KV
    if (url.pathname === "/kv" && request.method === "PUT") {
      try {
        const body = await request.json<{ key: string; value: string }>();

        if (!body.key || !body.value) {
          return Response.json(
            { error: "Missing key or value in request body" },
            { status: 400 }
          );
        }

        // Write to KV
        await this.env.KV_CACHE.put(body.key, body.value);

        // Also track the write in DO storage for metadata
        const writeCount =
          (await this.ctx.storage.get<number>("write_count")) || 0;
        await this.ctx.storage.put("write_count", writeCount + 1);
        await this.ctx.storage.put("last_key_written", body.key);

        return Response.json({
          success: true,
          message: `Wrote key "${body.key}" to KV`,
          write_count: writeCount + 1,
        });
      } catch (error) {
        return Response.json(
          {
            error: "Invalid JSON body. Expected {key: string, value: string}",
          },
          { status: 400 }
        );
      }
    }

    // GET /kv?key=<key> - Read from KV
    if (url.pathname === "/kv" && request.method === "GET") {
      const key = url.searchParams.get("key");

      if (!key) {
        return Response.json(
          { error: "Missing key query parameter" },
          { status: 400 }
        );
      }

      // Fetch from KV
      const value = await this.env.KV_CACHE.get(key);

      // Track the read in DO storage
      const readCount =
        (await this.ctx.storage.get<number>("read_count")) || 0;
      await this.ctx.storage.put("read_count", readCount + 1);
      await this.ctx.storage.put("last_key_read", key);

      return Response.json({
        key,
        value,
        found: value !== null,
        read_count: readCount + 1,
      });
    }

    // DELETE /kv?key=<key> - Delete from KV
    if (url.pathname === "/kv" && request.method === "DELETE") {
      const key = url.searchParams.get("key");

      if (!key) {
        return Response.json(
          { error: "Missing key query parameter" },
          { status: 400 }
        );
      }

      // Delete from KV
      await this.env.KV_CACHE.delete(key);

      return Response.json({
        success: true,
        message: `Deleted key "${key}" from KV`,
      });
    }

    // GET /stats - Get statistics about KV operations
    if (url.pathname === "/stats" && request.method === "GET") {
      const writeCount =
        (await this.ctx.storage.get<number>("write_count")) || 0;
      const readCount =
        (await this.ctx.storage.get<number>("read_count")) || 0;
      const lastKeyWritten =
        (await this.ctx.storage.get<string>("last_key_written")) || null;
      const lastKeyRead =
        (await this.ctx.storage.get<string>("last_key_read")) || null;

      return Response.json({
        statistics: {
          total_writes: writeCount,
          total_reads: readCount,
          last_key_written: lastKeyWritten,
          last_key_read: lastKeyRead,
        },
        note: "Statistics are tracked in Durable Object storage, while actual data is in KV",
      });
    }

    // GET /list - List keys with a prefix
    if (url.pathname === "/list" && request.method === "GET") {
      const prefix = url.searchParams.get("prefix") || "";
      const limit = parseInt(url.searchParams.get("limit") || "10", 10);

      const list = await this.env.KV_CACHE.list({ prefix, limit });

      return Response.json({
        keys: list.keys.map((k) => k.name),
        list_complete: list.list_complete,
        cursor: list.cursor,
        count: list.keys.length,
      });
    }

    return Response.json(
      {
        error: "Not found",
        available_endpoints: {
          put: "PUT /kv with JSON body {key: string, value: string}",
          get: "GET /kv?key=<key>",
          delete: "DELETE /kv?key=<key>",
          stats: "GET /stats",
          list: "GET /list?prefix=<prefix>&limit=<limit>",
        },
      },
      { status: 404 }
    );
  }
}



