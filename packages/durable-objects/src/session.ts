import { DurableObject } from "cloudflare:workers";

/**
 * Session Durable Object
 *
 * This example demonstrates auto-cleanup using alarms with a TTL pattern.
 * The session automatically deletes all its data after a period of inactivity.
 *
 * How it works:
 * - Every request resets the TTL alarm (activity extends the session)
 * - The alarm is set in the fetch handler on every request
 * - If no requests come within the TTL, the alarm fires and clears all data
 * - This creates "activity-based persistence" - useful for sessions, caches, etc.
 */
export class Session extends DurableObject<Record<string, never>> {
  // Time To Live (TTL) in milliseconds - 30 seconds for easy testing
  private readonly timeToLiveMs = 30 * 1000; // 30 seconds

  constructor(state: DurableObjectState, env: Record<string, never>) {
    super(state, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Extend the TTL immediately following every fetch request.
    // This resets the "inactivity timer" by setting a new alarm.
    // Setting the alarm here (in fetch) is the recommended approach.
    await this.ctx.storage.setAlarm(Date.now() + this.timeToLiveMs);

    // Set session data
    if (url.pathname === "/session/set" && request.method === "POST") {
      const data = await request.json<{ key: string; value: string }>();
      await this.ctx.storage.put(data.key, data.value);

      const currentAlarm = await this.ctx.storage.getAlarm();
      return new Response(
        JSON.stringify({
          success: true,
          message: `Stored ${data.key}`,
          ttl_seconds: 30,
          alarm_scheduled_at: currentAlarm
            ? new Date(currentAlarm).toISOString()
            : null,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Get session data
    if (url.pathname === "/session/get") {
      const key = url.searchParams.get("key");
      if (!key) {
        return new Response(
          JSON.stringify({ error: "Missing 'key' parameter" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const value = await this.ctx.storage.get(key);
      const currentAlarm = await this.ctx.storage.getAlarm();

      return new Response(
        JSON.stringify({
          key,
          value: value || null,
          exists: value !== undefined,
          ttl_seconds: 30,
          alarm_scheduled_at: currentAlarm
            ? new Date(currentAlarm).toISOString()
            : null,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Get all session data
    if (url.pathname === "/session/all") {
      const allData = await this.ctx.storage.list();
      const data: Record<string, unknown> = {};

      for (const [key, value] of allData) {
        data[key] = value;
      }

      const currentAlarm = await this.ctx.storage.getAlarm();

      return new Response(
        JSON.stringify({
          data,
          count: allData.size,
          ttl_seconds: 30,
          alarm_scheduled_at: currentAlarm
            ? new Date(currentAlarm).toISOString()
            : null,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        message: "Session Durable Object",
        endpoints: {
          set: "POST /session/set with JSON body {key, value}",
          get: "GET /session/get?key=<key>",
          all: "GET /session/all",
        },
        info: "Session auto-deletes after 30 seconds of inactivity",
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  /**
   * Alarm handler - called when the TTL expires
   * This automatically cleans up all session data after inactivity
   */
  async alarm(): Promise<void> {
    console.log("Session TTL expired - cleaning up all data");
    await this.ctx.storage.deleteAll();
  }
}
