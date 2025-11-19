import { DurableObject } from "cloudflare:workers";

/**
 * Location Durable Object
 *
 * This example demonstrates in-memory state management in Durable Objects.
 * The `location` property is stored only in memory and will be reset when
 * the Durable Object is evicted from memory due to inactivity.
 *
 * This is useful for understanding the lifecycle of Durable Objects and
 * the difference between in-memory state and persisted state.
 */
export class Location extends DurableObject<Record<string, never>> {
  private location: string | null;

  constructor(state: DurableObjectState, env: Record<string, never>) {
    super(state, env);
    // Upon construction, you do not have a location to provide.
    // This value will be updated as people access the Durable Object.
    // When the Durable Object is evicted from memory, this will be reset.
    this.location = null;
  }

  // Handle HTTP requests from clients.
  async fetch(request: Request): Promise<Response> {
    let response: string;

    const city = (request.cf?.city as string | undefined) || "unknown";

    if (this.location === null) {
      response = `
This is the first request, you called the constructor, so this.location was null.
You will set this.location to be your city: (${city}). Try reloading the page.`;
    } else {
      response = `
The Durable Object was already loaded and running because it recently handled a request.

Previous Location: ${this.location}
New Location: ${city}`;
    }

    // You set the new location to be the new city.
    this.location = city;
    console.log(response);
    return new Response(response, {
      headers: { "Content-Type": "text/plain" },
    });
  }
}
