#!/usr/bin/env tsx
/**
 * Generate all case IDs by replicating the case registration logic
 * and compute the correct checkpoint hash.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { loadBenchmarkByIdFromUrl } from "../src/experiments/evaluation/fixtures/index.js";

/**
 * Generate a deterministic case ID from inputs.
 * This replicates the generateCaseId function from register-cases.ts
 */
const generateCaseId = (name: string, inputs: Record<string, unknown>): string => {
	const canonical = JSON.stringify({ name, inputs });
	return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
};

/**
 * Get variant display name.
 */
const getVariantDisplayName = (n: number): string => {
	switch (n) {
		case 1: return "ego-graph";
		case 2: return "bidirectional";
		default: return `multi-seed-${n}`;
	}
};

/**
 * Benchmark case definitions (from register-cases.ts)
 */
const BENCHMARK_CASES = [
	{ id: "karate", name: "Karate Club" },
	{ id: "lesmis", name: "Les Misérables" },
	{ id: "facebook", name: "Facebook" },
	{ id: "cora", name: "Cora" },
	{ id: "citeseer", name: "CiteSeer" },
	{ id: "ca-astroph", name: "CA-Astroph" },
	{ id: "ca-condmat", name: "CA-CondMat" },
	{ id: "ca-hepph", name: "CA-HepPh" },
	{ id: "cit-hepph", name: "Cit-HepPH" },
	{ id: "cit-hepth", name: "Cit-HepTH" },
	{ id: "dblp", name: "DBLP" },
];

/**
 * Seed variants
 */
const SEED_VARIANTS = [1, 2, 3] as const;

/**
 * Generate all case IDs
 */
const generateAllCaseIds = async (): Promise<string[]> => {
	const caseIds: string[] = [];

	for (const benchmark of BENCHMARK_CASES) {
		// Load benchmark data to get node IDs
		const benchmarkData = await loadBenchmarkByIdFromUrl(benchmark.id);
		const nodes = benchmarkData.graph.getAllNodes();

		// Create a case for each seed variant
		for (const seedCount of SEED_VARIANTS) {
			// Determine seed nodes based on variant
			let seeds: string[];
			if (seedCount === 1) {
				seeds = [nodes[0].id];
			} else if (seedCount === 2) {
				const lastNode = nodes.at(-1);
				seeds = lastNode ? [nodes[0].id, lastNode.id] : [nodes[0].id];
			} else {
				const step = Math.floor(nodes.length / seedCount);
				seeds = [];
				for (let index_ = 0; index_ < seedCount; index_++) {
					const index = Math.min(index_ * step, nodes.length - 1);
					seeds.push(nodes[index].id);
				}
			}

			const variantName = getVariantDisplayName(seedCount);
			const inputs = {
				summary: {
					datasetId: benchmark.id,
					variant: variantName,
					seedCount,
					seeds,
				},
				artefacts: [
					{ type: "graph", uri: `benchmark://${benchmark.id}` },
				],
			};

			const caseId = generateCaseId(`${benchmark.name}-${variantName}`, inputs);
			caseIds.push(caseId);
		}
	}

	return caseIds.sort();
};

/**
 * Main execution
 */
const main = async () => {
	console.log("Generating all case IDs...\n");

	const allCaseIds = await generateAllCaseIds();

	console.log(`Generated ${allCaseIds.length} case IDs:`);
	console.log(JSON.stringify(allCaseIds, null, 2));

	// Load checkpoint to see which cases are missing
	const checkpoint = JSON.parse(readFileSync("results/execute/checkpoint.json", "utf-8"));

	const completedCaseIds = new Set<string>();
	for (const runId of checkpoint.completedRunIds) {
		const result = checkpoint.results[runId];
		if (result && result.run && result.run.caseId) {
			completedCaseIds.add(result.run.caseId);
		}
	}

	const missingCaseIds = allCaseIds.filter((id) => !completedCaseIds.has(id));

	console.log(`\nCheckpoint has ${completedCaseIds.size} cases, ${allCaseIds.length} total planned`);
	console.log(`Missing ${missingCaseIds.length} cases:`);
	console.log(JSON.stringify(missingCaseIds, null, 2));

	// Compute correct hash using all 33 cases
	const suts = [
		{ id: "degree-prioritised", version: "v1.0.0" },
		{ id: "standard-bfs", version: "v1.0.0" },
		{ id: "frontier-balanced", version: "v1.0.0" },
		{ id: "random-priority", version: "v1.0.0" },
	];

	const signature = {
		suts,
		cases: allCaseIds.map((id) => ({ id, version: "1.0.0" })),
		executorConfig: {
			repetitions: 1,
			seedBase: 42,
			timeoutMs: 300000,
		},
		totalRuns: 132,
	};

	const correctHash = createHash("sha256")
		.update(JSON.stringify(signature))
		.digest("hex")
		.slice(0, 16);

	console.log("\nHash computation:");
	console.log("  Current stored:", checkpoint.configHash);
	console.log("  Correct hash:  ", correctHash);
	console.log("  Match:", checkpoint.configHash === correctHash);

	if (checkpoint.configHash !== correctHash) {
		console.log("\n⚠ Hash mismatch!");
		console.log("  Updating checkpoint with correct hash:", correctHash);

		checkpoint.configHash = correctHash;
		const fs = require("fs");
		fs.writeFileSync("results/execute/checkpoint.json", JSON.stringify(checkpoint, null, 2), "utf-8");

		console.log("  ✅ Checkpoint updated!");
	} else {
		console.log("\n✅ Hash is already correct!");
	}
};

main().catch((error) => {
	console.error("Error:", error);
	process.exit(1);
});
