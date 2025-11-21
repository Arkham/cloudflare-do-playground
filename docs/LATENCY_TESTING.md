# Latency Testing with Durable Objects

This example demonstrates how to test the latency of Durable Objects across different geographic locations using location hints.

## Overview

The `LatencyTester` Durable Object fetches Cloudflare's trace data to report its actual location and processing time. By using different location hints when creating Durable Objects, you can test which region provides the best latency for your use case.

## Components

### 1. LatencyTester Durable Object

Located in `packages/durable-objects/src/latency-tester.ts`, this DO:

- Fetches Cloudflare's CDN trace data (`/cdn-cgi/trace`)
- Reports the actual data center (colo) it's running in
- Measures its own processing time
- Returns location information to the caller

### 2. Worker Endpoint

The worker at `/latency-test` accepts two query parameters:

- `locationHint`: Optional location hint (wnam, enam, sam, weur, eeur, apac, oc, afr, me)
- `name`: Base name for the DO (defaults to "test")

**Important**: Each location hint creates a **unique Durable Object**. The worker automatically appends the location hint to the name, so `name=test&locationHint=enam` creates a DO named `test-enam`.

### 3. Test Script

The `scripts/test-latency.ts` script automates testing across all supported locations:

- Creates a unique DO for each location hint
- Makes multiple requests (default: 50) to each DO
- Measures round-trip latency and processing time
- Calculates statistics (avg, min, max)
- Saves results to a JSON file

## Supported Location Hints

According to [Cloudflare's documentation](https://developers.cloudflare.com/durable-objects/reference/data-location/#provide-a-location-hint):

| Code   | Location              |
| ------ | --------------------- |
| `wnam` | Western North America |
| `enam` | Eastern North America |
| `sam`  | South America\*       |
| `weur` | Western Europe        |
| `eeur` | Eastern Europe        |
| `apac` | Asia-Pacific          |
| `oc`   | Oceania               |
| `afr`  | Africa\*              |
| `me`   | Middle East\*         |

\*Note: Some locations don't currently spawn DOs and will use a nearby location instead.

## Usage

### Manual Testing

Test a specific location:

```bash
# Test Eastern North America
curl "https://your-worker.workers.dev/latency-test?locationHint=enam"

# Test Western Europe
curl "https://your-worker.workers.dev/latency-test?locationHint=weur"

# Test without location hint (default behavior)
curl "https://your-worker.workers.dev/latency-test"
```

Response format:

```json
{
  "trace": {
    "fl": "...",
    "h": "...",
    "ip": "...",
    "ts": "...",
    "visit_scheme": "https",
    "uag": "...",
    "colo": "EWR",
    "sliver": "...",
    "http": "http/2",
    "loc": "US",
    "tls": "TLSv1.3",
    "sni": "...",
    "warp": "off",
    "gateway": "off",
    "rbi": "off",
    "kex": "..."
  },
  "processingTime": 45,
  "timestamp": "2025-11-21T12:34:56.789Z",
  "totalLatency": 123,
  "locationHint": "enam",
  "doName": "test-enam"
}
```

### Automated Testing

First, install dependencies:

```bash
npm install
```

Then run the test script:

```bash
# Test with 50 requests per location (default)
npm run test:latency https://your-worker.workers.dev

# Test with custom number of requests
npm run test:latency https://your-worker.workers.dev 100
```

The script will:

1. Create a unique DO for each of the 9 supported locations
2. Make N requests to each DO
3. Calculate average, min, and max latencies
4. Sort results by average latency
5. Save detailed results to a JSON file

Example output:

```
======================================================================
Durable Objects Latency Testing
======================================================================
Worker URL: https://your-worker.workers.dev
Requests per location: 50
Total requests: 450

Testing wnam with 50 requests...
  Progress: 50/50
Testing enam with 50 requests...
  Progress: 50/50
...

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

======================================================================
SUMMARY
======================================================================
Fastest Location:  Eastern North America (98.45ms)
Slowest Location:  Asia-Pacific (345.23ms)
Latency Difference: 246.78ms
Total Errors:      0

Results saved to: latency-results-1700000000000.json
```

## How Location Hints Work

From the Cloudflare documentation:

> Location hints are the mechanism provided to specify the location that a Durable Object should be located regardless of where the initial `get()` request comes from.

**Key Points:**

1. **First call matters**: Location hints are only respected on the **first** `get()` call for a particular Durable Object
2. **Best effort**: Hints are not guaranteed - Cloudflare will instantiate the DO in a data center selected to minimize latency from the hinted location
3. **Unique names**: To test different locations, you must use different DO names (which is why we append the location hint to the name)
4. **Persistent location**: Once created, a DO stays in its location and doesn't move

## Use Cases

This latency testing setup is useful for:

1. **Optimizing global applications**: Determine which regions to target for your users
2. **Understanding latency patterns**: See how distance affects response times
3. **Capacity planning**: Decide where to pre-create DOs for best performance
4. **Comparing locations**: Find the fastest region for your specific deployment
5. **Debugging**: Verify that DOs are being created in expected locations

## Best Practices

1. **Don't pre-create DOs**: Let production traffic create them naturally, or use explicit location hints
2. **Use representative locations**: Create DOs close to where your users are
3. **Monitor over time**: Latency can vary, so test periodically
4. **Consider jurisdictions**: For compliance, use [jurisdiction constraints](https://developers.cloudflare.com/durable-objects/reference/data-location/#restrict-durable-objects-to-a-jurisdiction) instead of location hints

## Further Reading

- [Cloudflare Durable Objects Data Location](https://developers.cloudflare.com/durable-objects/reference/data-location/)
- [Where Durable Objects Live](https://where.durableobjects.live/)
- [Durable Objects API Reference](https://developers.cloudflare.com/durable-objects/api/)
