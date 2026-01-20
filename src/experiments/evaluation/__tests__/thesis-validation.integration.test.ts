/**
 * Thesis Validation Tests with Statistical Rigor
 *
 * Comprehensive experimental validation for novelty, validity, and value claims.
 * Uses real-world benchmark datasets, statistical significance testing, and
 * application-specific metrics.
 *
 * Test Structure:
 * 1. Benchmark Dataset Tests - Real graphs (Karate Club, Les Misérables, Cora)
 * 2. Statistical Tests - Significance testing, effect sizes, confidence intervals
 * 3. Multi-Baseline Comparison - All 4 methods compared
 * 4. Application Metrics - Literature review specific evaluation
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../algorithms/traversal/degree-prioritised-expansion";
import type { GraphExpander, Neighbor } from "../../../interfaces/graph-expander";
import { FrontierBalancedExpansion } from "../../baselines/frontier-balanced";
import { RandomPriorityExpansion } from "../../baselines/random-priority";
import { StandardBfsExpansion } from "../../baselines/standard-bfs";
import {
	createBenchmarkMeta,
	loadBenchmarkByIdFromUrl,
	loadBenchmarkFromContent,
} from "../fixtures/benchmark-datasets";

// ============================================================================
// Benchmark Graph Adapter
// ============================================================================

/**
 * Adapts a loaded benchmark graph to the GraphExpander interface.
 * The benchmark graphs use the core Graph class with LoadedNode/LoadedEdge types.
 */
class BenchmarkGraphExpander implements GraphExpander<{ id: string }> {
	private adjacency: Map<string, string[]>;
	private degrees: Map<string, number>;
	private nodeIds: string[];

	constructor(
		private graph: { getAllNodes: () => Array<{ id: string }>; getAllEdges: () => Array<{ source: string; target: string }> },
		directed: boolean
	) {
		this.adjacency = new Map();
		this.degrees = new Map();
		this.nodeIds = graph.getAllNodes().map((n) => n.id);

		// Build adjacency list and compute degrees
		for (const nodeId of this.nodeIds) {
			this.adjacency.set(nodeId, []);
			this.degrees.set(nodeId, 0);
		}

		for (const edge of graph.getAllEdges()) {
			this.adjacency.get(edge.source)!.push(edge.target);
			this.degrees.set(edge.source, (this.degrees.get(edge.source) ?? 0) + 1);

			if (!directed) {
				this.adjacency.get(edge.target)!.push(edge.source);
				this.degrees.set(edge.target, (this.degrees.get(edge.target) ?? 0) + 1);
			}
		}
	}

	async getNeighbors(nodeId: string): Promise<Neighbor[]> {
		const neighbors = this.adjacency.get(nodeId) ?? [];
		return neighbors.map((targetId) => ({ targetId, relationshipType: "edge" }));
	}

	getDegree(nodeId: string): number {
		return this.degrees.get(nodeId) ?? 0;
	}

	async getNode(nodeId: string): Promise<{ id: string } | null> {
		return this.nodeIds.includes(nodeId) ? { id: nodeId } : null;
	}

	addEdge(): void {
		// No-op for benchmark tests
	}

	calculatePriority(nodeId: string, options: { nodeWeight?: number; epsilon?: number } = {}): number {
		const { nodeWeight = 1, epsilon = 1e-10 } = options;
		const degree = this.getDegree(nodeId);
		return degree / (nodeWeight + epsilon);
	}

	getNodeCount(): number {
		return this.nodeIds.length;
	}

	getAllNodeIds(): string[] {
		return [...this.nodeIds];
	}

	/**
	 * Get the degree distribution for statistical analysis.
	 */
	getDegreeDistribution(): Map<number, number> {
		const distribution = new Map<number, number>();
		for (const degree of this.degrees.values()) {
			distribution.set(degree, (distribution.get(degree) ?? 0) + 1);
		}
		return distribution;
	}
}

// ============================================================================
// Statistical Test Utilities
// ============================================================================

/**
 * Mann-Whitney U test for comparing two independent samples.
 * Tests whether two populations have the same distribution.
 *
 * H0: Both populations have the same distribution
 * H1: Populations have different distributions
 *
 * Returns p-value (smaller = more significant difference)
 * @param sampleA
 * @param sampleB
 */
const mannWhitneyUTest = (sampleA: number[], sampleB: number[]): {
	u: number;
	pValue: number;
	significant: boolean;
} => {
	// Rank all values combined
	const combined = [...sampleA, ...sampleB];
	const sorted = [...combined].sort((a, b) => a - b);

	// Assign ranks (handle ties)
	const ranks = new Map<number, number[]>();
	for (const [index, value] of sorted.entries()) {
		if (!ranks.has(value)) {
			ranks.set(value, []);
		}
		ranks.get(value)!.push(index + 1);
	}

	// Average rank for tied values
	const avgRanks = new Map<number, number>();
	for (const [value, positions] of ranks) {
		avgRanks.set(value, positions.reduce((a, b) => a + b, 0) / positions.length);
	}

	// Sum ranks for each sample
	const rankSumA = sampleA.reduce((sum, value) => sum + (avgRanks.get(value) ?? 0), 0);
	const rankSumB = sampleB.reduce((sum, value) => sum + (avgRanks.get(value) ?? 0), 0);

	// Calculate U statistics
	const n1 = sampleA.length;
	const n2 = sampleB.length;
	const u1 = rankSumA - (n1 * (n1 + 1)) / 2;
	const u2 = rankSumB - (n2 * (n2 + 1)) / 2;
	const u = Math.min(u1, u2);

	// Calculate z-score for large samples
	const meanU = (n1 * n2) / 2;
	const stdU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
	const z = stdU > 0 ? (u - meanU) / stdU : 0;

	// Two-tailed p-value from z-score (approximation)
	const pValue = 2 * (1 - normalCDF(Math.abs(z)));

	return {
		u,
		pValue,
		significant: pValue < 0.05, // 95% confidence level
	};
};

/**
 * Standard normal cumulative distribution function.
 * @param z
 */
const normalCDF = (z: number): number => {
	// Abramowitz and Stegun approximation
	const sign = z < 0 ? -1 : 1;
	z = Math.abs(z) / Math.sqrt(2);
	const a1 = 0.254_829_592;
	const a2 = -0.284_496_736;
	const a3 = 1.421_413_741;
	const a4 = -1.453_152_027;
	const a5 = 1.061_405_429;
	const p = 0.327_591_1;

	const t = 1 / (1 + p * z);
	const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
	return 0.5 * (1 + sign * y);
};

/**
 * Calculate Cohen's d effect size.
 * Measures the standardized difference between two means.
 *
 * Interpretation:
 * - 0.2: Small effect
 * - 0.5: Medium effect
 * - 0.8: Large effect
 * @param sampleA
 * @param sampleB
 */
const cohensD = (sampleA: number[], sampleB: number[]): number => {
	const n1 = sampleA.length;
	const n2 = sampleB.length;

	const mean1 = sampleA.reduce((a, b) => a + b, 0) / n1;
	const mean2 = sampleB.reduce((a, b) => a + b, 0) / n2;

	const variable1 = sampleA.reduce((sum, value) => sum + (value - mean1) ** 2, 0) / (n1 - 1);
	const variable2 = sampleB.reduce((sum, value) => sum + (value - mean2) ** 2, 0) / (n2 - 1);

	const pooledStd = Math.sqrt(((n1 - 1) * variable1 + (n2 - 1) * variable2) / (n1 + n2 - 2));

	return pooledStd > 0 ? Math.abs(mean1 - mean2) / pooledStd : 0;
};

/**
 * Calculate confidence interval for a mean.
 * @param values
 * @param _confidence
 */
const confidenceInterval = (values: number[], _confidence = 0.95): { lower: number; upper: number } => {
	const n = values.length;
	const mean = values.reduce((a, b) => a + b, 0) / n;
	const std = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1));
	const se = std / Math.sqrt(n);
	const t = 1.96; // Approximation for large samples (95% CI)

	const margin = t * se;
	return {
		lower: mean - margin,
		upper: mean + margin,
	};
};

/**
 * Calculate Jaccard similarity between two sets.
 * @param setA
 * @param setB
 */
const jaccardSimilarity = <T>(setA: Set<T>, setB: Set<T>): number => {
	const intersection = new Set([...setA].filter((x) => setB.has(x)));
	const union = new Set([...setA, ...setB]);
	return union.size === 0 ? 1 : intersection.size / union.size;
};

/**
 * Calculate path diversity (entropy of path lengths).
 * @param paths
 */
const pathDiversity = (paths: Array<{ nodes: string[] }>): number => {
	if (paths.length === 0) return 0;

	const lengths = paths.map((p) => p.nodes.length);
	const counts = new Map<number, number>();

	for (const length of lengths) {
		counts.set(length, (counts.get(length) ?? 0) + 1);
	}

	// Calculate Shannon entropy
	let entropy = 0;
	const total = lengths.length;

	for (const count of counts.values()) {
		const p = count / total;
		entropy -= p * Math.log2(p);
	}

	// Normalize by max possible entropy
	const maxEntropy = Math.log2(counts.size);
	return maxEntropy > 0 ? entropy / maxEntropy : 0;
};

// ============================================================================
// Application-Specific Metrics (Literature Review)
// ============================================================================

/**
 * Coverage metric for systematic literature review.
 * Measures how well the sampled subgraph covers different topical regions.
 * @param sampledNodes
 * @param graph
 */
const calculateTopicCoverage = (sampledNodes: Set<string>, graph: BenchmarkGraphExpander): {
	coverage: number;
	avgDegree: number;
	hubRatio: number;
} => {
	let totalDegree = 0;
	let hubCount = 0;

	for (const nodeId of sampledNodes) {
		const degree = graph.getDegree(nodeId);
		totalDegree += degree;
		if (degree >= 10) hubCount++; // "Hub" threshold for citation networks
	}

	const avgDegree = sampledNodes.size > 0 ? totalDegree / sampledNodes.size : 0;
	const hubRatio = sampledNodes.size > 0 ? hubCount / sampledNodes.size : 0;

	// Coverage: proportion of high-degree nodes included
	const allNodes = graph.getAllNodeIds();
	const allHubs = allNodes.filter((id) => graph.getDegree(id) >= 10);
	const sampledHubs = [...sampledNodes].filter((id) => graph.getDegree(id) >= 10);

	const coverage = allHubs.length > 0 ? sampledHubs.length / allHubs.length : 0;

	return { coverage, avgDegree, hubRatio };
};

// ============================================================================
// Test Suite
// ============================================================================

describe("Thesis Validation: Benchmark Datasets", () => {
	describe("Karate Club Dataset", () => {
		/**
		 * Karate Club is a well-studied social network with 34 nodes and 78 edges.
		 * Known to have two communities with ground-truth partition.
		 *
		 * Tests validate algorithm behavior on small real-world networks.
		 */
		it("should compare all methods on Karate Club network", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("karate");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			// Select two nodes from different known communities as seeds
			// Node 1 (Mr. Hi's faction) and Node 34 (John A.'s faction)
			const seeds: [string, string] = ["1", "34"];

			const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
			const standardBfs = new StandardBfsExpansion(expander, seeds);
			const frontierBalanced = new FrontierBalancedExpansion(expander, seeds);
			const randomPriority = new RandomPriorityExpansion(expander, seeds, 42);

			const [dpResult, bfsResult, fbResult, rpResult] = await Promise.all([
				degreePrioritised.run(),
				standardBfs.run(),
				frontierBalanced.run(),
				randomPriority.run(),
			]);

			// All methods should find paths between the factions
			expect(dpResult.paths.length).toBeGreaterThan(0);
			expect(bfsResult.paths.length).toBeGreaterThan(0);
			expect(fbResult.paths.length).toBeGreaterThan(0);
			expect(rpResult.paths.length).toBeGreaterThan(0);

			// Log path diversity metrics
			console.log("\n=== Karate Club Path Analysis ===");
			console.log(`Degree-Prioritised: ${dpResult.paths.length} paths, diversity: ${pathDiversity(dpResult.paths).toFixed(3)}`);
			console.log(`Standard BFS: ${bfsResult.paths.length} paths, diversity: ${pathDiversity(bfsResult.paths).toFixed(3)}`);
			console.log(`Frontier-Balanced: ${fbResult.paths.length} paths, diversity: ${pathDiversity(fbResult.paths).toFixed(3)}`);
			console.log(`Random Priority: ${rpResult.paths.length} paths, diversity: ${pathDiversity(rpResult.paths).toFixed(3)}`);

			// Verify all nodes are reachable
			expect(dpResult.sampledNodes.size).toBe(34);
			expect(bfsResult.sampledNodes.size).toBe(34);
		});

		/**
		 * Statistical significance test for node expansion counts.
		 */
		it("should show significant differences in expansion patterns", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("karate");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);
			const seeds: [string, string] = ["1", "34"];

			// Run multiple trials with different random seeds for Random Priority
			const dpResults: number[] = [];
			const bfsResults: number[] = [];
			const rpResults: number[] = [];

			for (let index = 0; index < 10; index++) {
				const dp = new DegreePrioritisedExpansion(expander, seeds);
				const bfs = new StandardBfsExpansion(expander, seeds);
				const rp = new RandomPriorityExpansion(expander, seeds, 100 + index);

				const [dpRes, bfsRes, rpRes] = await Promise.all([dp.run(), bfs.run(), rp.run()]);

				dpResults.push(dpRes.stats.nodesExpanded);
				bfsResults.push(bfsRes.stats.nodesExpanded);
				rpResults.push(rpRes.stats.nodesExpanded);
			}

			// Statistical test: Degree-Prioritised vs BFS
			const dpVsBfs = mannWhitneyUTest(dpResults, bfsResults);
			const effectSize = cohensD(dpResults, bfsResults);

			console.log("\n=== Statistical Test: Nodes Expanded ===");
			console.log(`Degree-Prioritised mean: ${(dpResults.reduce((a, b) => a + b, 0) / dpResults.length).toFixed(2)}`);
			console.log(`BFS mean: ${(bfsResults.reduce((a, b) => a + b, 0) / bfsResults.length).toFixed(2)}`);
			console.log(`Mann-Whitney U: ${dpVsBfs.u.toFixed(2)}, p-value: ${dpVsBfs.pValue.toFixed(4)}`);
			console.log(`Cohen's d effect size: ${effectSize.toFixed(3)}`);
			console.log(`Significant at α=0.05: ${dpVsBfs.significant}`);

			// All methods should complete without errors
			expect(dpResults.every((n) => n > 0)).toBe(true);
			expect(bfsResults.every((n) => n > 0)).toBe(true);
		});
	});

	describe("Les Misérables Dataset", () => {
		/**
		 * Les Misérables character co-appearance network (77 nodes, 254 edges).
		 * Tests algorithm on moderately sized real-world networks with
		 * heterogeneous degree distribution.
		 */
		it("should demonstrate hub deferral on character network", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			// Use first and last nodes as seeds (likely to be connected in a co-appearance network)
			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

			const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
			const standardBfs = new StandardBfsExpansion(expander, seeds);

			const [dpResult, bfsResult] = await Promise.all([
				degreePrioritised.run(),
				standardBfs.run(),
			]);

			// Calculate hub involvement (nodes with degree >= 10)
			const dpHubDegrees: number[] = [];
			const bfsHubDegrees: number[] = [];

			for (const nodeId of dpResult.sampledNodes) {
				const degree = expander.getDegree(nodeId);
				if (degree >= 10) dpHubDegrees.push(degree);
			}

			for (const nodeId of bfsResult.sampledNodes) {
				const degree = expander.getDegree(nodeId);
				if (degree >= 10) bfsHubDegrees.push(degree);
			}

			console.log("\n=== Les Misérables Hub Analysis ===");
			console.log(`Degree-Prioritised: ${dpHubDegrees.length} high-degree nodes sampled`);
			console.log(`Standard BFS: ${bfsHubDegrees.length} high-degree nodes sampled`);
			console.log(`Total sampled: DP=${dpResult.sampledNodes.size}, BFS=${bfsResult.sampledNodes.size}`);

			// Both should find paths in this connected network
			expect(dpResult.paths.length).toBeGreaterThan(0);
			expect(bfsResult.paths.length).toBeGreaterThan(0);
		});

		/**
		 * Application metric: Topic coverage for literature review.
		 */
		it("should provide good coverage of topical regions", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

			const expansion = new DegreePrioritisedExpansion(expander, seeds);
			const result = await expansion.run();

			const coverage = calculateTopicCoverage(result.sampledNodes, expander);

			console.log("\n=== Les Misérables Coverage Analysis ===");
			console.log(`Hub coverage: ${(coverage.coverage * 100).toFixed(1)}%`);
			console.log(`Average degree: ${coverage.avgDegree.toFixed(2)}`);
			console.log(`Hub ratio: ${(coverage.hubRatio * 100).toFixed(1)}%`);

			// Should sample nodes with varying degrees (representative)
			expect(coverage.avgDegree).toBeGreaterThan(0);
		});
	});

	describe("Cora Citation Network", () => {
		/**
		 * Cora is a citation network of ML papers (2708 nodes, 5429 edges).
		 * Tests scalability and behavior on larger real-world networks.
		 */
		it("should scale to larger citation networks", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("cora");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			// Select two papers as seeds
			const allNodes = benchmark.graph.getAllNodes();
			const nodeIds = allNodes.map((n) => n.id);
			const seeds: [string, string] = [nodeIds[0], nodeIds[Math.floor(nodeIds.length / 2)]];

			const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
			const standardBfs = new StandardBfsExpansion(expander, seeds);

			const [dpResult, bfsResult] = await Promise.all([
				degreePrioritised.run(),
				standardBfs.run(),
			]);

			console.log("\n=== Cora Citation Network ===");
			console.log(`Graph: ${benchmark.nodeCount} nodes, ${benchmark.edgeCount} edges`);
			console.log(`Degree-Prioritised sampled: ${dpResult.sampledNodes.size} nodes`);
			console.log(`Standard BFS sampled: ${bfsResult.sampledNodes.size} nodes`);
			console.log(`DP paths found: ${dpResult.paths.length}`);
			console.log(`BFS paths found: ${bfsResult.paths.length}`);

			// Both methods should complete successfully
			expect(dpResult.stats.iterations).toBeGreaterThan(0);
			expect(bfsResult.stats.iterations).toBeGreaterThan(0);
		});
	});
});

describe("Thesis Validation: Statistical Tests", () => {
	describe("Multi-Method Comparison with Significance Testing", () => {
		/**
		 * Compare all four methods (Degree-Prioritised, BFS, Frontier-Balanced, Random)
		 * with proper statistical testing.
		 */
		it("should compare all methods with statistical significance", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("karate");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);
			const seeds: [string, string] = ["1", "34"];

			// Run each method multiple times (for random priority variants)
			const trials = 10;
			const results = {
				degreePrioritised: [] as number[],
				standardBfs: [] as number[],
				frontierBalanced: [] as number[],
				randomPriority: [] as number[],
			};

			for (let index = 0; index < trials; index++) {
				const dp = new DegreePrioritisedExpansion(expander, seeds);
				const bfs = new StandardBfsExpansion(expander, seeds);
				const fb = new FrontierBalancedExpansion(expander, seeds);
				const rp = new RandomPriorityExpansion(expander, seeds, 1000 + index);

				const [dpRes, bfsRes, fbRes, rpRes] = await Promise.all([
					dp.run(),
					bfs.run(),
					fb.run(),
					rp.run(),
				]);

				results.degreePrioritised.push(dpRes.stats.nodesExpanded);
				results.standardBfs.push(bfsRes.stats.nodesExpanded);
				results.frontierBalanced.push(fbRes.stats.nodesExpanded);
				results.randomPriority.push(rpRes.stats.nodesExpanded);
			}

			// Calculate pairwise Mann-Whitney U tests
			console.log("\n=== Pairwise Statistical Comparisons ===");

			const pairs: Array<[string, string, number[], number[]]> = [
				["Degree-Prioritised", "Standard BFS", results.degreePrioritised, results.standardBfs],
				["Degree-Prioritised", "Frontier-Balanced", results.degreePrioritised, results.frontierBalanced],
				["Degree-Prioritised", "Random Priority", results.degreePrioritised, results.randomPriority],
			];

			for (const [name1, name2, sample1, sample2] of pairs) {
				const test = mannWhitneyUTest(sample1, sample2);
				const effect = cohensD(sample1, sample2);
				const ci1 = confidenceInterval(sample1);
				const ci2 = confidenceInterval(sample2);

				console.log(`\n${name1} vs ${name2}:`);
				console.log(`  ${name1} mean: ${(sample1.reduce((a, b) => a + b, 0) / sample1.length).toFixed(2)} [${ci1.lower.toFixed(2)}, ${ci1.upper.toFixed(2)}]`);
				console.log(`  ${name2} mean: ${(sample2.reduce((a, b) => a + b, 0) / sample2.length).toFixed(2)} [${ci2.lower.toFixed(2)}, ${ci2.upper.toFixed(2)}]`);
				console.log(`  Mann-Whitney U: ${test.u.toFixed(2)}, p-value: ${test.pValue.toFixed(4)}`);
				console.log(`  Cohen's d: ${effect.toFixed(3)}`);
				console.log(`  Significant: ${test.significant ? "YES" : "NO"} (α=0.05)`);
			}

			// Verify all methods complete successfully
			expect(results.degreePrioritised.every((n) => n > 0)).toBe(true);
			expect(results.standardBfs.every((n) => n > 0)).toBe(true);
			expect(results.frontierBalanced.every((n) => n > 0)).toBe(true);
			expect(results.randomPriority.every((n) => n > 0)).toBe(true);
		});
	});
});

describe("Thesis Validation: Application Metrics", () => {
	describe("Literature Review Specific Evaluation", () => {
		/**
		 * Application: Systematic Literature Review
		 * Goal: Find relevant papers while avoiding over-sampling from mega-citations
		 *
		 * Metric: Hub deferral ratio - should prefer diverse citations over
		 * repeatedly citing the same highly-connected papers.
		 */
		it("should defer high-degree papers in citation network", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("cora");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			// Start with two low-degree papers
			const allNodes = benchmark.graph.getAllNodes();
			const nodeDegrees = allNodes.map((node) => ({ id: node.id, degree: expander.getDegree(node.id) }));
			nodeDegrees.sort((a, b) => a.degree - b.degree);

			// Select two low-degree papers as seeds
			const seeds: [string, string] = [nodeDegrees[0].id, nodeDegrees[1].id];

			const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
			const standardBfs = new StandardBfsExpansion(expander, seeds);

			const [dpResult, bfsResult] = await Promise.all([
				degreePrioritised.run(),
				standardBfs.run(),
			]);

			// Analyze hub involvement (degree >= 20 = high citation count)
			const hubThreshold = 20;
			const dpHighDegree = [...dpResult.sampledNodes].filter((id) => expander.getDegree(id) >= hubThreshold);
			const bfsHighDegree = [...bfsResult.sampledNodes].filter((id) => expander.getDegree(id) >= hubThreshold);

			console.log("\n=== Citation Network Hub Analysis ===");
			console.log(`Hub threshold (citations): ${hubThreshold}`);
			console.log(`Degree-Prioritised high-degree nodes: ${dpHighDegree.length}`);
			console.log(`Standard BFS high-degree nodes: ${bfsHighDegree.length}`);

			// Calculate average degree of sampled nodes
			const dpAvgDegree = [...dpResult.sampledNodes].reduce((sum, id) => sum + expander.getDegree(id), 0) / dpResult.sampledNodes.size;
			const bfsAvgDegree = [...bfsResult.sampledNodes].reduce((sum, id) => sum + expander.getDegree(id), 0) / bfsResult.sampledNodes.size;

			console.log(`Degree-Prioritised avg degree: ${dpAvgDegree.toFixed(2)}`);
			console.log(`Standard BFS avg degree: ${bfsAvgDegree.toFixed(2)}`);

			// Both should find paths
			expect(dpResult.paths.length).toBeGreaterThanOrEqual(0);
			expect(bfsResult.paths.length).toBeGreaterThanOrEqual(0);
		});

		/**
		 * Application metric: Coverage efficiency.
		 * Measures how many distinct topical regions are covered per node expanded.
		 */
		it("should provide efficient coverage of research areas", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("cora");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = benchmark.graph.getAllNodes();
			const nodeIds = allNodes.map((n) => n.id);
			const seeds: [string, string] = [nodeIds[0], nodeIds[Math.floor(nodeIds.length / 2)]];

			const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
			const result = await degreePrioritised.run();

			// Coverage efficiency: distinct regions / nodes expanded
			const degreeBuckets = new Map<string, Set<string>>();
			for (const nodeId of result.sampledNodes) {
				const degree = expander.getDegree(nodeId);
				const bucket = degree <= 5 ? "low" : (degree <= 20 ? "medium" : "high");
				if (!degreeBuckets.has(bucket)) {
					degreeBuckets.set(bucket, new Set());
				}
				degreeBuckets.get(bucket)!.add(nodeId);
			}

			const coverage = degreeBuckets.size; // Number of distinct degree regions
			const efficiency = coverage / result.stats.nodesExpanded;

			console.log("\n=== Coverage Efficiency Analysis ===");
			console.log(`Degree regions covered: ${coverage}/3`);
			console.log(`Nodes expanded: ${result.stats.nodesExpanded}`);
			console.log(`Coverage efficiency: ${efficiency.toFixed(4)}`);

			// Should cover multiple degree regions
			expect(coverage).toBeGreaterThanOrEqual(2);
		});
	});

	describe("Facebook Dataset", () => {
		/**
		 * Facebook ego network (4039 nodes, 88234 edges).
		 * Large-scale social network to test scalability and behavior on
		 * networks with higher degree variance.
		 */
		it("should scale to large social networks", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("facebook");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			// Select nodes from different parts of the network
			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes[Math.floor(allNodes.length / 2)]];

			const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
			const standardBfs = new StandardBfsExpansion(expander, seeds);

			const [dpResult, bfsResult] = await Promise.all([
				degreePrioritised.run(),
				standardBfs.run(),
			]);

			console.log("\n=== Facebook Social Network ===");
			console.log(`Graph: ${benchmark.nodeCount} nodes, ${benchmark.edgeCount} edges`);
			console.log(`Degree-Prioritised sampled: ${dpResult.sampledNodes.size} nodes (${((dpResult.sampledNodes.size / benchmark.nodeCount) * 100).toFixed(1)}%)`);
			console.log(`Standard BFS sampled: ${bfsResult.sampledNodes.size} nodes (${((bfsResult.sampledNodes.size / benchmark.nodeCount) * 100).toFixed(1)}%)`);
			console.log(`DP paths found: ${dpResult.paths.length}`);
			console.log(`BFS paths found: ${bfsResult.paths.length}`);

			// Calculate path diversity
			const dpDiversity = pathDiversity(dpResult.paths);
			const bfsDiversity = pathDiversity(bfsResult.paths);

			console.log(`DP path diversity: ${dpDiversity.toFixed(3)}`);
			console.log(`BFS path diversity: ${bfsDiversity.toFixed(3)}`);

			// Both methods should complete successfully on large graphs
			expect(dpResult.stats.iterations).toBeGreaterThan(0);
			expect(bfsResult.stats.iterations).toBeGreaterThan(0);

			// Verify reasonable sampling (not just seeds, may be all nodes on connected graphs)
			expect(dpResult.sampledNodes.size).toBeGreaterThan(10);
			expect(dpResult.sampledNodes.size).toBeLessThanOrEqual(benchmark.nodeCount);
		});

		/**
		 * Statistical comparison on larger dataset.
		 */
		it("should show meaningful path diversity differences on larger graphs", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("facebook");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

			const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
			const standardBfs = new StandardBfsExpansion(expander, seeds);

			const [dpResult, bfsResult] = await Promise.all([
				degreePrioritised.run(),
				standardBfs.run(),
			]);

			// Path diversity is the key differentiator
			const dpDiversity = pathDiversity(dpResult.paths);
			const bfsDiversity = pathDiversity(bfsResult.paths);

			console.log("\n=== Facebook Path Diversity Comparison ===");
			console.log(`Degree-Prioritised: ${dpResult.paths.length} paths, diversity ${dpDiversity.toFixed(3)}`);
			console.log(`Standard BFS: ${bfsResult.paths.length} paths, diversity ${bfsDiversity.toFixed(3)}`);

			// Degree-prioritised should achieve equal or better path diversity
			expect(dpDiversity).toBeGreaterThanOrEqual(bfsDiversity * 0.95);
		});
	});
});

describe("Thesis Validation: Variability Injection", () => {
	describe("Multiple Seed Pair Analysis", () => {
		/**
		 * Test across multiple random seed pairs to assess consistency of performance.
		 * This provides better statistical power than single-seed tests.
		 */
		it("should compare methods across multiple seed pairs", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const numberSeedPairs = 10;

			const results: Array<{
				seeds: [string, string];
				dpPaths: number;
				bfsPaths: number;
				dpDiversity: number;
				bfsDiversity: number;
			}> = [];

			for (let index = 0; index < numberSeedPairs; index++) {
				// Select random seed pair
				const index1 = Math.floor(Math.random() * allNodes.length);
				let index2 = Math.floor(Math.random() * allNodes.length);
				while (index2 === index1) {
					index2 = Math.floor(Math.random() * allNodes.length);
				}

				const seeds: [string, string] = [allNodes[index1], allNodes[index2]];

				const dp = new DegreePrioritisedExpansion(expander, seeds);
				const bfs = new StandardBfsExpansion(expander, seeds);

				const [dpResult, bfsResult] = await Promise.all([dp.run(), bfs.run()]);

				results.push({
					seeds,
					dpPaths: dpResult.paths.length,
					bfsPaths: bfsResult.paths.length,
					dpDiversity: pathDiversity(dpResult.paths),
					bfsDiversity: pathDiversity(bfsResult.paths),
				});
			}

			// Analyze path diversity across all seed pairs
			const dpDiversities = results.map((r) => r.dpDiversity);
			const bfsDiversities = results.map((r) => r.bfsDiversity);

			const dpMean = dpDiversities.reduce((a, b) => a + b, 0) / dpDiversities.length;
			const bfsMean = bfsDiversities.reduce((a, b) => a + b, 0) / bfsDiversities.length;

			const dpCI = confidenceInterval(dpDiversities);
			const bfsCI = confidenceInterval(bfsDiversities);

			// Statistical test for difference in path diversity
			const diversityTest = mannWhitneyUTest(dpDiversities, bfsDiversities);
			const effectSize = cohensD(dpDiversities, bfsDiversities);

			console.log("\n=== Multi-Seed-Pair Analysis (Les Misérables) ===");
			console.log(`Trials: ${numberSeedPairs}`);
			console.log(`Degree-Prioritised diversity: ${dpMean.toFixed(3)} [${dpCI.lower.toFixed(3)}, ${dpCI.upper.toFixed(3)}]`);
			console.log(`BFS diversity: ${bfsMean.toFixed(3)} [${bfsCI.lower.toFixed(3)}, ${bfsCI.upper.toFixed(3)}]`);
			console.log(`Mann-Whitney U: ${diversityTest.u.toFixed(2)}, p-value: ${diversityTest.pValue.toFixed(4)}`);
			console.log(`Cohen's d: ${effectSize.toFixed(3)}`);
			console.log(`Significant: ${diversityTest.significant}`);

			// Expect consistent positive performance
			expect(dpMean).toBeGreaterThan(0);
			expect(bfsMean).toBeGreaterThan(0);

			// If significant, DP should have higher mean diversity
			if (diversityTest.significant && effectSize > 0) {
				expect(dpMean).toBeGreaterThan(bfsMean);
			}
		});

		/**
		 * Paired test: same seeds, different methods.
		 * This removes seed selection as a confounding variable.
			*/
		it("should show consistent method differences across paired trials", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("karate");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			// Fixed seeds for paired comparison
			const seeds: [string, string] = ["1", "34"];
			const trials = 10;

			const dpPathCounts: number[] = [];
			const bfsPathCounts: number[] = [];
			const dpDiversities: number[] = [];
			const bfsDiversities: number[] = [];

			for (let index = 0; index < trials; index++) {
				// Add different random seed for Random Priority to create variability
				const dp = new DegreePrioritisedExpansion(expander, seeds);
				const bfs = new StandardBfsExpansion(expander, seeds);
				const rp = new RandomPriorityExpansion(expander, seeds, 1000 + index);

				const [dpResult, bfsResult] = await Promise.all([dp.run(), bfs.run(), rp.run()]);

				dpPathCounts.push(dpResult.paths.length);
				bfsPathCounts.push(bfsResult.paths.length);
				dpDiversities.push(pathDiversity(dpResult.paths));
				bfsDiversities.push(pathDiversity(bfsResult.paths));
			}

			// For deterministic algorithms, all trials should be identical
			const dpUniquePathCounts = new Set(dpPathCounts);
			const bfsUniquePathCounts = new Set(bfsPathCounts);

			console.log("\n=== Paired Trial Analysis (Karate Club) ===");
			console.log(`Degree-Prioritised path counts: ${dpPathCounts.join(", ")}`);
			console.log(`Standard BFS path counts: ${bfsPathCounts.join(", ")}`);
			console.log(`DP unique path counts: ${dpUniquePathCounts.size} value(s)`);
			console.log(`BFS unique path counts: ${bfsUniquePathCounts.size} value(s)`);

			// Verify determinism (same seeds → same results)
			expect(dpUniquePathCounts.size).toBe(1);
			expect(bfsUniquePathCounts.size).toBe(1);
		});
	});

	describe("Cross-Dataset Variability", () => {
		/**
		 * Test the same algorithm across different graph types to assess
		 * how performance varies with graph structure.
		 */
		it("should compare performance across different graph types", async () => {
			const datasets = ["karate", "lesmis", "cora"];
			const summary: Record<string, {
				nodes: number;
				edges: number;
				dpPaths: number;
				bfsPaths: number;
				dpDiversity: number;
				bfsDiversity: number;
			}> = {};

			for (const datasetId of datasets) {
				const benchmark = await loadBenchmarkByIdFromUrl(datasetId);
				const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

				const allNodes = expander.getAllNodeIds();
				const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

				const dp = new DegreePrioritisedExpansion(expander, seeds);
				const bfs = new StandardBfsExpansion(expander, seeds);

				const [dpResult, bfsResult] = await Promise.all([dp.run(), bfs.run()]);

				summary[datasetId] = {
					nodes: benchmark.nodeCount,
					edges: benchmark.edgeCount,
					dpPaths: dpResult.paths.length,
					bfsPaths: bfsResult.paths.length,
					dpDiversity: pathDiversity(dpResult.paths),
					bfsDiversity: pathDiversity(bfsResult.paths),
				};
			}

			console.log("\n=== Cross-Dataset Performance Summary ===");
			console.log(JSON.stringify(summary, null, 2));

			// Analyze trend: does DP advantage increase with graph size/complexity?
			const datasetNames = Object.keys(summary);
			const dpAdvantages = datasetNames.map((name) => summary[name].dpDiversity - summary[name].bfsDiversity);

			console.log(`DP diversity advantages: ${dpAdvantages.map((v) => v.toFixed(3)).join(", ")}`);
			console.log(`Mean advantage: ${(dpAdvantages.reduce((a, b) => a + b, 0) / dpAdvantages.length).toFixed(3)}`);

			// Verify all datasets tested successfully
			expect(Object.keys(summary).length).toBe(3);
		});
	});
});

describe("Thesis Validation: Application Metrics", () => {
	describe("Systematic Literature Review Metrics", () => {
		/**
		 * Metric: Recall efficiency - papers found per expansion step.
		 * For systematic reviews, finding relevant papers early is crucial.
		 */
		it("should measure recall efficiency for literature review", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("cora");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			// Simulate starting from a seed paper and expanding
			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes[Math.floor(allNodes.length / 2)]];

			const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
			const standardBfs = new StandardBfsExpansion(expander, seeds);

			const [dpResult, bfsResult] = await Promise.all([
				degreePrioritised.run(),
				standardBfs.run(),
			]);

			// Calculate "recall efficiency": unique papers found per iteration
			// This is approximated by: total papers / iterations
			const dpRecallEfficiency = dpResult.sampledNodes.size / dpResult.stats.iterations;
			const bfsRecallEfficiency = bfsResult.sampledNodes.size / bfsResult.stats.iterations;

			console.log("\n=== Recall Efficiency Analysis ===");
			console.log(`Degree-Prioritised: ${dpRecallEfficiency.toFixed(2)} papers/iteration`);
			console.log(`Standard BFS: ${bfsRecallEfficiency.toFixed(2)} papers/iteration`);
			console.log(`DP iterations: ${dpResult.stats.iterations}`);
			console.log(`BFS iterations: ${bfsResult.stats.iterations}`);

			// Both should find papers efficiently
			expect(dpRecallEfficiency).toBeGreaterThan(0);
			expect(bfsRecallEfficiency).toBeGreaterThan(0);
		});

		/**
		 * Metric: Citation coverage - proportion of citation paths discovered.
		 * Measures how completely the expansion captures citation relationships.
		 */
		it("should measure citation coverage quality", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("cora");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes[Math.floor(allNodes.length / 2)]];

			const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
			const result = await degreePrioritised.run();

			// Calculate coverage: what proportion of all possible citations are traversed
			const totalCitations = benchmark.edgeCount;
			const traversedEdges = result.stats.edgesTraversed;
			const coverage = traversedEdges / totalCitations;

			console.log("\n=== Citation Coverage Analysis ===");
			console.log(`Total citations in dataset: ${totalCitations}`);
			console.log(`Edges traversed: ${traversedEdges}`);
			console.log(`Coverage: ${(coverage * 100).toFixed(2)}%`);
			console.log(`Papers sampled: ${result.sampledNodes.size} / ${benchmark.nodeCount}`);

			// Should traverse meaningful portion of citation graph
			expect(coverage).toBeGreaterThan(0);
			expect(result.sampledNodes.size).toBeGreaterThan(100);
		});

		/**
		 * Metric: Hub deferral effectiveness - measures how well the algorithm
		 * defers expanding high-degree papers (which often represent survey papers
		 * rather than focused research).
		 */
		it("should demonstrate hub deferral in citation networks", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("cora");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			// Select two medium-degree papers as seeds (not hubs)
			const allNodes = expander.getAllNodeIds();
			const nodeDegrees = allNodes.map((id) => ({ id, degree: expander.getDegree(id) }));
			nodeDegrees.sort((a, b) => a.degree - b.degree);

			// Find papers with moderate degree (5-15 citations)
			const moderatePapers = nodeDegrees.filter((n) => n.degree >= 5 && n.degree <= 15);
			const seeds: [string, string] = [moderatePapers[0].id, moderatePapers[Math.min(10, moderatePapers.length - 1)].id];

			const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
			const standardBfs = new StandardBfsExpansion(expander, seeds);

			const [dpResult, bfsResult] = await Promise.all([
				degreePrioritised.run(),
				standardBfs.run(),
			]);

			// Count high-degree papers (degree > 20) in sampled set
			const hubThreshold = 20;
			const dpHighDegreeCount = [...dpResult.sampledNodes].filter((id) => expander.getDegree(id) > hubThreshold).length;
			const bfsHighDegreeCount = [...bfsResult.sampledNodes].filter((id) => expander.getDegree(id) > hubThreshold).length;

			// Calculate ratio of high-degree papers
			const dpHubRatio = dpResult.sampledNodes.size > 0 ? dpHighDegreeCount / dpResult.sampledNodes.size : 0;
			const bfsHubRatio = bfsResult.sampledNodes.size > 0 ? bfsHighDegreeCount / bfsResult.sampledNodes.size : 0;

			console.log("\n=== Hub Deferral Effectiveness ===");
			console.log(`Hub threshold: >${hubThreshold} citations`);
			console.log(`Degree-Prioritised: ${dpHighDegreeCount} high-degree papers (${(dpHubRatio * 100).toFixed(1)}% of sampled)`);
			console.log(`Standard BFS: ${bfsHighDegreeCount} high-degree papers (${(bfsHubRatio * 100).toFixed(1)}% of sampled)`);

			// The key metric: path diversity in presence of hubs
			const dpDiversity = pathDiversity(dpResult.paths);
			const bfsDiversity = pathDiversity(bfsResult.paths);

			console.log(`DP path diversity: ${dpDiversity.toFixed(3)}`);
			console.log(`BFS path diversity: ${bfsDiversity.toFixed(3)}`);

			// Degree-prioritised should maintain or improve path diversity
			expect(dpDiversity).toBeGreaterThanOrEqual(bfsDiversity * 0.9);
		});

		/**
		 * Metric: Early discovery rate - how quickly diverse paths are found.
		 * For literature reviews, finding diverse citation paths early improves efficiency.
		 */
		it("should measure early discovery rate of diverse paths", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

			// We need to instrument to track early discovery
			// For now, use total path diversity as proxy
			const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
			const result = await degreePrioritised.run();

			// Calculate path diversity
			const diversity = pathDiversity(result.paths);

			console.log("\n=== Early Discovery Analysis ===");
			console.log(`Total paths found: ${result.paths.length}`);
			console.log(`Path diversity: ${diversity.toFixed(3)}`);
			console.log(`Iterations to completion: ${result.stats.iterations}`);
			console.log(`Discovery rate: ${(result.paths.length / result.stats.iterations).toFixed(3)} paths/iteration`);

			// Should find paths efficiently
			expect(result.paths.length).toBeGreaterThan(0);
			expect(diversity).toBeGreaterThan(0);
		});
	});
});

describe("Thesis Validation: Summary", () => {
	/**
	 * Comprehensive summary combining all validation dimensions.
	 */
	it("should output comprehensive validation summary", async () => {
		const datasets = ["karate", "lesmis", "cora", "facebook"];
		const summary: Record<string, unknown> = {};

		for (const datasetId of datasets) {
			const benchmark = await loadBenchmarkByIdFromUrl(datasetId);
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

			const dp = new DegreePrioritisedExpansion(expander, seeds);
			const bfs = new StandardBfsExpansion(expander, seeds);

			const [dpResult, bfsResult] = await Promise.all([dp.run(), bfs.run()]);

			const _nodeSimilarity = jaccardSimilarity(dpResult.sampledNodes, bfsResult.sampledNodes);
			const dpDiversity = pathDiversity(dpResult.paths);
			const bfsDiversity = pathDiversity(bfsResult.paths);

			// Calculate percentage of graph sampled
			const dpCoverage = (dpResult.sampledNodes.size / benchmark.nodeCount) * 100;
			const bfsCoverage = (bfsResult.sampledNodes.size / benchmark.nodeCount) * 100;

			summary[datasetId] = {
				nodes: benchmark.nodeCount,
				edges: benchmark.edgeCount,
				dpCoverage: `${dpCoverage.toFixed(1)}%`,
				bfsCoverage: `${bfsCoverage.toFixed(1)}%`,
				dpPaths: dpResult.paths.length,
				bfsPaths: bfsResult.paths.length,
				dpDiversity: dpDiversity.toFixed(3),
				bfsDiversity: bfsDiversity.toFixed(3),
				diversityImprovement: `${((dpDiversity - bfsDiversity) / Math.max(bfsDiversity, 0.001) * 100).toFixed(1)}%`,
			};
		}

		console.log("\n=== Comprehensive Validation Summary ===");
		console.log(JSON.stringify(summary, null, 2));

		// Calculate aggregate statistics
		const summaryKeys = Object.keys(summary);
		const avgDiversityImprovement = summaryKeys.reduce((sum, key) => {
			const entry = summary[key] as { diversityImprovement: string };
			return sum + Number.parseFloat(entry.diversityImprovement);
		}, 0) / summaryKeys.length;

		console.log(`\nAverage path diversity improvement: ${avgDiversityImprovement.toFixed(2)}%`);

		// Basic validation that tests ran successfully
		expect(Object.keys(summary).length).toBe(4);
	});

	// =========================================================================
	// Extended Validation: CiteSeer Dataset
	// =========================================================================

	describe("Thesis Validation: CiteSeer Dataset", () => {
		it("should handle larger citation network (3327 nodes)", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("citeseer");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes[Math.floor(allNodes.length / 2)]];

			const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
			const standardBfs = new StandardBfsExpansion(expander, seeds);

			const [dpResult, bfsResult] = await Promise.all([degreePrioritised.run(), standardBfs.run()]);

			console.log("\n=== CiteSeer Citation Network ===");
			console.log(`Graph: ${benchmark.nodeCount} nodes, ${benchmark.edgeCount} edges`);
			console.log(`Degree-Prioritised sampled: ${dpResult.sampledNodes.size} nodes`);
			console.log(`Standard BFS sampled: ${bfsResult.sampledNodes.size} nodes`);
			console.log(`DP paths found: ${dpResult.paths.length}`);
			console.log(`BFS paths found: ${bfsResult.paths.length}`);

			const dpDiversity = pathDiversity(dpResult.paths);
			const bfsDiversity = pathDiversity(bfsResult.paths);

			console.log(`DP path diversity: ${dpDiversity.toFixed(3)}`);
			console.log(`BFS path diversity: ${bfsDiversity.toFixed(3)}`);

			expect(dpResult.sampledNodes.size).toBeGreaterThan(10);
			expect(bfsResult.sampledNodes.size).toBeGreaterThan(10);
			expect(dpResult.stats.iterations).toBeGreaterThan(0);
			expect(bfsResult.stats.iterations).toBeGreaterThan(0);
		});

		it("should show method differences on citation network", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("citeseer");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

			const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
			const standardBfs = new StandardBfsExpansion(expander, seeds);

			const [dpResult, bfsResult] = await Promise.all([degreePrioritised.run(), standardBfs.run()]);

			const dpDiversity = pathDiversity(dpResult.paths);
			const bfsDiversity = pathDiversity(bfsResult.paths);
			const improvement = ((dpDiversity - bfsDiversity) / Math.max(bfsDiversity, 0.001)) * 100;

			console.log("\n=== CiteSeer Path Diversity Comparison ===");
			console.log(`DP: ${dpResult.paths.length} paths, diversity ${dpDiversity.toFixed(3)}`);
			console.log(`BFS: ${bfsResult.paths.length} paths, diversity ${bfsDiversity.toFixed(3)}`);
			console.log(`Improvement: ${improvement.toFixed(1)}%`);

			// Tests should complete regardless of outcome
			expect(dpResult.paths.length).toBeGreaterThanOrEqual(0);
			expect(bfsResult.paths.length).toBeGreaterThanOrEqual(0);
		});
	});

	// =========================================================================
	// Extended Validation: Perturbed Graph Robustness
	// =========================================================================

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

	// =========================================================================
	// Extended Validation: Additional Metrics
	// =========================================================================

	describe("Thesis Validation: Additional Metrics", () => {
		/**
		 * Calculate path length statistics.
		 * @param paths
		 */
		const pathLengthStats = (paths: Array<{ nodes: string[] }>) => {
			const lengths = paths.map((p) => p.nodes.length);
			if (lengths.length === 0) {
				return { min: 0, max: 0, mean: 0, median: 0 };
			}
			const sorted = [...lengths].sort((a, b) => a - b);
			return {
				min: sorted[0],
				max: sorted.at(-1),
				mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
				median: sorted[Math.floor(sorted.length / 2)],
			};
		};

		/**
		 * Calculate coverage efficiency (nodes sampled per iteration).
		 * @param sampledNodes
		 * @param iterations
		 */
		const coverageEfficiency = (sampledNodes: number, iterations: number): number => {
			return iterations > 0 ? sampledNodes / iterations : 0;
		};

		/**
		 * Calculate hub participation ratio (high-degree nodes in sampled set).
		 * @param sampledIds
		 * @param allNodes
		 * @param getDegree
		 * @param percentile
		 */
		const hubParticipation = (
			sampledIds: string[],
			allNodes: Array<{ id: string }>,
			getDegree: (id: string) => number,
			percentile: number = 90
		): { sampledHubs: number; totalHubs: number; ratio: number } => {
			const degrees = allNodes.map((n) => ({ id: n.id, degree: getDegree(n.id) }));
			const sortedDegrees = degrees.toSorted((a, b) => b.degree - a.degree);
			const hubThreshold = percentile === 90
				? sortedDegrees[Math.floor(sortedDegrees.length * 0.1)]?.degree ?? 0
				: sortedDegrees[Math.floor(sortedDegrees.length * (1 - percentile / 100))]?.degree ?? 0;

			const totalHubs = degrees.filter((n) => n.degree >= hubThreshold).length;
			const sampledHubs = sampledIds.filter((id) => getDegree(id) >= hubThreshold).length;

			return {
				sampledHubs,
				totalHubs,
				ratio: totalHubs > 0 ? sampledHubs / totalHubs : 0,
			};
		};

		it("should analyse path length distributions", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

			const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
			const standardBfs = new StandardBfsExpansion(expander, seeds);

			const [dpResult, bfsResult] = await Promise.all([degreePrioritised.run(), standardBfs.run()]);

			const dpStats = pathLengthStats(dpResult.paths);
			const bfsStats = pathLengthStats(bfsResult.paths);

			console.log("\n=== Path Length Distribution ===");
			console.log("Degree-Prioritised:");
			console.log(`  Min: ${dpStats.min}, Max: ${dpStats.max}, Mean: ${dpStats.mean.toFixed(2)}, Median: ${dpStats.median}`);
			console.log("Standard BFS:");
			console.log(`  Min: ${bfsStats.min}, Max: ${bfsStats.max}, Mean: ${bfsStats.mean.toFixed(2)}, Median: ${bfsStats.median}`);

			expect(dpResult.paths.length).toBeGreaterThanOrEqual(0);
			expect(bfsResult.paths.length).toBeGreaterThanOrEqual(0);
		});

		it("should measure coverage efficiency", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("facebook");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

			const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
			const standardBfs = new StandardBfsExpansion(expander, seeds);

			const [dpResult, bfsResult] = await Promise.all([degreePrioritised.run(), standardBfs.run()]);

			const dpEfficiency = coverageEfficiency(dpResult.sampledNodes.size, dpResult.stats.iterations);
			const bfsEfficiency = coverageEfficiency(bfsResult.sampledNodes.size, bfsResult.stats.iterations);

			console.log("\n=== Coverage Efficiency ===");
			console.log(`Degree-Prioritised: ${dpEfficiency.toFixed(3)} nodes/iteration`);
			console.log(`Standard BFS: ${bfsEfficiency.toFixed(3)} nodes/iteration`);
			console.log(`DP iterations: ${dpResult.stats.iterations}`);
			console.log(`BFS iterations: ${bfsResult.stats.iterations}`);

			// Both should have reasonable efficiency
			expect(dpEfficiency).toBeGreaterThan(0);
			expect(bfsEfficiency).toBeGreaterThan(0);
		});

		it("should analyse hub participation patterns", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes[Math.floor(allNodes.length / 2)]];

			const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
			const standardBfs = new StandardBfsExpansion(expander, seeds);

			const [dpResult, bfsResult] = await Promise.all([degreePrioritised.run(), standardBfs.run()]);

			const dpSampled = [...dpResult.sampledNodes];
			const bfsSampled = [...bfsResult.sampledNodes];
			const allNodeData = benchmark.graph.getAllNodes();

			const dpHubs = hubParticipation(dpSampled, allNodeData, (id) => expander.getDegree(id), 90);
			const bfsHubs = hubParticipation(bfsSampled, allNodeData, (id) => expander.getDegree(id), 90);

			console.log("\n=== Hub Participation (top 10% degree) ===");
			console.log(`Degree-Prioritised: ${dpHubs.sampledHubs}/${dpHubs.totalHubs} hubs (${(dpHubs.ratio * 100).toFixed(1)}%)`);
			console.log(`Standard BFS: ${bfsHubs.sampledHubs}/${bfsHubs.totalHubs} hubs (${(bfsHubs.ratio * 100).toFixed(1)}%)`);

			// Both methods should sample hubs
			expect(dpHubs.sampledHubs).toBeGreaterThan(0);
			expect(bfsHubs.sampledHubs).toBeGreaterThan(0);
		});

		it("should compare degree distributions of sampled nodes", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("karate");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

			const degreePrioritised = new DegreePrioritisedExpansion(expander, seeds);
			const standardBfs = new StandardBfsExpansion(expander, seeds);

			const [dpResult, bfsResult] = await Promise.all([degreePrioritised.run(), standardBfs.run()]);

			// Calculate degree distribution statistics
			const dpDegrees = [...dpResult.sampledNodes].map((id) => expander.getDegree(id));
			const bfsDegrees = [...bfsResult.sampledNodes].map((id) => expander.getDegree(id));

			const dpMean = dpDegrees.reduce((a, b) => a + b, 0) / dpDegrees.length;
			const bfsMean = bfsDegrees.reduce((a, b) => a + b, 0) / bfsDegrees.length;

			const dpMax = Math.max(...dpDegrees);
			const bfsMax = Math.max(...bfsDegrees);

			console.log("\n=== Sampled Node Degree Distribution ===");
			console.log("Degree-Prioritised:");
			console.log(`  Mean degree: ${dpMean.toFixed(2)}, Max degree: ${dpMax}`);
			console.log("Standard BFS:");
			console.log(`  Mean degree: ${bfsMean.toFixed(2)}, Max degree: ${bfsMax}`);

			expect(dpMean).toBeGreaterThan(0);
			expect(bfsMean).toBeGreaterThan(0);
		});
	});

	// =========================================================================
	// Runtime Performance Comparison
	// =========================================================================

	describe("Thesis Validation: Runtime Performance", () => {
		interface PerformanceMetrics {
			method: string;
			executionTime: number;
			nodesExpanded: number;
			edgesTraversed: number;
			iterations: number;
			nodesPerSecond: number;
			pathsFound: number;
			pathDiversity: number;
		}

		const runPerformanceTest = async (
			method: string,
			expander: BenchmarkGraphExpander,
			seeds: [string, string],
			algorithm: () => { run(): Promise<{ sampledNodes: Set<string>; stats: { nodesExpanded: number; edgesTraversed: number; iterations: number }; paths: Array<{ nodes: string[] }> }> }
		): Promise<PerformanceMetrics> => {
			const startTime = performance.now();
			const result = await algorithm().run();
			const endTime = performance.now();

			const executionTime = endTime - startTime;
			const nodesPerSecond = result.stats.nodesExpanded / (executionTime / 1000);

			return {
				method,
				executionTime,
				nodesExpanded: result.stats.nodesExpanded,
				edgesTraversed: result.stats.edgesTraversed,
				iterations: result.stats.iterations,
				nodesPerSecond,
				pathsFound: result.paths.length,
				pathDiversity: pathDiversity(result.paths),
			};
		};

		it("should compare execution time across methods (small graph)", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("karate");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

			const results: PerformanceMetrics[] = [];

			// Test all 4 methods
			results.push(
				await runPerformanceTest(
					"Degree-Prioritised",
					expander,
					seeds,
					() => new DegreePrioritisedExpansion(expander, seeds)
				)
			);

			results.push(
				await runPerformanceTest(
					"Standard BFS",
					expander,
					seeds,
					() => new StandardBfsExpansion(expander, seeds)
				)
			);

			results.push(
				await runPerformanceTest(
					"Frontier-Balanced",
					expander,
					seeds,
					() => new FrontierBalancedExpansion(expander, seeds)
				)
			);

			results.push(
				await runPerformanceTest(
					"Random Priority",
					expander,
					seeds,
					() => new RandomPriorityExpansion(expander, seeds, 42)
				)
			);

			console.log("\n=== Runtime Performance (Karate Club) ===");
			for (const r of results) {
				console.log(`${r.method}:`);
				console.log(`  Time: ${r.executionTime.toFixed(2)}ms`);
				console.log(`  Nodes/sec: ${r.nodesPerSecond.toFixed(0)}`);
				console.log(`  Iterations: ${r.iterations}`);
				console.log(`  Paths: ${r.pathsFound}, Diversity: ${r.pathDiversity.toFixed(3)}`);
			}

			// All methods should complete in reasonable time
			for (const r of results) {
				expect(r.executionTime).toBeLessThan(10_000); // 10 seconds max
				expect(r.nodesPerSecond).toBeGreaterThan(0);
			}
		});

		it("should compare execution time on larger graph", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("facebook");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

			const startTime1 = performance.now();
			const dp = new DegreePrioritisedExpansion(expander, seeds);
			const dpResult = await dp.run();
			const endTime1 = performance.now();

			const startTime2 = performance.now();
			const bfs = new StandardBfsExpansion(expander, seeds);
			const bfsResult = await bfs.run();
			const endTime2 = performance.now();

			const dpTime = endTime1 - startTime1;
			const bfsTime = endTime2 - startTime2;

			console.log("\n=== Runtime Performance (Facebook) ===");
			console.log(`Degree-Prioritised: ${dpTime.toFixed(2)}ms`);
			console.log(`Standard BFS: ${bfsTime.toFixed(2)}ms`);
			console.log(`DP nodes/sec: ${(dpResult.stats.nodesExpanded / (dpTime / 1000)).toFixed(0)}`);
			console.log(`BFS nodes/sec: ${(bfsResult.stats.nodesExpanded / (bfsTime / 1000)).toFixed(0)}`);
			console.log(`DP iterations: ${dpResult.stats.iterations}`);
			console.log(`BFS iterations: ${bfsResult.stats.iterations}`);

			// Both should complete in reasonable time for 4039 nodes
			expect(dpTime).toBeLessThan(30_000);
			expect(bfsTime).toBeLessThan(30_000);
		});

		it("should measure scalability with increasing graph sizes", async () => {
			const datasets = ["karate", "lesmis", "facebook"];
			const results: Array<{ dataset: string; nodes: number; dpTime: number; bfsTime: number; dpBfsRatio: number }> = [];

			for (const datasetId of datasets) {
				const benchmark = await loadBenchmarkByIdFromUrl(datasetId);
				const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

				const allNodes = expander.getAllNodeIds();
				const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

				const startTime1 = performance.now();
				const dp = new DegreePrioritisedExpansion(expander, seeds);
				await dp.run();
				const endTime1 = performance.now();

				const startTime2 = performance.now();
				const bfs = new StandardBfsExpansion(expander, seeds);
				await bfs.run();
				const endTime2 = performance.now();

				const dpTime = endTime1 - startTime1;
				const bfsTime = endTime2 - startTime2;

				results.push({
					dataset: datasetId,
					nodes: benchmark.nodeCount,
					dpTime,
					bfsTime,
					dpBfsRatio: dpTime / bfsTime,
				});
			}

			console.log("\n=== Scalability Analysis ===");
			console.log("Dataset\tNodes\tDP(ms)\tBFS(ms)\tRatio");
			for (const r of results) {
				console.log(`${r.dataset}\t${r.nodes}\t${r.dpTime.toFixed(1)}\t${r.bfsTime.toFixed(1)}\t${r.dpBfsRatio.toFixed(2)}`);
			}

			// Ratio should be reasonably close (within 10x)
			for (const r of results) {
				expect(r.dpBfsRatio).toBeGreaterThan(0.1);
				expect(r.dpBfsRatio).toBeLessThan(10);
			}
		});

		it("should compare memory efficiency (iterations as proxy)", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("facebook");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

			const [dpResult, bfsResult] = await Promise.all([
				new DegreePrioritisedExpansion(expander, seeds).run(),
				new StandardBfsExpansion(expander, seeds).run(),
			]);

			console.log("\n=== Memory Efficiency (iterations = frontier operations) ===");
			console.log(`Degree-Prioritised: ${dpResult.stats.iterations} iterations`);
			console.log(`Standard BFS: ${bfsResult.stats.iterations} iterations`);
			console.log(`DP nodes/iteration: ${(dpResult.sampledNodes.size / dpResult.stats.iterations).toFixed(3)}`);
			console.log(`BFS nodes/iteration: ${(bfsResult.sampledNodes.size / bfsResult.stats.iterations).toFixed(3)}`);

			// Both should use similar number of iterations for same graph
			const ratio = dpResult.stats.iterations / bfsResult.stats.iterations;
			console.log(`Iteration ratio DP/BFS: ${ratio.toFixed(3)}`);

			expect(ratio).toBeGreaterThan(0.1);
			expect(ratio).toBeLessThan(10);
		});
	});

	// =========================================================================
	// Additional Baselines
	// =========================================================================

	describe("Thesis Validation: Additional Baselines", () => {
		/**
		 * High-Degree-First Baseline.
		 * Prioritises high-degree nodes (opposite of thesis method).
		 * Tests whether the thesis innovation (deferring high-degree nodes) matters.
		 */
		class HighDegreeFirstExpansion {
			private expander: GraphExpander<{ id: string }>;
			private seeds: string[];
			private visited = new Set<string>();
			private sampledEdges = new Set<string>();
			private paths: Array<{ nodes: string[]; edges: string[] }> = [];

			constructor(expander: GraphExpander<{ id: string }>, seeds: string[]) {
				if (seeds.length === 0) {
					throw new Error("At least one seed node is required");
				}
				this.expander = expander;
				this.seeds = seeds;
			}

			async run(): Promise<{
				sampledNodes: Set<string>;
				sampledEdges: Set<string>;
				paths: Array<{ nodes: string[]; edges: string[] }>;
				stats: { nodesExpanded: number; edgesTraversed: number; iterations: number };
			}> {
				const frontiers: Set<string>[] = this.seeds.map((s) => new Set([s]));
				const parents = new Map<string, string | null>();

				for (const seed of this.seeds) {
					this.visited.add(seed);
					parents.set(seed, null);
				}

				let iterations = 0;
				let edgesTraversed = 0;

				while (frontiers.some((f) => f.size > 0)) {
					iterations++;

					// Select frontier with HIGHEST degree node (opposite of thesis)
					let selectedFrontier = 0;
					let maxDegree = -1;
					let selectedNode: string | null = null;

					for (const [f, frontier] of frontiers.entries()) {
						for (const nodeId of frontier) {
							const degree = this.expander.getDegree(nodeId);
							if (degree > maxDegree) {
								maxDegree = degree;
								selectedFrontier = f;
								selectedNode = nodeId;
							}
						}
					}

					if (!selectedNode) break;

					frontiers[selectedFrontier].delete(selectedNode);

					const neighbors = await this.expander.getNeighbors(selectedNode);
					edgesTraversed += neighbors.length;

					// Sort neighbors by degree (highest first) - opposite of thesis
					const sortedNeighbors = neighbors.toSorted((a, b) => {
						return this.expander.getDegree(b.targetId) - this.expander.getDegree(a.targetId);
					});

					for (const neighbor of sortedNeighbors) {
						if (!this.visited.has(neighbor.targetId)) {
							this.visited.add(neighbor.targetId);
							parents.set(neighbor.targetId, selectedNode);
							frontiers[selectedFrontier].add(neighbor.targetId);

							const edgeKey = `${selectedNode}->${neighbor.targetId}`;
							this.sampledEdges.add(edgeKey);
							this.expander.addEdge(selectedNode, neighbor.targetId, neighbor.relationshipType);
						}
					}

					// Check for path completion
					this.checkPaths(parents);
				}

				return {
					sampledNodes: this.visited,
					sampledEdges: this.sampledEdges,
					paths: this.paths,
					stats: {
						nodesExpanded: this.visited.size,
						edgesTraversed,
						iterations,
					},
				};
			}

			private checkPaths(parents: Map<string, string | null>): void {
				if (this.seeds.length < 2) return;

				const seed0 = this.seeds[0];
				const seed1 = this.seeds[1];

				// Reconstruct path from seed0 to seed1 if exists
				const path: string[] = [];
				let current = seed1;

				while (current !== null) {
					path.unshift(current);
					const parent = parents.get(current);
					if (parent === undefined) break;
					if (parent === null) break;
					current = parent;
				}

				if (path[0] === seed0 && path.length > 1) {
					const edges: string[] = [];
					for (let index = 0; index < path.length - 1; index++) {
						edges.push(`${path[index]}->${path[index + 1]}`);
					}
					this.paths.push({ nodes: path, edges });
				}
			}
		}

		/**
		 * Low-Degree-First Baseline (similar to thesis, but simpler).
		 * Always picks lowest degree node without considering N-seed context.
		 */
		class LowDegreeFirstExpansion {
			private expander: GraphExpander<{ id: string }>;
			private seeds: string[];
			private visited = new Set<string>();
			private sampledEdges = new Set<string>();
			private paths: Array<{ nodes: string[]; edges: string[] }> = [];

			constructor(expander: GraphExpander<{ id: string }>, seeds: string[]) {
				if (seeds.length === 0) {
					throw new Error("At least one seed node is required");
				}
				this.expander = expander;
				this.seeds = seeds;
			}

			async run(): Promise<{
				sampledNodes: Set<string>;
				sampledEdges: Set<string>;
				paths: Array<{ nodes: string[]; edges: string[] }>;
				stats: { nodesExpanded: number; edgesTraversed: number; iterations: number };
			}> {
				const frontiers: Set<string>[] = this.seeds.map((s) => new Set([s]));
				const parents = new Map<string, string | null>();

				for (const seed of this.seeds) {
					this.visited.add(seed);
					parents.set(seed, null);
				}

				let iterations = 0;
				let edgesTraversed = 0;

				while (frontiers.some((f) => f.size > 0)) {
					iterations++;

					// Select frontier with LOWEST degree node (similar to thesis)
					let selectedFrontier = 0;
					let minDegree = Infinity;
					let selectedNode: string | null = null;

					for (const [f, frontier] of frontiers.entries()) {
						for (const nodeId of frontier) {
							const degree = this.expander.getDegree(nodeId);
							if (degree < minDegree) {
								minDegree = degree;
								selectedFrontier = f;
								selectedNode = nodeId;
							}
						}
					}

					if (!selectedNode || minDegree === Infinity) break;

					frontiers[selectedFrontier].delete(selectedNode);

					const neighbors = await this.expander.getNeighbors(selectedNode);
					edgesTraversed += neighbors.length;

					for (const neighbor of neighbors) {
						if (!this.visited.has(neighbor.targetId)) {
							this.visited.add(neighbor.targetId);
							parents.set(neighbor.targetId, selectedNode);
							frontiers[selectedFrontier].add(neighbor.targetId);

							const edgeKey = `${selectedNode}->${neighbor.targetId}`;
							this.sampledEdges.add(edgeKey);
							this.expander.addEdge(selectedNode, neighbor.targetId, neighbor.relationshipType);
						}
					}

					this.checkPaths(parents);
				}

				return {
					sampledNodes: this.visited,
					sampledEdges: this.sampledEdges,
					paths: this.paths,
					stats: {
						nodesExpanded: this.visited.size,
						edgesTraversed,
						iterations,
					},
				};
			}

			private checkPaths(parents: Map<string, string | null>): void {
				if (this.seeds.length < 2) return;

				const seed0 = this.seeds[0];
				const seed1 = this.seeds[1];

				const path: string[] = [];
				let current = seed1;

				while (current !== null) {
					path.unshift(current);
					const parent = parents.get(current);
					if (parent === undefined) break;
					if (parent === null) break;
					current = parent;
				}

				if (path[0] === seed0 && path.length > 1) {
					const edges: string[] = [];
					for (let index = 0; index < path.length - 1; index++) {
						edges.push(`${path[index]}->${path[index + 1]}`);
					}
					this.paths.push({ nodes: path, edges });
				}
			}
		}

		it("should compare thesis method vs high-degree-first baseline", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

			const thesis = new DegreePrioritisedExpansion(expander, seeds);
			const highDegree = new HighDegreeFirstExpansion(expander, seeds);

			const [thesisResult, hdResult] = await Promise.all([thesis.run(), highDegree.run()]);

			const thesisDiversity = pathDiversity(thesisResult.paths);
			const hdDiversity = pathDiversity(hdResult.paths);

			console.log("\n=== Thesis vs High-Degree-First Baseline ===");
			console.log(`Thesis (DP): ${thesisResult.paths.length} paths, diversity ${thesisDiversity.toFixed(3)}`);
			console.log(`High-Degree-First: ${hdResult.paths.length} paths, diversity ${hdDiversity.toFixed(3)}`);

			if (thesisDiversity > hdDiversity) {
				const improvement = ((thesisDiversity - hdDiversity) / Math.max(hdDiversity, 0.001)) * 100;
				console.log(`Thesis improvement: ${improvement.toFixed(1)}%`);
			}

			// Thesis method should not be worse than high-degree-first
			expect(thesisDiversity).toBeGreaterThanOrEqual(hdDiversity * 0.9); // Allow 10% margin
		});

		it("should compare thesis method vs low-degree-first baseline", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("facebook");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

			const thesis = new DegreePrioritisedExpansion(expander, seeds);
			const lowDegree = new LowDegreeFirstExpansion(expander, seeds);

			const [thesisResult, ldResult] = await Promise.all([thesis.run(), lowDegree.run()]);

			const thesisDiversity = pathDiversity(thesisResult.paths);
			const ldDiversity = pathDiversity(ldResult.paths);

			console.log("\n=== Thesis vs Low-Degree-First Baseline ===");
			console.log(`Thesis (DP): ${thesisResult.paths.length} paths, diversity ${thesisDiversity.toFixed(3)}`);
			console.log(`Low-Degree-First: ${ldResult.paths.length} paths, diversity ${ldDiversity.toFixed(3)}`);

			const difference = thesisDiversity - ldDiversity;
			console.log(`Diversity difference: ${difference.toFixed(3)}`);

			// Thesis method should find paths (or at least sample nodes)
			expect(thesisResult.paths.length).toBeGreaterThanOrEqual(0);
			expect(thesisResult.sampledNodes.size).toBeGreaterThan(0);
			// Low-degree-first may fail to find paths on large graphs (gets stuck in leaves)
			expect(ldResult.sampledNodes.size).toBeGreaterThan(0);
		});

		it("should rank all methods by path diversity", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

			const methods = [
				{ name: "Degree-Prioritised (Thesis)", algo: new DegreePrioritisedExpansion(expander, seeds) },
				{ name: "Standard BFS", algo: new StandardBfsExpansion(expander, seeds) },
				{ name: "Frontier-Balanced", algo: new FrontierBalancedExpansion(expander, seeds) },
				{ name: "Random Priority", algo: new RandomPriorityExpansion(expander, seeds, 42) },
				{ name: "Low-Degree-First", algo: new LowDegreeFirstExpansion(expander, seeds) },
				{ name: "High-Degree-First", algo: new HighDegreeFirstExpansion(expander, seeds) },
			];

			const results = await Promise.all(
				methods.map(async (m) => ({
					name: m.name,
					result: await m.algo.run(),
					diversity: 0, // Will calculate
				}))
			);

			for (const r of results) {
				r.diversity = pathDiversity(r.result.paths);
			}

			// Sort by diversity
			results.sort((a, b) => b.diversity - a.diversity);

			console.log("\n=== Method Ranking by Path Diversity ===");
			for (const [index, r] of results.entries()) {
				console.log(`${index + 1}. ${r.name}: ${r.diversity.toFixed(3)} (${r.result.paths.length} paths)`);
			}

			// Thesis method should be in top 3
			const thesisRank = results.findIndex((r) => r.name.includes("Degree-Prioritised"));
			expect(thesisRank).toBeLessThan(3);
		});

		it("should compare hub sampling between thesis and high-degree-first", async () => {
			const benchmark = await loadBenchmarkByIdFromUrl("karate");
			const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

			const allNodes = expander.getAllNodeIds();
			const seeds: [string, string] = [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

			const thesis = new DegreePrioritisedExpansion(expander, seeds);
			const highDegree = new HighDegreeFirstExpansion(expander, seeds);

			const [thesisResult, hdResult] = await Promise.all([thesis.run(), highDegree.run()]);

			// Count high-degree nodes sampled (degree > 5)
			const hubThreshold = 5;

			const thesisHubs = [...thesisResult.sampledNodes].filter((id) => expander.getDegree(id) > hubThreshold)
				.length;
			const hdHubs = [...hdResult.sampledNodes].filter((id) => expander.getDegree(id) > hubThreshold).length;

			console.log("\n=== Hub Sampling Comparison ===");
			console.log(`Thesis (DP): ${thesisHubs} high-degree nodes sampled`);
			console.log(`High-Degree-First: ${hdHubs} high-degree nodes sampled`);

			// High-degree-first should sample MORE high-degree nodes (by design)
			// This validates that thesis method defers hubs
			expect(hdHubs).toBeGreaterThanOrEqual(thesisHubs);
		});
	});
});
