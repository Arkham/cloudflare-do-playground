/**
 * LatencyTester Durable Object
 *
 * A Durable Object that demonstrates:
 * - Location hints for optimal DO placement
 * - Latency testing across different regions
 * - Fetching Cloudflare trace data to determine actual location
 */

import { DurableObject } from "cloudflare:workers";

export class LatencyTester extends DurableObject<Record<string, never>> {
  constructor(ctx: DurableObjectState, env: Record<string, never>) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const startTime = Date.now();

    // Fetch Cloudflare trace to get the actual location of this DO
    const res = await fetch("https://www.cloudflare.com/cdn-cgi/trace");
    const traceData = await res.text();

    const processingTime = Date.now() - startTime;

    // Parse trace data into an object
    const traceObj: Record<string, string> = {};
    traceData.split("\n").forEach((line) => {
      const [key, value] = line.split("=");
      if (key && value) {
        traceObj[key] = value;
      }
    });

    // Add processing time to the response
    return Response.json({
      trace: traceObj,
      processingTime,
      timestamp: new Date().toISOString(),
    });
  }
}

