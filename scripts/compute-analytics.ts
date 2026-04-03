/**
 * Batch job: recompute CrimeHotspot, CrimePattern, OperationalMetric.
 * Run from crime-backend: `npx tsx scripts/compute-analytics.ts`
 */
import { runAnalyticsComputation } from "../src/lib/analytics/compute";

async function main() {
  const out = await runAnalyticsComputation();
  console.log(JSON.stringify({ ok: true, ...out }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
