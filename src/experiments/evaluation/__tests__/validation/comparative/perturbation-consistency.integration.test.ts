/**
 * Perturbed Graph Robustness Tests
 *
 * Tests the robustness of graph expansion algorithms under graph perturbations
 * including edge removal and random edge addition. Validates consistent method
 * ranking across perturbed versions.
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../algorithms/traversal/degree-prioritised-expansion";
import { StandardBfsExpansion } from "../../../../../experiments/baselines/standard-bfs"
import {
	createBenchmarkMeta,
	loadBenchmarkByIdFromUrl,
	loadBenchmarkFromContent,
} from "../../../fixtures/benchmark-datasets";
import { BenchmarkGraphExpander } from "../common/benchmark-graph-expander";
import { pathDiversity } from "../common/statistical-functions";

describe("Thesis Validation: Perturbed Graph Robustness", () => {
	/**
	 * Create a perturbed version of a graph by removing random edges.
	 * @param edges
	 * @param removeFraction
	 */
	const perturbEdges = (
		edges: Array<{ source: string; target: string }>,
		removeFraction: number
	): Array<{ source: string; target: string }> => {
		const shuffled = [...edges].sort(() => Math.random() - 0.5);
		const keepCount = Math.floor(edges.length * (1 - removeFraction));
		return shuffled.slice(0, keepCount);
	};

	/**
	 * Create a perturbed version by adding random edges.
	 * @param edges
	 * @param nodeIds
	 * @param addFraction
	 */
	const addRandomEdges = (
		edges: Array<{ source: string; target: string }>,
		nodeIds: string[],
		addFraction: number
	): Array<{ source: string; target: string }> => {
		const addCount = Math.floor(edges.length * addFraction);
		const newEdges: Array<{ source: string; target: string }> = [...edges];
		const existing = new Set(edges.map((e) => `${e.source}-${e.target}`));

		let added = 0;
		let attempts = 0;
		const maxAttempts = addCount * 10;

		while (added < addCount && attempts < maxAttempts) {
			const source = nodeIds[Math.floor(Math.random() * nodeIds.length)];
			const target = nodeIds[Math.floor(Math.random() * nodeIds.length)];
			const key = `${source}-${target}`;

			if (source !== target && !existing.has(key)) {
				newEdges.push({ source, target });
				existing.add(key);
				added++;
			}
			attempts++;
		}

		return newEdges;
	};

	it("should maintain performance under edge removal", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("karate");
		const originalEdges = benchmark.graph.getAllEdges();

		// Remove 10% of edges
		const perturbedEdges = perturbEdges(originalEdges, 0.1);

		const perturbedMeta = createBenchmarkMeta({
			id: "karate-perturbed-removed",
			name: "Karate Club (10% edges removed)",
			expectedNodes: 34,
			expectedEdges: perturbedEdges.length,
			directed: false,
		});

		// Build perturbed graph
		const edgeListContent = perturbedEdges.map((e) => `${e.source} ${e.target}`).join("\n");
		const perturbedBenchmark = loadBenchmarkFromContent(edgeListContent, perturbedMeta);

		const expander = new BenchmarkGraphExpander(perturbedBenchmark.graph, perturbedBenchmark.meta.directed);
		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

		const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
		const result = await degreePrioritised.run();

		console.log("\n=== Edge Removal Robustness ===");
		console.log(`Original edges: ${originalEdges.length}`);
		console.log(`Perturbed edges: ${perturbedEdges.length}`);
		console.log(`Paths found: ${result.paths.length}`);
		console.log(`Nodes sampled: ${result.sampledNodes.size}`);

		// Should still find paths despite edge removal
		expect(result.sampledNodes.size).toBeGreaterThan(0);
	});

	it("should maintain performance under random edge addition", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("karate");
		const originalEdges = benchmark.graph.getAllEdges();
		const allNodes = benchmark.graph.getAllNodes().map((n) => n.id);

		// Add 20% more random edges
		const perturbedEdges = addRandomEdges(originalEdges, allNodes, 0.2);

		const perturbedMeta = createBenchmarkMeta({
			id: "karate-perturbed-added",
			name: "Karate Club (20% edges added)",
			expectedNodes: 34,
			expectedEdges: perturbedEdges.length,
			directed: false,
		});

		const edgeListContent = perturbedEdges.map((e) => `${e.source} ${e.target}`).join("\n");
		const perturbedBenchmark = loadBenchmarkFromContent(edgeListContent, perturbedMeta);

		const expander = new BenchmarkGraphExpander(perturbedBenchmark.graph, perturbedBenchmark.meta.directed);
		const nodeIdList = expander.getAllNodeIds();
		const seeds: [string, string] = [nodeIdList[0], nodeIdList.at(-1) ?? nodeIdList[0]];

		const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
		const result = await degreePrioritised.run();

		console.log("\n=== Edge Addition Robustness ===");
		console.log(`Original edges: ${originalEdges.length}`);
		console.log(`Perturbed edges: ${perturbedEdges.length}`);
		console.log(`Paths found: ${result.paths.length}`);

		// Should handle additional edges gracefully
		expect(result.sampledNodes.size).toBeGreaterThan(0);
	});

	it("should show consistent method ranking across perturbations", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
		const originalEdges = benchmark.graph.getAllEdges();

		const results: Array<{ perturbation: string; dpDiversity: number; bfsDiversity: number }> = [];

		// Test original and two perturbed versions
		const perturbations = [
			{ name: "original", edges: originalEdges },
			{ name: "5% removed", edges: perturbEdges(originalEdges, 0.05) },
			{ name: "10% added", edges: addRandomEdges(originalEdges, benchmark.graph.getAllNodes().map((n) => n.id), 0.1) },
		];

		for (const { name, edges } of perturbations) {
			const meta = createBenchmarkMeta({
				id: `lesmis-${name.replaceAll(/\s+/g, "-")}`,
				name: `Les Mis (${name})`,
				expectedNodes: 77,
				expectedEdges: edges.length,
				directed: false,
			});

			const edgeListContent = edges.map((e) => `${e.source} ${e.target}`).join("\n");
			const perturbedBenchmark = loadBenchmarkFromContent(edgeListContent, meta);

			const expander = new BenchmarkGraphExpander(perturbedBenchmark.graph, perturbedBenchmark.meta.directed);
			const allNodeIds = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodeIds[0], allNodeIds.at(-1) ?? allNodeIds[0]];

			const dp = new DegreePrioritisedExpansion(expander, seeds);
			const bfs = new StandardBfsExpansion(expander, seeds);

			const [dpResult, bfsResult] = await Promise.all([dp.run(), bfs.run()]);

			results.push({
				perturbation: name,
				dpDiversity: pathDiversity(dpResult.paths),
				bfsDiversity: pathDiversity(bfsResult.paths),
			});
		}

		console.log("\n=== Consistent Method Ranking ===");
		for (const r of results) {
			const winner = r.dpDiversity > r.bfsDiversity ? "DP" : (r.bfsDiversity > r.dpDiversity ? "BFS" : "Tie");
			console.log(`${r.perturbation}: DP=${r.dpDiversity.toFixed(3)}, BFS=${r.bfsDiversity.toFixed(3)} (${winner})`);
		}

		// DP should win or tie on at least 2/3 perturbations
		const dpWins = results.filter((r) => r.dpDiversity >= r.bfsDiversity).length;
		expect(dpWins).toBeGreaterThanOrEqual(2);
	});
});
