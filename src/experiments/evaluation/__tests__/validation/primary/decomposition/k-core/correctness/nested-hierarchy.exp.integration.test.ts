import { kCoreDecomposition } from "@graph/algorithms/decomposition/k-core";
import { loadBenchmarkByIdFromUrl } from "@graph/evaluation/fixtures/benchmark-datasets";
import { describe, expect, it } from "vitest";

const BENCHMARKS = [
	{ id: "karate", name: "Karate Club" },
	{ id: "lesmis", name: "Les Miserables" },
	{ id: "cora", name: "Cora" },
	{ id: "facebook", name: "Facebook" },
] as const;

describe("K-Core Decomposition: Nested Hierarchy Correctness", () => {
	for (const { id, name } of BENCHMARKS) {
		it(`should satisfy nesting property on ${name}`, async () => {
			const benchmark = await loadBenchmarkByIdFromUrl(id);
			const graph = benchmark.graph;
			const result = kCoreDecomposition(graph);

			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const { cores, degeneracy, coreNumbers } = result.value;

			// Every node should have a core number assigned
			expect(coreNumbers.size).toBe(graph.getNodeCount());

			// Core numbers should be between 0 and degeneracy
			for (const [, coreNumber] of coreNumbers) {
				expect(coreNumber).toBeGreaterThanOrEqual(0);
				expect(coreNumber).toBeLessThanOrEqual(degeneracy);
			}

			// Strict nesting: every node in the (k+1)-core must also be in the k-core
			for (let k = 1; k < degeneracy; k++) {
				const kCore = cores.get(k);
				const kPlusOneCore = cores.get(k + 1);
				if (kCore && kPlusOneCore) {
					for (const node of kPlusOneCore.nodes) {
						expect(kCore.nodes.has(node)).toBe(true);
					}
					// Higher cores should be strictly smaller or equal
					expect(kPlusOneCore.size).toBeLessThanOrEqual(kCore.size);
				}
			}

			// The 0-core (if present) or 1-core should contain all nodes
			const lowestCore = cores.get(0) ?? cores.get(1);
			if (lowestCore) {
				expect(lowestCore.size).toBe(graph.getNodeCount());
			}

			// Each core's k value should match its key in the map
			for (const [k, core] of cores) {
				expect(core.k).toBe(k);
			}

			console.log(`[${name}] nesting validated: degeneracy=${degeneracy}, cores=${cores.size}`);
		});
	}

	it("should produce consistent results summary", async () => {
		console.log("\n=== K-Core Decomposition: Nesting Validation ===");
		console.log("dataset\tdegeneracy\tcoreCount\tnodes\tvalid");

		let successCount = 0;
		for (const { id, name } of BENCHMARKS) {
			const benchmark = await loadBenchmarkByIdFromUrl(id);
			const result = kCoreDecomposition(benchmark.graph);

			if (!result.ok) {
				console.log(`${name}\tERROR\t-\t-\tfalse`);
				continue;
			}

			successCount++;
			const { cores, degeneracy } = result.value;
			console.log(
				`${name}\t${degeneracy}\t${cores.size}\t${benchmark.graph.getNodeCount()}\ttrue`,
			);
		}

		expect(successCount).toBe(BENCHMARKS.length);
	});
});
