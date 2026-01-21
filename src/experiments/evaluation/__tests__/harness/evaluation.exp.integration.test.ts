/**
 * Algorithm evaluation harness test.
 *
 * Runs all algorithms on all fixtures and outputs detailed metrics for comparison.
 * This test focuses on BEHAVIOUR rather than raw performance:
 *
 * - Correctness: Do algorithms find valid paths?
 * - Exploration efficiency: How many nodes/edges are expanded?
 * - Search behaviour: How does traversal order differ?
 * - Diversity: How varied are the discovered paths?
 */

import { describe, expect, it } from "vitest";

import {formatResultsForJson, runFullEvaluation } from "./evaluator";
import { fixtures } from "./fixtures";
import type { AlgorithmRunResult } from "./types";

describe("Algorithm Evaluation Harness", () => {
	it("should run all algorithms on all fixtures", async () => {
		const { results, summary } = await runFullEvaluation();

		// Basic validation
		expect(results.length).toBeGreaterThan(0);
		expect(summary.algorithms).toBe(4); // DP, BFS, FB, Random
		expect(summary.fixtures).toBe(Object.keys(fixtures).length);

		// Log results for analysis
		console.log("\n=== Evaluation Summary ===");
		console.log(`Total runs: ${summary.totalRuns}`);
		console.log(`Algorithms: ${summary.algorithms}`);
		console.log(`Fixtures: ${summary.fixtures}`);

		// Group results by graph and algorithm
		const grouped: Record<string, Record<string, AlgorithmRunResult>> = {};
		for (const result of results) {
			const key = `${result.metrics.graph}-N${result.metrics.numSeeds}`;
			if (!grouped[key]) grouped[key] = {};
			grouped[key][result.metrics.algorithm] = result;
		}

		// Output comparison table
		console.log("\n=== Algorithm Comparison ===");
		console.log("Graph | Seeds | Algorithm | Nodes Expanded | Paths Found | Diversity");
		console.log("-------|-------|------------|----------------|-------------|----------");

		for (const [_key, algResults] of Object.entries(grouped)) {
			for (const [algName, result] of Object.entries(algResults)) {
				const diversity = result.pathMetrics
					? result.pathMetrics.diversity.toFixed(3)
					: "N/A";
				console.log(
					`${result.metrics.graph.padEnd(10)} | ` +
						`N${result.metrics.numSeeds}    | ` +
						`${algName.padEnd(18)} | ` +
						`${result.metrics.nodesExpanded.toString().padStart(14)} | ` +
						`${result.metrics.pathsFound.toString().padStart(11)} | ` +
						`${diversity}`
				);
			}
		}

		// Verify algorithms behave DIFFERENTLY on complex graphs
		// On simple graphs (star, chain), all algorithms may expand same nodes
		// Real differences appear in path count and diversity on complex graphs
		const gridN2 = grouped["grid-10x10-N2"];
		if (gridN2) {
			const dpPaths = gridN2["Degree-Prioritised"].metrics.pathsFound;
			const bfsPaths = gridN2["Standard BFS"].metrics.pathsFound;

			// On grid graphs, BFS should find more paths due to different traversal order
			console.log(`\nGrid graph N=2: DP=${dpPaths} paths, BFS=${bfsPaths} paths`);

			// They should find different numbers of paths
			expect(dpPaths).not.toBe(bfsPaths);
		}

		// Output JSON for further analysis
		console.log("\n=== JSON Output ===");
		console.log(formatResultsForJson(results));
	});

	it("should verify all algorithms find valid paths on connected graphs", async () => {
		const { results } = await runFullEvaluation();

		for (const result of results) {
			// N=1 has no paths by definition
			if (result.metrics.numSeeds === 1) {
				expect(result.metrics.pathsFound).toBe(0);
				continue;
			}

			// For N>=2, paths should be found on connected graphs
			// (skip sparse graphs where connectivity is not guaranteed)
			const fixture = Object.values(fixtures).find(
				(f) => f.name === result.metrics.graph
			);

			if (fixture && !fixture.isSparse) {
				// Should find at least some paths
				expect(result.metrics.pathsFound).toBeGreaterThan(0);

				// All paths should be valid (non-empty, connect seeds)
				for (const path of result.raw.paths) {
					expect(path.nodes.length).toBeGreaterThan(0);
				}
			}
		}
	});

	it("should measure hub traversal differences", async () => {
		const { results } = await runFullEvaluation();

		// Find results with hub metrics
		const withHubs = results.filter((r) => r.metrics.hubMetrics);

		expect(withHubs.length).toBeGreaterThan(0);

		console.log("\n=== Hub Traversal Comparison ===");
		console.log("Graph | Algorithm | Hub Traversal Rate");
		console.log("-------|-----------|-------------------");

		for (const result of withHubs) {
			if (result.metrics.numSeeds >= 2 && result.metrics.pathsFound > 0) {
				console.log(
					`${result.metrics.graph.padEnd(10)} | ` +
						`${result.metrics.algorithm.padEnd(15)} | ` +
						`${result.metrics.hubMetrics!.hubTraversalRate.toFixed(1)}%`
				);
			}
		}

		// Degree-Prioritised should have lower hub traversal than BFS
		const dpHubRate = withHubs
			.filter((r) => r.metrics.algorithm === "Degree-Prioritised" && r.metrics.numSeeds >= 2)
			.reduce((sum, r) => sum + (r.metrics.hubMetrics?.hubTraversalRate ?? 0), 0) /
			withHubs.filter((r) => r.metrics.algorithm === "Degree-Prioritised" && r.metrics.numSeeds >= 2)
				.length;

		const bfsHubRate = withHubs
			.filter((r) => r.metrics.algorithm === "Standard BFS" && r.metrics.numSeeds >= 2)
			.reduce((sum, r) => sum + (r.metrics.hubMetrics?.hubTraversalRate ?? 0), 0) /
			withHubs.filter((r) => r.metrics.algorithm === "Standard BFS" && r.metrics.numSeeds >= 2)
				.length;

		console.log("\nAverage hub traversal rate:");
		console.log(`  Degree-Prioritised: ${dpHubRate.toFixed(1)}%`);
		console.log(`  Standard BFS: ${bfsHubRate.toFixed(1)}%`);

		// DP should avoid hubs more than BFS
		expect(dpHubRate).toBeLessThan(bfsHubRate);
	});
});
