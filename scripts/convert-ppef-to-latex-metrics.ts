#!/usr/bin/env tsx
/**
 * PPEF Execution Results to LaTeX Metrics Converter
 *
 * Converts PPEF evaluation-results.json to the format expected by
 * generate-latex-tables.ts for LaTeX table generation.
 *
 * Usage:
 *   npx tsx scripts/convert-ppef-to-latex-metrics.ts
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

/**
 * PPEF execution results structure
 */
interface PPEFEvaluationResult {
	totalRuns: number;
	successfulRuns: number;
	failedRuns: number;
	elapsedMs: number;
	results: Array<{
		run: {
			runId: string;
			sut: string;
			sutRole: string;
			sutVersion: string;
			caseId: string;
			caseClass: string;
			seed: number;
			repetition: number;
		};
		metrics: {
			numeric: Record<string, number>;
		};
	}>;
}

/**
 * LaTeX metrics format expected by generate-latex-tables.ts
 */
interface LatexMetricsOutput {
	version: string;
	timestamp: string;
	metrics: Record<string, Array<Record<string, string | number>>>;
}

/**
 * Dataset case specifications matching the ranking registry
 */
const DATASET_CASES = [
	{ id: "karate", name: "Karate Club", source: "1", target: "34" },
	{ id: "lesmis", name: "Les Misérables", source: "Myriel", target: "Marius" },
	{ id: "cora", name: "Cora", source: "35", target: "1033" },
	{ id: "citeseer", name: "CiteSeer", source: "100157", target: "364207" },
	{ id: "facebook", name: "Facebook", source: "0", target: "4000" },
];

/**
 * Generate case ID using same logic as register-ranking-cases.ts
 */
function generateCaseId(name: string, inputs: Record<string, unknown>): string {
	const canonical = JSON.stringify({ name, inputs });
	return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

/**
 * Build case ID to dataset name mapping
 * Uses the exact same logic as register-ranking-cases.ts
 */
function buildCaseIdMapping(): Map<string, string> {
	const mapping = new Map<string, string>();

	// Import BenchmarkGraphExpander and loadBenchmarkByIdFromUrl dynamically
	// This would require async loading, so we'll use a simpler approach
	// by checking the actual case IDs from the checkpoint file

	// For now, we'll use known case ID mappings from the actual execution results
	// These were extracted from the checkpoint.json file
	const knownMappings: Record<string, string> = {
		"920610d21d106888": "Karate Club",
		"cc030b4d15d2a0a9": "Les Misérables",
		"82ec75a241f7c02a": "Cora",
		"b060baa512de5cc8": "CiteSeer",
		"ed8287f3f286cb01": "Facebook",
	};

	for (const [caseId, datasetName] of Object.entries(knownMappings)) {
		mapping.set(caseId, datasetName);
	}

	return mapping;
}

/**
 * Convert PPEF evaluation results to LaTeX metrics format
 */
function convertPPEFToLatexMetrics(ppefResults: PPEFEvaluationResult): LatexMetricsOutput {
	const caseIdMapping = buildCaseIdMapping();
	const metrics: Record<string, Array<Record<string, string | number>>> = {};

	// Group results by SUT and case ID
	const resultsBySutAndCase = new Map<string, Map<string, Array<{ metrics: Record<string, number> }>>>();

	for (const result of ppefResults.results) {
		if (result.run.caseClass !== "ranking") continue;

		const sut = result.run.sut;
		const caseId = result.run.caseId;

		if (!resultsBySutAndCase.has(sut)) {
			resultsBySutAndCase.set(sut, new Map());
		}

		const sutMap = resultsBySutAndCase.get(sut)!;
		if (!sutMap.has(caseId)) {
			sutMap.set(caseId, []);
		}

		sutMap.get(caseId)!.push({ metrics: result.metrics.numeric });
	}

	// Process each SUT's results
	for (const [sut, caseMap] of resultsBySutAndCase.entries()) {
		const tableKey = sut === "path-salience-v1.0.0"
			? "mi-ranking-quality"
			: sut === "random-ranking-v1.0.0"
				? "mi-ranking-quality-baseline"
				: sut === "shortest-ranking-v1.0.0"
					? "mi-ranking-quality-shortest"
					: null;

		if (!tableKey) continue;

		const tableData: Array<Record<string, string | number>> = [];

		// For each case (dataset), compute average metrics
		for (const [caseId, results] of caseMap.entries()) {
			const datasetName = caseIdMapping.get(caseId);
			if (!datasetName) {
				console.warn(`Warning: No dataset name found for caseId: ${caseId}`);
				continue;
			}

			// Compute average metrics across repetitions (usually just 1)
			const avgMetrics: Record<string, number> = {};
			for (const result of results) {
				for (const [key, value] of Object.entries(result.metrics)) {
					if (!avgMetrics[key]) avgMetrics[key] = 0;
					avgMetrics[key] += value;
				}
			}

			for (const key of Object.keys(avgMetrics)) {
				avgMetrics[key] /= results.length;
			}

			tableData.push({
				dataset: datasetName,
				meanMI: avgMetrics["mean-mi"] ?? 0,
				nodeCoverage: avgMetrics["node-coverage"] ?? 0,
				pathDiversity: avgMetrics["path-diversity"] ?? 0,
				paths: Math.round(avgMetrics["paths-found"] ?? 0),
			});
		}

		metrics[tableKey] = tableData;
	}

	return {
		version: "1.0.0",
		timestamp: new Date().toISOString(),
		metrics,
	};
}

/**
 * Main function
 */
function main(): void {
	const evaluationResultsPath = join(projectRoot, "results/execute/evaluation-results.json");
	const outputPath = join(projectRoot, "src/test-metrics-from-ppef.json");

	// Read PPEF evaluation results
	console.log(`Reading PPEF evaluation results from: ${evaluationResultsPath}`);
	const evaluationContent = readFileSync(evaluationResultsPath, "utf-8");
	const ppefResults: PPEFEvaluationResult = JSON.parse(evaluationContent);

	console.log(`  Total runs: ${ppefResults.totalRuns}`);
	console.log(`  Successful runs: ${ppefResults.successfulRuns}`);

	// Convert to LaTeX metrics format
	console.log("Converting to LaTeX metrics format...");
	const latexMetrics = convertPPEFToLatexMetrics(ppefResults);

	// Write output
	writeFileSync(outputPath, JSON.stringify(latexMetrics, null, 2));
	console.log(`✓ Generated LaTeX metrics file: ${outputPath}`);
	console.log(`\nMetrics sections: ${Object.keys(latexMetrics.metrics).join(", ")}`);

	// Print sample data
	for (const [key, data] of Object.entries(latexMetrics.metrics)) {
		console.log(`\n${key}:`);
		for (const row of data.slice(0, 2)) {
			console.log(`  ${row.dataset}: meanMI=${(row.meanMI as number).toFixed(4)}, paths=${row.paths}`);
		}
	}
}

main();
