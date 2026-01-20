/**
 * Path Ranking Validation Helpers
 *
 * Shared utilities for path ranking validation tests including
 * statistical functions, ranking comparison metrics, and test helpers.
 */

import { type Graph } from "../../../../../algorithms/graph/graph";
import { type PathRankingConfig,type RankedPath, rankPaths } from "../../../../../algorithms/pathfinding/path-ranking";
import type { Edge, Node } from "../../../../../algorithms/types/graph";
import { betweennessRanking } from "../../../../baselines/betweenness-ranking";
import { randomPathRanking } from "../../../../baselines/random-path-ranking";
import { shortestPathRanking } from "../../../../baselines/shortest-path-ranking";
import { cohensD, mannWhitneyUTest } from "./statistical-functions";

// ============================================================================
// Statistical Ranking Functions
// ============================================================================

/**
 * Spearman's rank correlation coefficient.
 *
 * Measures the monotonic relationship between two rankings.
 * Returns value in [-1, 1] where:
 * - 1: perfect positive correlation (rankings identical)
 * - 0: no correlation
 * - -1: perfect negative correlation (rankings reversed)
 *
 * Uses Pearson correlation on rank values.
 * @param rankingA - First ranking (array of comparable items or numeric ranks)
 * @param rankingB - Second ranking (array of comparable items or numeric ranks)
 */
export const spearmanCorrelation = <T extends string | number>(
	rankingA: T[],
	rankingB: T[],
): number => {
	// Create unified set of all items
	const allItems = new Set([...rankingA, ...rankingB]);
	const n = allItems.size;

	if (n === 0) return 0;
	if (n === 1) return 1;

	// Assign ranks (handle missing items by assigning mean rank of missing items)
	const rankA = new Map<T, number>();
	const rankB = new Map<T, number>();

	// Create position maps
	const posA = new Map<T, number>(rankingA.map((id, index) => [id, index]));
	const posB = new Map<T, number>(rankingB.map((id, index) => [id, index]));

	// Assign ranks
	let missingCountA = 0;
	let missingCountB = 0;

	for (const item of allItems) {
		if (posA.has(item)) {
			const pos = posA.get(item);
			if (pos !== undefined) {
				rankA.set(item, pos);
			}
		} else {
			// Assign average rank of missing positions
			rankA.set(item, rankingA.length + missingCountA);
			missingCountA++;
		}

		if (posB.has(item)) {
			const pos = posB.get(item);
			if (pos !== undefined) {
				rankB.set(item, pos);
			}
		} else {
			rankB.set(item, rankingB.length + missingCountB);
			missingCountB++;
		}
	}

	// Compute Pearson correlation on ranks
	let sumX = 0;
	let sumY = 0;
	let sumXY = 0;
	let sumX2 = 0;
	let sumY2 = 0;

	for (const item of allItems) {
		const x = rankA.get(item) ?? 0;
		const y = rankB.get(item) ?? 0;
		sumX += x;
		sumY += y;
		sumXY += x * y;
		sumX2 += x * x;
		sumY2 += y * y;
	}

	const numerator = n * sumXY - sumX * sumY;
	const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

	return denominator === 0 ? 0 : numerator / denominator;
};

/**
 * Kendall's Tau rank correlation coefficient.
 *
 * Measures ordinal association between two rankings based on
 * concordant and discordant pairs.
 *
 * Returns value in [-1, 1] where:
 * - 1: perfect agreement (all pairs concordant)
 * - 0: no association
 * - -1: perfect disagreement (all pairs discordant)
 * @param rankingA - First ranking (array of comparable items or numeric ranks)
 * @param rankingB - Second ranking (array of comparable items or numeric ranks)
 */
export const kendallTau = <T extends string | number>(
	rankingA: T[],
	rankingB: T[],
): number => {
	const allItems = new Set([...rankingA, ...rankingB]);

	if (allItems.size < 2) return 1;

	// Get position maps
	const posA = new Map<T, number>(rankingA.map((id, index) => [id, index]));
	const posB = new Map<T, number>(rankingB.map((id, index) => [id, index]));

	// Count concordant and discordant pairs
	let concordant = 0;
	let discordant = 0;

	const items = [...allItems];

	for (let index = 0; index < items.length; index++) {
		for (let index_ = index + 1; index_ < items.length; index_++) {
			const a = items[index];
			const b = items[index_];

			const aInA = posA.has(a);
			const bInA = posA.has(a);
			const aInB = posB.has(a);
			const bInB = posB.has(b);

			// Skip pairs where either item is missing from both rankings
			if ((!aInA && !bInA) || (!aInB && !bInB)) continue;

			const posAi = posA.get(a) ?? rankingA.length;
			const posAj = posA.get(b) ?? rankingA.length;
			const posBi = posB.get(a) ?? rankingB.length;
			const posBj = posB.get(b) ?? rankingB.length;

			const orderA = Math.sign(posAi - posAj);
			const orderB = Math.sign(posBi - posBj);

			if (orderA === orderB) {
				concordant++;
			} else {
				discordant++;
			}
		}
	}

	const total = concordant + discordant;
	return total === 0 ? 0 : (concordant - discordant) / total;
};

// ============================================================================
// Multi-Method Ranking Execution
// ============================================================================

/**
 * Run all path ranking methods on the same graph.
 *
 * Executes Path Salience Ranking and all baseline methods,
 * returning their results in a Map for easy comparison.
 * @param graph
 * @param sourceId
 * @param targetId
 * @param config
 */
export const runAllRankings = async <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	sourceId: string,
	targetId: string,
	config?: Partial<PathRankingConfig<N, E>>,
): Promise<Map<string, RankedPath<N, E>[]>> => {
	const results = new Map<string, RankedPath<N, E>[]>();

	// Path Salience Ranking (primary method)
	const salienceResult = rankPaths(graph, sourceId, targetId, config);
	if (salienceResult.ok && salienceResult.value.some) {
		results.set("salience", salienceResult.value.value);
	}

	// Shortest Path Baseline
	const shortestResult = shortestPathRanking(graph, sourceId, targetId, {
		traversalMode: config?.traversalMode,
		maxPaths: config?.maxPaths,
	});
	if (shortestResult.ok && shortestResult.value.some) {
		results.set("shortest", shortestResult.value.value);
	}

	// Random Path Baseline
	const randomResult = randomPathRanking(graph, sourceId, targetId, {
		traversalMode: config?.traversalMode,
		maxPaths: config?.maxPaths,
		seed: 42, // Fixed seed for reproducibility
	});
	if (randomResult.ok && randomResult.value.some) {
		results.set("random", randomResult.value.value);
	}

	// Betweenness Baseline
	const betweennessResult = betweennessRanking(graph, sourceId, targetId, {
		traversalMode: config?.traversalMode,
		maxPaths: config?.maxPaths,
	});
	if (betweennessResult.ok && betweennessResult.value.some) {
		results.set("betweenness", betweennessResult.value.value);
	}

	return results;
};

// ============================================================================
// Ranking Metrics
// ============================================================================

/**
 * Metrics computed from a set of ranked paths.
 */
export interface RankingMetrics {
	/** Mean geometric mean MI of paths */
	meanMI: number;

	/** Standard deviation of MI values */
	stdMI: number;

	/** Entropy-based path diversity (0-1, higher = more diverse) */
	pathDiversity: number;

	/** Hub avoidance: 1 - (high-degree node frequency) */
	hubAvoidance: number;

	/** Proportion of unique nodes in reachable set */
	nodeCoverage: number;

	/** Mean score across all paths */
	meanScore: number;

	/** Standard deviation of scores */
	stdScore: number;
}

/**
 * Compute comprehensive metrics for a set of ranked paths.
 *
 * @param rankedPaths - Array of ranked paths
 * @param graph - Optional graph for node coverage calculation
 * @param hubThreshold - Degree threshold for hub classification (default: 10)
 * @returns Computed metrics
 */
export const computeRankingMetrics = <N extends Node, E extends Edge>(
	rankedPaths: RankedPath<N, E>[],
	graph?: Graph<N, E>,
	hubThreshold = 10,
): RankingMetrics => {
	if (rankedPaths.length === 0) {
		return {
			meanMI: 0,
			stdMI: 0,
			pathDiversity: 0,
			hubAvoidance: 0,
			nodeCoverage: 0,
			meanScore: 0,
			stdScore: 0,
		};
	}

	// MI metrics
	const miValues = rankedPaths.map((p) => p.geometricMeanMI);
	const meanMI = miValues.reduce((a, b) => a + b, 0) / miValues.length;
	const varianceMI = miValues.reduce((sum, mi) => sum + (mi - meanMI) ** 2, 0) / miValues.length;
	const stdMI = Math.sqrt(varianceMI);

	// Path diversity (entropy of path lengths)
	const pathLengths = rankedPaths.map((p) => p.path.edges.length);
	const lengthCounts = new Map<number, number>();
	for (const length of pathLengths) {
		lengthCounts.set(length, (lengthCounts.get(length) ?? 0) + 1);
	}

	let entropy = 0;
	for (const count of lengthCounts.values()) {
		const p = count / pathLengths.length;
		entropy -= p * Math.log2(p);
	}
	const maxEntropy = Math.log2(lengthCounts.size);
	const pathDiversity = maxEntropy > 0 ? entropy / maxEntropy : 0;

	// Hub avoidance
	const nodeFrequencies = new Map<string, number>();
	for (const path of rankedPaths) {
		for (const node of path.path.nodes) {
			nodeFrequencies.set(node.id, (nodeFrequencies.get(node.id) ?? 0) + 1);
		}
	}

	let hubCount = 0;
	let totalNodes = 0;

	for (const [nodeId, count] of nodeFrequencies) {
		totalNodes += count;
		let degree = 0;
		if (graph) {
			const neighbors = graph.getNeighbors(nodeId);
			if (neighbors.ok) {
				degree = neighbors.value.length;
			}
		}
		if (degree >= hubThreshold) {
			hubCount += count;
		}
	}

	const hubAvoidance = totalNodes > 0 ? 1 - hubCount / totalNodes : 1;

	// Node coverage
	const uniqueNodes = new Set<string>();
	for (const path of rankedPaths) {
		for (const node of path.path.nodes) {
			uniqueNodes.add(node.id);
		}
	}
	const nodeCoverage = graph
		? uniqueNodes.size / graph.getNodeCount()
		: 1; // No graph provided - all unique nodes are covered

	// Score metrics
	const scores = rankedPaths.map((p) => p.score);
	const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;
	const varianceScore = scores.reduce((sum, s) => sum + (s - meanScore) ** 2, 0) / scores.length;
	const stdScore = Math.sqrt(varianceScore);

	return {
		meanMI,
		stdMI,
		pathDiversity,
		hubAvoidance,
		nodeCoverage,
		meanScore,
		stdScore,
	};
};

// ============================================================================
// Statistical Comparison Functions
// ============================================================================

/**
 * Compare two sets of ranked paths using statistical tests.
 * @param rankedPathsA
 * @param rankedPathsB
 */
export const compareRankings = <N extends Node, E extends Edge>(
	rankedPathsA: RankedPath<N, E>[],
	rankedPathsB: RankedPath<N, E>[],
): {
	spearman: number;
	kendall: number;
	mannWhitney: ReturnType<typeof mannWhitneyUTest>;
	cohensD: number;
} => {
	// Convert to path ID strings for correlation
	const pathsA = rankedPathsA.map((p, index) => `A_${index}_${p.path.edges.map((e) => e.id).join("-")}`);
	const pathsB = rankedPathsB.map((p, index) => `B_${index}_${p.path.edges.map((e) => e.id).join("-")}`);

	// For correlation, use same path representations
	const allPaths = new Set([...pathsA, ...pathsB]);
	const rankingA = [...allPaths].filter((p) => pathsA.includes(p));
	const rankingB = [...allPaths].filter((p) => pathsB.includes(p));

	return {
		spearman: spearmanCorrelation(rankingA, rankingB),
		kendall: kendallTau(rankingA, rankingB),
		mannWhitney: mannWhitneyUTest(
			rankedPathsA.map((p) => p.score),
			rankedPathsB.map((p) => p.score),
		),
		cohensD: cohensD(rankedPathsA.map((p) => p.score), rankedPathsB.map((p) => p.score)),
	};
};

// ============================================================================
// Path Signature Generation
// ============================================================================

/**
 * Generate a canonical signature for a path.
 * Used for comparing paths across different ranking methods.
 * @param rankedPath
 */
export const pathSignature = <N extends Node, E extends Edge>(rankedPath: RankedPath<N, E>): string => {
	return rankedPath.path.nodes.map((n) => n.id).join("->");
};

/**
 * Generate all path signatures for a ranked path list.
 * @param rankedPaths
 */
export const allPathSignatures = <N extends Node, E extends Edge>(rankedPaths: RankedPath<N, E>[]): string[] => {
	return rankedPaths.map(pathSignature);
};

// ============================================================================
// Re-exports from statistical-functions
// ============================================================================

export { cohensD, confidenceInterval, jaccardSimilarity, mannWhitneyUTest, pathDiversity } from "./statistical-functions";
