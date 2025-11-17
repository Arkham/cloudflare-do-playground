import { DurableObject } from "cloudflare:workers";

export interface Env {}

// Durable Object
export class RateLimiter extends DurableObject {
  static readonly milliseconds_per_request = 10;
  static readonly milliseconds_for_updates = 1000;
  static readonly capacity = 100;

  tokens: number;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.tokens = RateLimiter.capacity;
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const milliseconds_to_next_request =
        await this.getMillisecondsToNextRequest();

      if (milliseconds_to_next_request > 0) {
        const nextRefillTime = await this.ctx.storage.getAlarm();
        const now = Date.now();
        const milliseconds_until_refill = nextRefillTime
          ? Math.max(0, nextRefillTime - now)
          : null;

        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded",
            retry_after_ms: milliseconds_to_next_request,
            refill_in_ms: milliseconds_until_refill,
            refill_at: nextRefillTime
              ? new Date(nextRefillTime).toISOString()
              : null,
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Request allowed - upstream resource would be called here",
          tokens_remaining: this.tokens,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Internal rate limiter error",
          details: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  async getMillisecondsToNextRequest(): Promise<number> {
    await this.checkAndSetAlarm();

    let milliseconds_to_next_request = RateLimiter.milliseconds_per_request;
    if (this.tokens > 0) {
      this.tokens -= 1;
      milliseconds_to_next_request = 0;
    }

    return milliseconds_to_next_request;
  }

  private async checkAndSetAlarm() {
    let currentAlarm = await this.ctx.storage.getAlarm();
    const now = Date.now();

    // If no alarm exists, or if the current alarm is in the past, set a new one
    if (currentAlarm == null || currentAlarm <= now) {
      const alarmTime =
        now +
        RateLimiter.milliseconds_for_updates *
          RateLimiter.milliseconds_per_request;
      this.ctx.storage.setAlarm(alarmTime);
    }
  }

  async alarm() {
    this.tokens = Math.min(
      RateLimiter.capacity,
      this.tokens + RateLimiter.milliseconds_for_updates
    );
    await this.checkAndSetAlarm();
  }
}
