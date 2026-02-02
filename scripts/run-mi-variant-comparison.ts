#!/usr/bin/env tsx
/**
 * Run MI Variant Comparison Experiment
 *
 * Executes the MI variant comparison and prints results.
 */

import { printMIVariantSummary,runMIVariantComparison } from "../src/experiments/experiments/mi-variant-comparison.js";
import { metrics } from "../src/experiments/metrics/index.js";

const main = async () => {
	await runMIVariantComparison();
	await printMIVariantSummary();

	const variantMetrics = metrics.getAll()["mi-variant-comparison"];
	console.log(`\nTotal metrics recorded: ${variantMetrics?.length ?? 0}`);
};

main().catch(console.error);
