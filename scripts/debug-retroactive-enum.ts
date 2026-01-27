#!/usr/bin/env tsx
import { DegreePrioritisedExpansion } from "../src/algorithms/traversal/degree-prioritised-expansion.js";
import { BenchmarkGraphExpander } from "../src/experiments/evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { loadBenchmarkByIdFromUrl } from "../src/experiments/evaluation/fixtures/index.js";
import { retroactivePathEnumeration } from "../src/experiments/baselines/retroactive-path-enum.js";

const debug = async () => {
	const benchmark = await loadBenchmarkByIdFromUrl("karate");
	const { graph } = benchmark;
	const expander = new BenchmarkGraphExpander(graph, false);
	const seeds = ["1", "34"];

	console.log("Running expansion...");
	const algo = new DegreePrioritisedExpansion(expander, seeds);
	const result = await algo.run();

	console.log("Sampled nodes:", result.sampledNodes.size);
	console.log(
		"Sampled nodes list:",
		Array.from(result.sampledNodes)
			.toSorted((a, b) => a.localeCompare(b))
			.join(", "),
	);

	console.log("\nRunning retroactive enumeration with maxLength=10...");
	const enum1 = await retroactivePathEnumeration(result, expander, seeds, 10);
	console.log("Paths found (maxLength=10):", enum1.paths.length);

	console.log("\nRunning retroactive enumeration with maxLength=20...");
	const enum2 = await retroactivePathEnumeration(result, expander, seeds, 20);
	console.log("Paths found (maxLength=20):", enum2.paths.length);

	console.log("\nChecking if seeds are connected...");
	console.log("Seed 1 in sampled:", result.sampledNodes.has("1"));
	console.log("Seed 34 in sampled:", result.sampledNodes.has("34"));

	if (enum2.paths.length > 0) {
		console.log("\nShortest path found:", enum2.paths[0].nodes.join("->"));
		console.log("Path length:", enum2.paths[0].nodes.length);
	} else {
		console.log("\nNo paths found! Investigating why...");

		// Check if there's a path in the original graph
		console.log("\nChecking direct connection in original graph...");
		const neighbors1 = await expander.getNeighbors("1");
		const neighbors34 = await expander.getNeighbors("34");
		console.log("Node 1 has", neighbors1.length, "neighbors");
		console.log("Node 34 has", neighbors34.length, "neighbors");

		// Check if both seeds are actually in the graph
		const allNodes = graph.getAllNodes().map((n) => n.id);
		const sortedNodes = allNodes.toSorted((a, b) => a.localeCompare(b));
		console.log("\nAll graph nodes:", sortedNodes.join(", "));
		console.log("Total nodes in graph:", allNodes.length);
	}
};

debug().catch((error) => {
	console.error("Debug failed:", error);
	process.exit(1);
});
