import { kCoreDecomposition } from "@graph/algorithms/decomposition/k-core";
import { loadBenchmarkByIdFromUrl } from "@graph/evaluation/fixtures/benchmark-datasets";
import { describe, expect, it } from "vitest";

const BENCHMARKS = [
	{ id: "karate", name: "Karate Club" },
	{ id: "lesmis", name: "Les Miserables" },
	{ id: "cora", name: "Cora" },
	{ id: "facebook", name: "Facebook" },
] as const;

const countPeriphery = (coreNumbers: Map<string, number>): number => {
	let count = 0;
	for (const [, coreNumber] of coreNumbers) {
		if (coreNumber <= 1) {
			count++;
		}
	}
	return count;
};

const logCoreDistribution = async (benchmarks: typeof BENCHMARKS): Promise<void> => {
	console.log("\n=== Core Distribution Summary ===");
	console.log("dataset\tcoreLevel\tnodeCount");

	for (const { id, name } of benchmarks) {
		const benchmark = await loadBenchmarkByIdFromUrl(id);
		const result = kCoreDecomposition(benchmark.graph);
		if (!result.ok) continue;

		const levelCounts = new Map<number, number>();
		for (const [, coreNumber] of result.value.coreNumbers) {
			levelCounts.set(coreNumber, (levelCounts.get(coreNumber) ?? 0) + 1);
		}

		const sortedLevels = [...levelCounts.entries()].toSorted((a, b) => a[0] - b[0]);
		for (const [level, count] of sortedLevels) {
			console.log(`${name}\t${level}\t${count}`);
		}
	}
};

describe("K-Core Decomposition: Core-Periphery Analysis", () => {
	it("should analyse core vs peripheral node distribution across graphs", async () => {
		console.log("\n=== K-Core Decomposition: Core-Periphery Analysis ===");
		console.log(
			"dataset\tnodes\tdegeneracy\tinnermostSize\tinnermostFraction\tperipherySize\tperipheryFraction",
		);

		const results: Array<{
			name: string;
			nodes: number;
			innermostSize: number;
			innermostFraction: number;
			peripheryFraction: number;
		}> = [];

		for (const { id, name } of BENCHMARKS) {
			const benchmark = await loadBenchmarkByIdFromUrl(id);
			const graph = benchmark.graph;
			const result = kCoreDecomposition(graph);

			expect(result.ok).toBe(true);
			if (!result.ok) continue;

			const { cores, degeneracy, coreNumbers } = result.value;
			const nodeCount = graph.getNodeCount();

			const innermostCore = cores.get(degeneracy);
			const innermostSize = innermostCore ? innermostCore.size : 0;
			const innermostFraction = innermostSize / nodeCount;

			const peripherySize = countPeriphery(coreNumbers);
			const peripheryFraction = peripherySize / nodeCount;

			results.push({ name, nodes: nodeCount, innermostSize, innermostFraction, peripheryFraction });

			console.log(
				`${name}\t${nodeCount}\t${degeneracy}\t${innermostSize}\t${innermostFraction.toFixed(4)}\t${peripherySize}\t${peripheryFraction.toFixed(4)}`,
			);
		}

		for (const r of results) {
			expect(r.innermostSize).toBeLessThan(r.nodes);
			expect(r.innermostSize).toBeGreaterThan(0);
			expect(r.innermostFraction + r.peripheryFraction).toBeLessThanOrEqual(1.0001);
		}

		await logCoreDistribution(BENCHMARKS);
	});
});
