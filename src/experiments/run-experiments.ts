#!/usr/bin/env tsx
/**
 * Experiment Orchestrator
 *
 * Runs all experiments and generates test-metrics.json for LaTeX table generation.
 * This script completely replaces the fragile console-output parsing approach.
 *
 * Usage:
 *   npx tsx src/experiments/run-experiments.ts
 *   npx tsx src/experiments/run-experiments.ts --output ../Thesis/content/tables/test-metrics.json
 *
 * Experiments run:
 *   1. Bidirectional BFS (Degree-Prioritised vs baselines)
 *   2. Seeded Expansion (N=1, N=2, N>=3 variants)
 *   3. Path Salience Ranking (MI-based ranking)
 *   4. Salience Coverage Comparison (Novel algorithms vs baselines)
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { runBidirectionalBFSExperiments } from "./experiments/bidirectional-bfs.js";
import { runPathRankingExperiments } from "./experiments/path-ranking.js";
import { runSalienceCoverageExperiments } from "./experiments/salience-coverage-comparison.js";
import { runSeededExpansionExperiments } from "./experiments/seeded-expansion.js";
import { metrics } from "./metrics/collector.js";
import { resolveOutputPath,writeMetrics } from "./metrics/storage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(__filename, "..");

interface Options {
	output?: string;
	verbose?: boolean;
}

const main = async (options: Options = {}): Promise<void> => {
	const { output, verbose = true } = options;

	console.log("╔════════════════════════════════════════════════════════════╗");
	console.log("║   GraphBox Evaluation Experiment Suite                    ║");
	console.log("║   Reusable, Repeatable, Reproducible                     ║");
	console.log("╚════════════════════════════════════════════════════════════╝\n");

	const startTime = Date.now();

	// Clear any existing metrics
	metrics.clear();

	// Run all experiment suites
	await runBidirectionalBFSExperiments();
	await runSeededExpansionExperiments();
	await runPathRankingExperiments();
	await runSalienceCoverageExperiments();

	// Serialize metrics
	const metricsOutput = metrics.serialize();

	// Determine output path
	const outputPath = output
		? path.resolve(__dirname, output)
		: resolveOutputPath(__dirname, "test-metrics.json");

	// Write to file
	writeMetrics(metricsOutput, { outputPath, pretty: true });

	const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

	console.log(`\n✓ Metrics written to: ${outputPath}`);
	console.log(`✓ Total metrics collected: ${metrics.count()}`);
	console.log(`✓ Elapsed time: ${elapsed}s\n`);

	// Print summary by category
	if (verbose) {
		console.log("Metrics Summary:");
		console.log("─────────────────────────────────────────────────────────");
		for (const [category, entries] of Object.entries(metricsOutput.metrics)) {
			if (entries.length > 0) {
				console.log(`  ${category}: ${entries.length} entries`);
			}
		}
		console.log();
	}
};

// Parse command line arguments
const arguments_ = process.argv.slice(2);
const options: Options = {};

for (let index = 0; index < arguments_.length; index++) {
	if (arguments_[index] === "--output" && index + 1 < arguments_.length) {
		options.output = arguments_[++index];
	} else if (arguments_[index] === "--quiet") {
		options.verbose = false;
	} else if (arguments_[index] === "--help" || arguments_[index] === "-h") {
		console.log(`
Usage: npx tsx src/experiments/run-experiments.ts [options]

Options:
  --output <path>   Output file path (default: ../test-metrics.json)
  --quiet          Suppress verbose output
  --help, -h       Show this help message

Examples:
  npx tsx src/experiments/run-experiments.ts
  npx tsx src/experiments/run-experiments.ts --output custom-metrics.json
		`);
		process.exit(0);
	}
}

main(options).catch((error) => {
	console.error("Error running experiments:", error);
	process.exit(1);
});
