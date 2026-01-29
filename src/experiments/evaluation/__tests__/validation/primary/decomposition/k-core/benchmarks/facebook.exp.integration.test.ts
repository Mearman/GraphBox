import { kCoreDecomposition } from "@graph/algorithms/decomposition/k-core";
import { loadBenchmarkByIdFromUrl } from "@graph/evaluation/fixtures/benchmark-datasets";
import { describe, expect, it } from "vitest";

describe("K-Core Decomposition: Facebook", () => {
	it("should identify hierarchical core structure", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("facebook");
		const graph = benchmark.graph;
		const result = kCoreDecomposition(graph);

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const { cores, degeneracy, metadata } = result.value;

		expect(metadata.algorithm).toBe("k-core");
		expect(degeneracy).toBeGreaterThan(0);
		expect(cores.size).toBeGreaterThan(1);

		// Validate nesting: k+1-core should be subset of k-core
		for (let k = 1; k < degeneracy; k++) {
			const kCore = cores.get(k);
			const kPlusOneCore = cores.get(k + 1);
			if (kCore && kPlusOneCore) {
				for (const node of kPlusOneCore.nodes) {
					expect(kCore.nodes.has(node)).toBe(true);
				}
			}
		}

		const maxCoreSize = Math.max(...[...cores.values()].map((c) => c.size));

		console.log("\n=== K-Core Decomposition ===");
		console.log("dataset\tdegeneracy\tcoreCount\tmaxCoreSize\tnodes\tedges");
		console.log(
			`Facebook\t${degeneracy}\t${cores.size}\t${maxCoreSize}\t${graph.getNodeCount()}\t${graph.getEdgeCount()}`,
		);
	});
});
