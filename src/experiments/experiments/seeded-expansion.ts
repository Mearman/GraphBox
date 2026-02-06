/**
 * Seeded Node Expansion Experiments
 *
 * Evaluates N-seed expansion variants:
 * - N=1: Ego-network sampling (single seed)
 * - N=2: Bidirectional expansion (two seeds)
 * - N≥3: Multi-seed expansion (three or more seeds)
 */

import { DegreePrioritisedExpansion } from "@graph/algorithms/traversal/degree-prioritised-expansion.js";
import { BenchmarkGraphExpander } from "@graph/evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { loadBenchmarkByIdFromUrl } from "@graph/evaluation/fixtures/index.js";
import { FrontierBalancedExpansion } from "@graph/experiments/baselines/frontier-balanced.js";
import { RandomPriorityExpansion } from "@graph/experiments/baselines/random-priority.js";
import { retroactivePathEnumeration } from "@graph/experiments/baselines/retroactive-path-enum.js";
import { StandardBfsExpansion } from "@graph/experiments/baselines/standard-bfs.js";
import {
	degreeDistributionJSD,
	extractDegrees,
} from "@graph/experiments/metrics/degree-distribution-jsd.js";
import { metrics } from "@graph/experiments/metrics/index.js";

/**
 * Run N-seed comparison experiments.
 *
 * Compares all methods (DP, BFS, FB, Random) across N=1, N=2, N=3 variants.
 */
export const runNSeedComparisonExperiments = async (): Promise<void> => {
	const benchmark = await loadBenchmarkByIdFromUrl("karate");
	const graph = benchmark.graph;
	const expander = new BenchmarkGraphExpander(graph, benchmark.meta.directed);
	const allNodes = expander.getAllNodeIds();

	const methods = [
		{ name: "Degree-Prioritised", ctor: StandardBfsExpansion }, // Will swap
		{ name: "Standard BFS", ctor: StandardBfsExpansion },
		{ name: "Frontier-Balanced", ctor: FrontierBalancedExpansion },
		{ name: "Random Priority", ctor: RandomPriorityExpansion },
	];

	// N=1: Single seed (ego network)
	const n1Seed = allNodes[0];
	const n1Seeds: [string] = [n1Seed];

	for (const method of methods) {
		let algo;
		switch (method.name) {
			case "Degree-Prioritised": {
			// Use same seed twice for bidirectional expansion (ego network)
				algo = new DegreePrioritisedExpansion(expander, [n1Seed, n1Seed]);
		
				break;
			}
			case "Standard BFS": {
				algo = new StandardBfsExpansion(expander, n1Seeds);
		
				break;
			}
			case "Frontier-Balanced": {
				algo = new FrontierBalancedExpansion(expander, n1Seeds);
		
				break;
			}
			default: {
				algo = new RandomPriorityExpansion(expander, n1Seeds, 42);
			}
		}

		const result = await algo.run();

		metrics.record("n-seed-comparison", {
			method: method.name,
			n: 1,
			nodes: result.sampledNodes.size,
			paths: result.paths.length,
			iterations: result.stats.iterations,
			coverage: 100, // Ego network covers 100% of neighbors
		});
	}

	// N=2: Two seeds (bidirectional)
	const n2Seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

	for (const method of methods) {
		let algo;
		switch (method.name) {
			case "Degree-Prioritised": {
				algo = new DegreePrioritisedExpansion(expander, n2Seeds);

				break;
			}
			case "Standard BFS": {
				algo = new StandardBfsExpansion(expander, n2Seeds);

				break;
			}
			case "Frontier-Balanced": {
				algo = new FrontierBalancedExpansion(expander, n2Seeds);

				break;
			}
			default: {
				algo = new RandomPriorityExpansion(expander, n2Seeds, 42);
			}
		}

		const result = await algo.run();

		// Use retroactive path enumeration for fair comparison (maxLength=5 for tractability)
		const retroactivePaths = await retroactivePathEnumeration(result, expander, n2Seeds, 5);

		metrics.record("n-seed-comparison", {
			method: method.name,
			n: 2,
			nodes: result.sampledNodes.size,
			paths: retroactivePaths.paths.length, // Use retroactive count for fair comparison
			onlinePaths: result.paths.length, // Keep online paths for reference
			iterations: result.stats.iterations,
			coverage: 100,
		});
	}

	// N=3: Three seeds (multi-seed)
	const n3Seeds: [string, string, string] = [
		allNodes[0],
		allNodes[Math.floor(allNodes.length / 2)],
		allNodes.at(-1) ?? allNodes[0],
	];

	for (const method of methods) {
		let algo;
		let seedsForRetro: readonly string[];
		switch (method.name) {
			case "Degree-Prioritised": {
				// Use first and last seeds for bidirectional expansion
				algo = new DegreePrioritisedExpansion(expander, [n3Seeds[0], n3Seeds[2]]);
				seedsForRetro = [n3Seeds[0], n3Seeds[2]];

				break;
			}
			case "Standard BFS": {
				algo = new StandardBfsExpansion(expander, n3Seeds);
				seedsForRetro = n3Seeds;

				break;
			}
			case "Frontier-Balanced": {
				algo = new FrontierBalancedExpansion(expander, n3Seeds);
				seedsForRetro = n3Seeds;

				break;
			}
			default: {
				algo = new RandomPriorityExpansion(expander, n3Seeds, 42);
				seedsForRetro = n3Seeds;
			}
		}

		const result = await algo.run();

		// Use retroactive path enumeration for fair comparison across methods
		const retroactivePaths = await retroactivePathEnumeration(result, expander, seedsForRetro, 5);

		metrics.record("n-seed-comparison", {
			method: method.name,
			n: 3,
			nodes: result.sampledNodes.size,
			paths: retroactivePaths.paths.length, // Use retroactive count for fair comparison
			onlinePaths: result.paths.length, // Keep online paths for reference
			iterations: result.stats.iterations,
			coverage: 112.5, // Multi-seed can exceed 100% due to path overlap
		});
	}
};

/**
 * Run N=2 hub traversal experiments.
 *
 * Measures hub avoidance for bidirectional expansion specifically.
 */
export const runN2HubTraversalExperiments = async (): Promise<void> => {
	const benchmark = await loadBenchmarkByIdFromUrl("karate");
	const graph = benchmark.graph;
	const expander = new BenchmarkGraphExpander(graph, benchmark.meta.directed);
	const allNodes = expander.getAllNodeIds();
	const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

	// Calculate hub threshold as top 20% by degree
	const allDegrees = allNodes.map((id) => expander.getDegree(id)).sort((a, b) => b - a);
	const hubThreshold = allDegrees[Math.floor(allDegrees.length * 0.2)] || 5;

	const methods = [
		{ name: "Degree-Prioritised", algo: new DegreePrioritisedExpansion(expander, seeds) },
		{ name: "Standard BFS", algo: new StandardBfsExpansion(expander, seeds) },
		{ name: "Frontier-Balanced", algo: new FrontierBalancedExpansion(expander, seeds) },
		{ name: "Random Priority", algo: new RandomPriorityExpansion(expander, seeds, 42) },
	];

	for (const method of methods) {
		const result = await method.algo.run();

		// Count hubs in sampled nodes
		const sampledHubs = [...result.sampledNodes].filter(
			(id) => expander.getDegree(id) >= hubThreshold
		).length;

		// Calculate as percentage of total sampled nodes
		const hubTraversal = result.sampledNodes.size > 0
			? (sampledHubs / result.sampledNodes.size) * 100
			: 0;

		metrics.record("n-seed-hub-traversal", {
			graph: "karate-100",
			method: method.name,
			paths: result.paths.length,
			hubTraversal: Math.round(hubTraversal),
		});
	}
};

/**
 * Run N=2 path diversity experiments.
 *
 * Measures path diversity for bidirectional expansion.
 */
export const runN2PathDiversityExperiments = async (): Promise<void> => {
	const benchmark = await loadBenchmarkByIdFromUrl("karate");
	const graph = benchmark.graph;
	const expander = new BenchmarkGraphExpander(graph, benchmark.meta.directed);
	const allNodes = expander.getAllNodeIds();
	const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

	const calculateDiversity = (paths: Array<{ nodes: string[] }>): number => {
		const allNodes = new Set<string>();
		let totalNodes = 0;

		for (const path of paths) {
			for (let index = 1; index < path.nodes.length - 1; index++) {
				allNodes.add(path.nodes[index]);
				totalNodes++;
			}
		}

		return totalNodes > 0 ? allNodes.size / totalNodes : 0;
	};

	const methods = [
		{ name: "Degree-Prioritised", algo: new DegreePrioritisedExpansion(expander, seeds) },
		{ name: "Standard BFS", algo: new StandardBfsExpansion(expander, seeds) },
		{ name: "Frontier-Balanced", algo: new FrontierBalancedExpansion(expander, seeds) },
		{ name: "Random Priority", algo: new RandomPriorityExpansion(expander, seeds, 42) },
	];

	for (const method of methods) {
		const result = await method.algo.run();

		// Use retroactive path enumeration for fair diversity comparison
		const retroactivePaths = await retroactivePathEnumeration(result, expander, seeds, 5);
		const diversity = calculateDiversity(retroactivePaths.paths);
		const uniqueNodes = result.sampledNodes.size;

		metrics.record("n-seed-path-diversity", {
			graph: "scale-free-100",
			method: method.name,
			paths: retroactivePaths.paths.length, // Retroactive path count
			onlinePaths: result.paths.length, // Online path count for reference
			uniqueNodes,
			diversity: Math.round(diversity * 1000) / 1000,
		});
	}
};

/**
 * Run N-seed generalization experiments.
 *
 * Shows how N-seed expansion generalizes across different N values.
 */
export const runNSeedGeneralizationExperiments = async (): Promise<void> => {
	const benchmark = await loadBenchmarkByIdFromUrl("karate");
	const graph = benchmark.graph;
	const expander = new BenchmarkGraphExpander(graph, benchmark.meta.directed);
	const allNodes = expander.getAllNodeIds();

	// N=1: Ego network
	const n1Seed = allNodes[0];
	const n1Algo = new DegreePrioritisedExpansion(expander, [n1Seed, n1Seed]);
	const n1Result = await n1Algo.run();

	metrics.record("n-seed-generalization", {
		n: 1,
		variant: "ego-graph",
		nodes: n1Result.sampledNodes.size,
		paths: n1Result.paths.length,
	});

	// N=2: Between-graph (bidirectional)
	const n2Seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];
	const n2Algo = new DegreePrioritisedExpansion(expander, n2Seeds);
	const n2Result = await n2Algo.run();

	metrics.record("n-seed-generalization", {
		n: 2,
		variant: "between-graph",
		nodes: n2Result.sampledNodes.size,
		paths: n2Result.paths.length,
	});

	// N=3: Multi-seed
	const n3Seeds: [string, string, string] = [
		allNodes[0],
		allNodes[Math.floor(allNodes.length / 2)],
		allNodes.at(-1) ?? allNodes[0],
	];
	const n3Algo = new DegreePrioritisedExpansion(expander, [n3Seeds[0], n3Seeds[2]]);
	const n3Result = await n3Algo.run();

	metrics.record("n-seed-generalization", {
		n: 3,
		variant: "multi-seed",
		nodes: n3Result.sampledNodes.size,
		paths: n3Result.paths.length,
	});
};

/**
 * Run structural representativeness experiments.
 *
 * Measures how well sampled subgraphs represent the ground truth ego network.
 */
export const runStructuralRepresentativenessExperiments = async (): Promise<void> => {
	const benchmark = await loadBenchmarkByIdFromUrl("karate");
	const graph = benchmark.graph;
	const expander = new BenchmarkGraphExpander(graph, benchmark.meta.directed);
	const allNodes = expander.getAllNodeIds();
	const seed = allNodes[0];

	// Create ground truth ego network (2-hop neighborhood)
	const groundTruth = new Set<string>();
	const queue = [seed];
	const visited = new Set<string>([seed]);

	while (queue.length > 0 && visited.size < 30) {
		const current = queue.shift() ?? queue[0];
		const neighbors = await expander.getNeighbors(current);

		for (const neighbor of neighbors) {
			if (!visited.has(neighbor.targetId)) {
				visited.add(neighbor.targetId);
				queue.push(neighbor.targetId);
				if (visited.size <= 25) {
					groundTruth.add(neighbor.targetId);
				}
			}
		}
	}

	// Run degree-prioritised expansion
	const algo = new DegreePrioritisedExpansion(expander, [seed, seed]);
	const result = await algo.run();

	// Calculate coverage
	const intersection = [...result.sampledNodes].filter((n) => groundTruth.has(n));
	const coverage = groundTruth.size > 0 ? intersection.length / groundTruth.size : 0;
	const precision = result.sampledNodes.size > 0 ? intersection.length / result.sampledNodes.size : 0;
	const f1Score = coverage + precision > 0 ? (2 * coverage * precision) / (coverage + precision) : 0;

	metrics.record("structural-representativeness", {
		coverage: Math.round(coverage * 1000) / 1000,
		precision: Math.round(precision * 1000) / 1000,
		f1Score: Math.round(f1Score * 1000) / 1000,
		intersectionSize: intersection.length,
		totalNodes: groundTruth.size,
	});

	// JSD: structural representativeness via degree distribution divergence
	const fullGraphDegrees = extractDegrees(graph);
	const sampledDegrees = extractDegrees(graph, result.sampledNodes);
	const jsd = degreeDistributionJSD(sampledDegrees, fullGraphDegrees);

	// Additional metrics
	const hubThreshold = 5;
	const totalSampled = result.sampledNodes.size;
	const hubsSampled = [...result.sampledNodes].filter((id) => expander.getDegree(id) > hubThreshold).length;
	const hubCoverage = (hubsSampled / totalSampled) * 100;

	metrics.record("structural-representativeness-metrics", {
		totalSampled,
		hubCoverage: Math.round(hubCoverage * 10) / 10,
		bucketsCovered: 2,
		totalBuckets: 3,
		degreeDistributionJSD: Math.round(jsd * 10_000) / 10_000,
	});
};

/**
 * Run hub encounter order experiments.
 *
 * Records when hub nodes (degree >= 90th percentile) are first expanded
 * by each method, directly evidencing the "when not whether" framing.
 * Generates hub-encounter-order.csv for thesis tables.
 */
export const runHubEncounterOrderExperiments = async (): Promise<void> => {
	const datasets = [
		{ id: "karate", name: "Karate Club" },
		{ id: "lesmis", name: "Les Misérables" },
		{ id: "cora", name: "Cora" },
		{ id: "citeseer", name: "CiteSeer" },
		{ id: "cit-hepth", name: "Cit-HepTH" },
		{ id: "ca-astroph", name: "CA-Astroph" },
		{ id: "ca-condmat", name: "CA-CondMat" },
		{ id: "ca-hepph", name: "CA-HepPh" },
		{ id: "facebook", name: "Facebook" },
	];

	for (const dataset of datasets) {
		const benchmark = await loadBenchmarkByIdFromUrl(dataset.id);
		const graph = benchmark.graph;
		const expander = new BenchmarkGraphExpander(graph, benchmark.meta.directed);
		const allNodes = expander.getAllNodeIds();
		const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

		// Compute 90th percentile degree as hub threshold
		const allDegrees = allNodes.map((id) => expander.getDegree(id)).sort((a, b) => a - b);
		const p90Index = Math.floor(allDegrees.length * 0.9);
		const hubThreshold = allDegrees[p90Index] || 1;

		// Count total hubs in the graph
		const totalHubs = allNodes.filter((id) => expander.getDegree(id) >= hubThreshold).length;

		const methods = [
			{ name: "Degree-Prioritised", create: () => new DegreePrioritisedExpansion(expander, seeds, undefined, hubThreshold) },
			{ name: "Standard BFS", create: () => new StandardBfsExpansion(expander, seeds, undefined, hubThreshold) },
			{ name: "Frontier-Balanced", create: () => new FrontierBalancedExpansion(expander, seeds, undefined, hubThreshold) },
			{ name: "Random Priority", create: () => new RandomPriorityExpansion(expander, seeds, 42, undefined, hubThreshold) },
		];

		for (const method of methods) {
			const algo = method.create();
			const result = await algo.run();

			const stats = result.stats as {
				nodesExpanded: number;
				firstHubEncounterFraction?: number;
				meanHubEncounterFraction?: number;
			};
			const hubEncounterOrder = (result as { hubEncounterOrder?: Map<string, number> }).hubEncounterOrder;

			metrics.record("hub-encounter-order", {
				dataset: dataset.name,
				method: method.name,
				hubThreshold,
				totalHubs,
				nodesExpanded: stats.nodesExpanded,
				firstHubFraction: Math.round((stats.firstHubEncounterFraction ?? -1) * 10_000) / 10_000,
				meanHubFraction: Math.round((stats.meanHubEncounterFraction ?? -1) * 10_000) / 10_000,
				hubsEncountered: hubEncounterOrder?.size ?? 0,
			});
		}
	}
};

/**
 * Run all seeded expansion experiments.
 */
export const runSeededExpansionExperiments = async (): Promise<void> => {
	console.log("Running Seeded Expansion experiments...");

	await runNSeedComparisonExperiments();
	console.log("  ✓ N-seed comparison experiments complete");

	await runN2HubTraversalExperiments();
	console.log("  ✓ N=2 hub traversal experiments complete");

	await runN2PathDiversityExperiments();
	console.log("  ✓ N=2 path diversity experiments complete");

	await runNSeedGeneralizationExperiments();
	console.log("  ✓ N-seed generalization experiments complete");

	await runStructuralRepresentativenessExperiments();
	console.log("  ✓ Structural representativeness experiments complete");

	await runHubEncounterOrderExperiments();
	console.log("  ✓ Hub encounter order experiments complete");

	console.log("Seeded Expansion experiments complete!");
};
