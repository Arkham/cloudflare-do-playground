#!/usr/bin/env node
/**
 * Latency Testing Script
 *
 * Tests Durable Object latency across different location hints.
 * Makes multiple requests to each location and calculates average latency.
 *
 * Usage:
 *   npm run test:latency <worker-url> [requests-per-location]
 *
 * Example:
 *   npm run test:latency https://your-worker.workers.dev 50
 */

// Supported location hints according to Cloudflare docs
const LOCATION_HINTS = [
  { code: "wnam", name: "Western North America" },
  { code: "enam", name: "Eastern North America" },
  { code: "sam", name: "South America" },
  { code: "weur", name: "Western Europe" },
  { code: "eeur", name: "Eastern Europe" },
  { code: "apac", name: "Asia-Pacific" },
  { code: "oc", name: "Oceania" },
  { code: "afr", name: "Africa" },
  { code: "me", name: "Middle East" },
];

interface LatencyResult {
  totalLatency: number;
  processingTime: number;
  colo: string;
  trace: Record<string, string>;
}

interface LocationStats {
  locationHint: string;
  locationName: string;
  requests: number;
  avgTotalLatency: number;
  minTotalLatency: number;
  maxTotalLatency: number;
  avgProcessingTime: number;
  colos: Set<string>;
  errors: number;
}

async function testLocation(
  baseUrl: string,
  locationHint: string,
  numRequests: number
): Promise<LocationStats> {
  console.log(`\nTesting ${locationHint} with ${numRequests} requests...`);

  const latencies: number[] = [];
  const processingTimes: number[] = [];
  const colos = new Set<string>();
  let errors = 0;

  // Each location hint gets its own unique DO
  // The worker will create a DO named "test-{locationHint}" for each location
  for (let i = 0; i < numRequests; i++) {
    try {
      const url = `${baseUrl}/latency-test?locationHint=${locationHint}&name=test`;
      const startTime = Date.now();
      const response = await fetch(url);
      const requestLatency = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as LatencyResult;

      latencies.push(data.totalLatency);
      processingTimes.push(data.processingTime);

      if (data.trace?.colo) {
        colos.add(data.trace.colo);
      }

      // Show progress
      if ((i + 1) % 10 === 0) {
        process.stdout.write(`\r  Progress: ${i + 1}/${numRequests}`);
      }
    } catch (error) {
      errors++;
      console.error(`\n  Request ${i + 1} failed:`, error);
    }
  }

  process.stdout.write(`\r  Progress: ${numRequests}/${numRequests}\n`);

  const avgTotalLatency =
    latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const avgProcessingTime =
    processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;

  return {
    locationHint,
    locationName:
      LOCATION_HINTS.find((l) => l.code === locationHint)?.name || locationHint,
    requests: numRequests,
    avgTotalLatency: Math.round(avgTotalLatency * 100) / 100,
    minTotalLatency: Math.min(...latencies),
    maxTotalLatency: Math.max(...latencies),
    avgProcessingTime: Math.round(avgProcessingTime * 100) / 100,
    colos,
    errors,
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(
      "Usage: npm run test:latency <worker-url> [requests-per-location] [--json]"
    );
    console.error("\nExample:");
    console.error("  npm run test:latency https://your-worker.workers.dev 50");
    console.error(
      "  npm run test:latency https://your-worker.workers.dev 50 --json"
    );
    console.error("\nOptions:");
    console.error("  --json    Save results to a JSON file");
    console.error("\nSupported location hints:");
    LOCATION_HINTS.forEach((l) => {
      console.error(`  ${l.code.padEnd(6)} - ${l.name}`);
    });
    process.exit(1);
  }

  // Parse flags
  const jsonFlag = args.includes("--json");
  const nonFlagArgs = args.filter((arg) => !arg.startsWith("--"));

  const workerUrl = nonFlagArgs[0].replace(/\/$/, ""); // Remove trailing slash
  const requestsPerLocation = parseInt(nonFlagArgs[1] || "50", 10);

  console.log("=".repeat(70));
  console.log("Durable Objects Latency Testing");
  console.log("=".repeat(70));
  console.log(`Worker URL: ${workerUrl}`);
  console.log(`Requests per location: ${requestsPerLocation}`);
  console.log(`Total requests: ${LOCATION_HINTS.length * requestsPerLocation}`);

  const results: LocationStats[] = [];

  // Test each location
  for (const location of LOCATION_HINTS) {
    const stats = await testLocation(
      workerUrl,
      location.code,
      requestsPerLocation
    );
    results.push(stats);
  }

  // Sort by average total latency
  results.sort((a, b) => a.avgTotalLatency - b.avgTotalLatency);

  // Print results
  console.log("\n" + "=".repeat(70));
  console.log("RESULTS (sorted by average latency)");
  console.log("=".repeat(70));

  results.forEach((result, index) => {
    console.log(
      `\n${index + 1}. ${result.locationName} (${result.locationHint})`
    );
    console.log(`   Average Total Latency:  ${result.avgTotalLatency}ms`);
    console.log(
      `   Min/Max Latency:        ${result.minTotalLatency}ms / ${result.maxTotalLatency}ms`
    );
    console.log(`   Average Processing:     ${result.avgProcessingTime}ms`);
    console.log(
      `   Network Latency:        ${
        Math.round((result.avgTotalLatency - result.avgProcessingTime) * 100) /
        100
      }ms`
    );
    console.log(
      `   Colos:                  ${Array.from(result.colos).join(", ")}`
    );
    if (result.errors > 0) {
      console.log(`   Errors:                 ${result.errors}`);
    }
  });

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("SUMMARY");
  console.log("=".repeat(70));

  const fastest = results[0];
  const slowest = results[results.length - 1];
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

  console.log(
    `Fastest Location:  ${fastest.locationName} (${fastest.avgTotalLatency}ms)`
  );
  console.log(
    `Slowest Location:  ${slowest.locationName} (${slowest.avgTotalLatency}ms)`
  );
  console.log(
    `Latency Difference: ${
      Math.round((slowest.avgTotalLatency - fastest.avgTotalLatency) * 100) /
      100
    }ms`
  );
  console.log(`Total Errors:      ${totalErrors}`);

  // Export results to JSON if --json flag is present
  if (jsonFlag) {
    const jsonOutput = {
      timestamp: new Date().toISOString(),
      workerUrl,
      requestsPerLocation,
      results: results.map((r) => ({
        ...r,
        colos: Array.from(r.colos),
      })),
    };

    const fs = await import("fs");
    const outputFile = `latency-results-${Date.now()}.json`;
    fs.writeFileSync(outputFile, JSON.stringify(jsonOutput, null, 2));
    console.log(`\nResults saved to: ${outputFile}`);
  }
}

main().catch(console.error);
