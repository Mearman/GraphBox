/**
 * VALIDITY: N-Seed Comparison Across Methods
 *
 * Compares Degree-Prioritised, Standard BFS, Frontier-Balanced, and Random
 * across N=1 (ego-graph), N=2 (between-graph), and N>=3 (multi-seed) variants.
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../../../../algorithms/traversal/degree-prioritised-expansion";
import { FrontierBalancedExpansion } from "../../../../../../../baselines/frontier-balanced";
import { RandomPriorityExpansion } from "../../../../../../../baselines/random-priority";
import { StandardBfsExpansion } from "../../../../../../../baselines/standard-bfs";
import { createChainGraphExpander, createHubGraphExpander } from "../../../../common/graph-generators";

describe("VALIDITY: N-Seed Comparison Across Methods", () => {
	/**
	 * Compare all methods across N=1, N=2, N=3 variants on chain graph.
	 */
	it("should compare all methods across N-seed variants", async () => {
		const graph = createChainGraphExpander(10);
		const totalNodes = 10;

		const results: Array<{
			method: string;
			n: number;
			nodes: number;
			paths: number;
			iterations: number;
			coverage: number;
		}> = [];

		// Test N=1 (ego-graph) - no paths expected
		for (const [method, seeds] of [
			["Degree-Prioritised", ["N0"]],
			["Standard BFS", ["N0"]],
			["Frontier-Balanced", ["N0"]],
			["Random Priority", ["N0"]],
		] as const) {
			let expansion;
			switch (method) {
				case "Degree-Prioritised": {
					expansion = new DegreePrioritisedExpansion(graph, seeds);
					break;
				}
				case "Standard BFS": {
					expansion = new StandardBfsExpansion(graph, seeds);
					break;
				}
				case "Frontier-Balanced": {
					expansion = new FrontierBalancedExpansion(graph, seeds);
					break;
				}
				case "Random Priority": {
					expansion = new RandomPriorityExpansion(graph, seeds, 42);
					break;
				}
			}

			const result = await expansion.run();
			results.push({
				method,
				n: 1,
				nodes: result.sampledNodes.size,
				paths: result.paths.length,
				iterations: result.stats.iterations,
				coverage: (result.sampledNodes.size / totalNodes) * 100,
			});
		}

		// Test N=2 (between-graph) - paths expected
		for (const [method, seeds] of [
			["Degree-Prioritised", ["N0", "N9"]],
			["Standard BFS", ["N0", "N9"]],
			["Frontier-Balanced", ["N0", "N9"]],
			["Random Priority", ["N0", "N9"]],
		] as const) {
			let expansion;
			switch (method) {
				case "Degree-Prioritised": {
					expansion = new DegreePrioritisedExpansion(graph, seeds);
					break;
				}
				case "Standard BFS": {
					expansion = new StandardBfsExpansion(graph, seeds);
					break;
				}
				case "Frontier-Balanced": {
					expansion = new FrontierBalancedExpansion(graph, seeds);
					break;
				}
				case "Random Priority": {
					expansion = new RandomPriorityExpansion(graph, seeds, 42);
					break;
				}
			}

			const result = await expansion.run();
			results.push({
				method,
				n: 2,
				nodes: result.sampledNodes.size,
				paths: result.paths.length,
				iterations: result.stats.iterations,
				coverage: (result.sampledNodes.size / totalNodes) * 100,
			});
		}

		// Test N=3 on hub graph (different structure)
		const hubGraph = createHubGraphExpander(3, 5);
		const hubTotalNodes = 16; // 3 hubs + 3*5 spokes + 1 connector per hub = 18 approximately

		for (const [method, seeds] of [
			["Degree-Prioritised", ["L0_0", "L1_2", "L2_4"]],
			["Standard BFS", ["L0_0", "L1_2", "L2_4"]],
			["Frontier-Balanced", ["L0_0", "L1_2", "L2_4"]],
			["Random Priority", ["L0_0", "L1_2", "L2_4"]],
		] as const) {
			let expansion;
			switch (method) {
				case "Degree-Prioritised": {
					expansion = new DegreePrioritisedExpansion(hubGraph, seeds);
					break;
				}
				case "Standard BFS": {
					expansion = new StandardBfsExpansion(hubGraph, seeds);
					break;
				}
				case "Frontier-Balanced": {
					expansion = new FrontierBalancedExpansion(hubGraph, seeds);
					break;
				}
				case "Random Priority": {
					expansion = new RandomPriorityExpansion(hubGraph, seeds, 42);
					break;
				}
			}

			const result = await expansion.run();
			results.push({
				method,
				n: 3,
				nodes: result.sampledNodes.size,
				paths: result.paths.length,
				iterations: result.stats.iterations,
				coverage: (result.sampledNodes.size / hubTotalNodes) * 100,
			});
		}

		// Verify all methods found nodes
		for (const r of results) {
			expect(r.nodes).toBeGreaterThan(0);
			expect(r.iterations).toBeGreaterThan(0);
		}

		// Output comparison table
		console.log("\n=== N-Seed Comparison Across Methods ===");
		console.log("Method & N & Nodes & Paths & Iterations & Coverage");
		for (const r of results) {
			const coverageString = r.coverage.toFixed(1) + "%";
			console.log(`${r.method} & ${r.n} & ${r.nodes} & ${r.paths} & ${r.iterations} & ${coverageString}`);
		}
	});

	/**
	 * Compare hub traversal rates across methods for N=2 variant.
	 */
	it("should compare hub traversal across methods", async () => {
		const graph = createHubGraphExpander(3, 5);
		const seeds: [string, string] = ["L0_0", "L2_4"];

		// Define top 10% degree threshold for hub identification
		const allDegrees = new Map<string, number>();
		for (let index = 0; index < 20; index++) {
			try {
				const nodeId = `L${Math.floor(index / 5)}_${index % 5}`;
				allDegrees.set(nodeId, graph.getDegree(nodeId));
			} catch {
				// Node may not exist
			}
		}

		const degrees = [...allDegrees.values()].sort((a, b) => b - a);
		const hubThreshold = degrees[Math.floor(degrees.length * 0.1)] || 5;
		const hubs = new Set<string>();
		for (const [node, degree] of allDegrees) {
			if (degree >= hubThreshold) {
				hubs.add(node);
			}
		}

		const results: Array<{
			method: string;
			paths: number;
			hubTraversal: number;
		}> = [];

		for (const [method, ctor] of [
			["Degree-Prioritised", (seeds: [string, string]) => new DegreePrioritisedExpansion(graph, seeds)],
			["Standard BFS", (seeds: [string, string]) => new StandardBfsExpansion(graph, seeds)],
			["Frontier-Balanced", (seeds: [string, string]) => new FrontierBalancedExpansion(graph, seeds)],
			["Random Priority", (seeds: [string, string]) => new RandomPriorityExpansion(graph, seeds, 42)],
		] as const) {
			const expansion = ctor(seeds);
			const result = await expansion.run();

			// Calculate hub traversal rate
			let pathsWithHubs = 0;
			for (const path of result.paths) {
				const hasHub = path.nodes.some((nodeId) => hubs.has(nodeId));
				if (hasHub) pathsWithHubs++;
			}

			const hubTraversal = result.paths.length > 0
				? (pathsWithHubs / result.paths.length) * 100
				: 0;

			results.push({
				method,
				paths: result.paths.length,
				hubTraversal: Math.round(hubTraversal),
			});
		}

		// Output hub traversal comparison
		console.log("\n=== N=2 Hub Traversal Comparison ===");
		console.log("Method & Paths & Hub Traversal");
		for (const r of results) {
			console.log(`${r.method} & ${r.paths} & ${r.hubTraversal}%`);
		}

		// All methods should find paths
		expect(results.length).toBe(4);
		for (const r of results) {
			expect(r.paths).toBeGreaterThan(0);
		}
	});

	/**
	 * Compare path diversity across methods for N=2 variant.
	 */
	it("should compare path diversity across methods", async () => {
		const graph = createHubGraphExpander(3, 5);
		const seeds: [string, string] = ["L0_0", "L2_4"];

		const results: Array<{
			method: string;
			paths: number;
			uniqueNodes: number;
			diversity: number;
		}> = [];

		for (const [method, ctor] of [
			["Degree-Prioritised", (seeds: [string, string]) => new DegreePrioritisedExpansion(graph, seeds)],
			["Standard BFS", (seeds: [string, string]) => new StandardBfsExpansion(graph, seeds)],
			["Frontier-Balanced", (seeds: [string, string]) => new FrontierBalancedExpansion(graph, seeds)],
			["Random Priority", (seeds: [string, string]) => new RandomPriorityExpansion(graph, seeds, 42)],
		] as const) {
			const expansion = ctor(seeds);
			const result = await expansion.run();

			// Calculate path diversity (Jaccard dissimilarity)
			const pathNodeSets = result.paths.map((p) => new Set(p.nodes));
			const allNodes = new Set<string>();
			for (const set of pathNodeSets) {
				for (const node of set) {
					allNodes.add(node);
				}
			}

			let totalJaccard = 0;
			let comparisons = 0;
			for (let index = 0; index < pathNodeSets.length; index++) {
				for (let index_ = index + 1; index_ < pathNodeSets.length; index_++) {
					const intersection = new Set<string>();
					for (const node of pathNodeSets[index]) {
						if (pathNodeSets[index_].has(node)) {
							intersection.add(node);
						}
					}
					const union = new Set([...pathNodeSets[index], ...pathNodeSets[index_]]);
					const jaccard = intersection.size / union.size;
					totalJaccard += 1 - jaccard; // Dissimilarity
					comparisons++;
				}
			}

			const diversity = comparisons > 0 ? totalJaccard / comparisons : 0;

			results.push({
				method,
				paths: result.paths.length,
				uniqueNodes: allNodes.size,
				diversity: Number.parseFloat(diversity.toFixed(3)),
			});
		}

		// Output diversity comparison
		console.log("\n=== N=2 Path Diversity Comparison ===");
		console.log("Method & Paths & Unique Nodes & Diversity");
		for (const r of results) {
			console.log(`${r.method} & ${r.paths} & ${r.uniqueNodes} & ${r.diversity}`);
		}

		// All methods should find paths with valid diversity
		expect(results.length).toBe(4);
		for (const r of results) {
			expect(r.paths).toBeGreaterThan(0);
			expect(r.uniqueNodes).toBeGreaterThan(0);
			expect(r.diversity).toBeGreaterThanOrEqual(0);
			expect(r.diversity).toBeLessThanOrEqual(1);
		}
	});
});
