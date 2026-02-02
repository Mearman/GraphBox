/**
 * Find valid connected node pairs for benchmark datasets.
 * Tests random node pairs to find ones with paths.
 */

import { loadBenchmarkByIdFromUrl } from "../src/experiments/evaluation/fixtures/index.js";

const DATASETS = [
	"cit-hepth",
	"ca-astroph",
	"ca-condmat",
	"ca-hepph",
];

const findConnectedPairs = async (datasetId: string, trials = 100) => {
	console.log(`\n=== ${datasetId} ===`);
	const benchmark = await loadBenchmarkByIdFromUrl(datasetId);
	const graph = benchmark.graph;
	const nodes = graph.getAllNodes().map((n) => n.id);

	console.log(`Total nodes: ${nodes.length}`);

	// Try random pairs until we find one with a path
	for (let i = 0; i < trials; i++) {
		const sourceIdx = Math.floor(Math.random() * nodes.length);
		const targetIdx = Math.floor(Math.random() * nodes.length);

		if (sourceIdx === targetIdx) continue;

		const source = nodes[sourceIdx];
		const target = nodes[targetIdx];

		// Simple BFS to check if path exists
		const visited = new Set<string>();
		const queue = [source];

		while (queue.length > 0) {
			const current = queue.shift();
			if (current === undefined) break;
			if (current === target) {
				console.log(`Found pair: ${source} → ${target}`);
				return { source, target };
			}

			if (visited.has(current)) continue;
			visited.add(current);

			const neighborsResult = graph.getNeighbors(current);
			if (!neighborsResult.ok) continue;
			const neighbors = neighborsResult.value;
			for (const nbr of neighbors) {
				if (!visited.has(nbr)) {
					queue.push(nbr);
				}
			}
		}
	}

	console.log(`No connected pair found in ${trials} trials`);
	return null;
};

const main = async () => {
	for (const datasetId of DATASETS) {
		await findConnectedPairs(datasetId, 500);
	}
};

main().catch(console.error);
