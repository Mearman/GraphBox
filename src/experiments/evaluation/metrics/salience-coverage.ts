/**
 * Salience Coverage Metrics
 *
 * Measures how well a graph expansion preserves highly-salient paths.
 *
 * The Path Salience algorithm ranks paths by information-theoretic quality.
 * This metric measures what percentage of top-ranked salient paths are
 * discovered by an expansion variant.
 *
 * **Key insight**: The true success criterion for seeded graph expansion
 * is not generic path diversity, but preservation of the paths that the
 * Path Salience algorithm identifies as most significant.
 */

import type { Graph } from "../../../algorithms/graph/graph.js";
import { rankPaths } from "../../../algorithms/pathfinding/path-ranking.js";
import type { Edge, Node } from "../../../algorithms/types/graph.js";

/**
 * Configuration for salience coverage computation.
 */
export interface SalienceCoverageConfig {
	/**
	 * Number of top paths to consider from each seed pair.
	 * @default 10
	 */
	topK: number;

	/**
	 * Length penalty parameter for path ranking.
	 * - λ = 0: Pure MI quality (default)
	 * - λ > 0: Penalise longer paths
	 * @default 0
	 */
	lambda?: number;


	/**
	 * Traversal mode for path ranking.
	 * @default "undirected"
	 */
	traversalMode?: "directed" | "undirected";
}

/**
 * Result of salience coverage computation.
 */
export interface SalienceCoverageResult {
	/**
	 * Primary metric: fraction of top-K salient paths found.
	 * Values in [0, 1] where 1 = all top-K paths discovered.
	 */
	"salience-coverage": number;

	/**
	 * Same as salience-coverage (recall of top-K paths).
	 */
	"salience-recall": number;

	/**
	 * Precision: of discovered paths, what fraction are in top-K?
	 * Values in [0, 1]. Lower values indicate discovering irrelevant paths.
	 */
	"salience-precision": number;

	/**
	 * Absolute count of top-K salient paths found.
	 */
	"top-k-found": number;

	/**
	 * Total number of top-K salient paths (ground truth size).
	 */
	"top-k-total": number;
}

/**
 * Convert a path to a canonical signature for comparison.
 *
 * Uses node IDs joined by "->" to create direction-independent signatures.
 * For undirected graphs, the path is normalized to start from the
 * lexicographically smaller endpoint, allowing "A->B->C" and "C->B->A"
 * to match as the same undirected path.
 *
 * @param path - Array of node IDs forming a path
 * @returns Canonical path signature string
 *
 * @example
 * ```typescript
 * pathSignature(["A", "B", "C"]); // "A->B->C"
 * pathSignature(["C", "B", "A"]); // "A->B->C" (normalized)
 * pathSignature(["1", "20", "34"]); // "1->20->34"
 * pathSignature(["34", "20", "1"]); // "1->20->34" (normalized)
 * ```
 */
export const pathSignature = (path: string[]): string => {
	// For undirected graphs, normalize the path to start from the
	// lexicographically smaller endpoint. This ensures that paths
	// discovered in either direction (A->B->C vs C->B->A) match.
	if (path.length < 2) {
		return path.join("->");
	}

	const first = path[0];
	const last = path.at(-1);

	// If the path should be reversed for normalization
	if (first > (last ?? "")) {
		return [...path].reverse().join("->");
	}

	return path.join("->");
};

/**
 * Compute ground truth salience paths for a test case.
 *
 * For each seed pair, runs Path Salience ranking and extracts the top-K
 * highly-ranked paths. These form the ground truth for evaluation.
 *
 * **Preprocessing phase**: Run once per test case, reused across all SUTs.
 *
 * @template N - Node type
 * @template E - Edge type
 * @param graph - The graph to analyse
 * @param seeds - Array of seed node IDs
 * @param config - Configuration for ranking and K selection
 * @returns Set of path signatures representing top-K salient paths
 *
 * @example
 * ```typescript
 * const graph = new Graph<MyNode, MyEdge>(false);
 * // ... populate graph ...
 *
 * const groundTruth = computeSalienceGroundTruth(
 *   graph,
 *   ["seed1", "seed2", "seed3"],
 *   { topK: 10, lambda: 0 }
 * );
 * // groundTruth is Set<string> of path signatures
 * ```
 */
export const computeSalienceGroundTruth = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	seeds: string[],
	config: SalienceCoverageConfig,
): Set<string> => {
	const { topK = 10, lambda = 0, traversalMode = "undirected" } = config;
	const topPaths = new Set<string>();

	// For each seed pair, run Path Salience ranking
	for (let index = 0; index < seeds.length; index++) {
		for (let index_ = index + 1; index_ < seeds.length; index_++) {
			const result = rankPaths(graph, seeds[index], seeds[index_], {
				lambda,
				maxPaths: topK * 2, // Get more than needed to ensure quality
				shortestOnly: false,
				traversalMode,
			});

			if (result.ok && result.value.some) {
				const ranked = result.value.value;
				// Extract top-K path signatures with normalization
				for (const p of ranked.slice(0, topK)) {
					const nodeIds = p.path.nodes.map((n) => n.id);
					const sig = pathSignature(nodeIds);
					topPaths.add(sig);
				}
			}
		}
	}

	return topPaths;
};

/**
 * Compute salience coverage for an expansion result.
 *
 * Measures what percentage of ground truth salient paths were discovered
 * by the expansion algorithm.
 *
 * @param discoveredPaths - Array of paths discovered by the SUT
 * @param groundTruthPaths - Set of top-K salient path signatures (ground truth)
 * @returns Salience coverage metrics
 *
 * @example
 * ```typescript
 * const discovered = [
 *   { nodes: ["A", "B", "C"] },
 *   { nodes: ["A", "X", "Y", "C"] }
 * ];
 *
 * const groundTruth = new Set([
 *   "A->B->C",
 *   "A->X->Y->C",
 *   "A->D->E->C"
 * ]);
 *
 * const coverage = computeSalienceCoverage(discovered, groundTruth);
 * // {
 * //   "salience-coverage": 0.667,  // 2 of 3 top-K paths found
 * //   "salience-recall": 0.667,
 * //   "salience-precision": 1.0,    // All discovered paths are in top-K
 * //   "top-k-found": 2,
 * //   "top-k-total": 3
 * // }
 * ```
 */
export const computeSalienceCoverage = (
	discoveredPaths: Array<{ nodes: string[] }>,
	groundTruthPaths: Set<string>,
): SalienceCoverageResult => {
	// Convert discovered paths to signatures
	const discoveredSignatures = new Set(discoveredPaths.map((p) => pathSignature(p.nodes)));

	// Count overlap: how many top-K paths were discovered?
	let found = 0;
	for (const truthSig of groundTruthPaths) {
		if (discoveredSignatures.has(truthSig)) {
			found++;
		}
	}

	const k = groundTruthPaths.size;
	const n = discoveredPaths.length;

	return {
		"salience-coverage": k > 0 ? found / k : 0,
		"salience-recall": k > 0 ? found / k : 0,
		"salience-precision": n > 0 ? found / n : 0,
		"top-k-found": found,
		"top-k-total": k,
	};
};

/**
 * Compute salience coverage for paths stored as string arrays.
 *
 * Convenience overload for when paths are already string arrays.
 *
 * @param discoveredPaths - Array of path string arrays
 * @param groundTruthPaths - Set of top-K salient path signatures
 * @returns Salience coverage metrics
 */
export const computeSalienceCoverageFromStringPaths = (
	discoveredPaths: string[][],
	groundTruthPaths: Set<string>,
): SalienceCoverageResult => {
	// Convert string[][] to the expected format
	const formattedPaths = discoveredPaths.map((nodes) => ({ nodes }));
	return computeSalienceCoverage(formattedPaths, groundTruthPaths);
};
