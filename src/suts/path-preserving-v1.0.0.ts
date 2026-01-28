/**
 * Path-Preserving Multi-Frontier Expansion SUT (Worker-Compatible)
 *
 * Standalone SUT file for PPEF worker thread execution.
 * Wraps the PathPreservingExpansion traversal algorithm.
 *
 * Usage:
 *   import { createSut, registration } from "./suts/path-preserving-v1.0.0.js";
 *   const sut = createSut({});
 *   const result = await sut.run({ expander, seeds });
 */

import type { SUT, SutRegistration } from "ppef/types/sut";

import type { DegreePrioritisedExpansionResult } from "../algorithms/traversal/degree-prioritised-expansion.js";
import { PathPreservingExpansion } from "../algorithms/traversal/path-preserving-expansion.js";
import type { GraphExpander } from "../interfaces/graph-expander.js";

/**
 * Configuration for Path-Preserving Expansion SUT.
 */
export interface PathPreservingConfig {
	/** Target paths per seed pair for early termination (optional) */
	targetPathsPerPair?: number;
}

/**
 * Traversal inputs for this SUT.
 */
export interface TraversalInputs<T = unknown> {
	/** Graph expander providing neighbour access */
	expander: GraphExpander<T>;
	/** Array of seed node IDs */
	seeds: readonly string[];
}

/**
 * Traversal result with standard metrics.
 */
export interface TraversalResult {
	/** Number of paths discovered */
	pathsFound: number;
	/** Total nodes sampled */
	nodesExpanded: number;
	/** Total edges traversed */
	edgesTraversed: number;
	/** Number of iterations */
	iterations: number;
	/** Path diversity (unique nodes / total path nodes) */
	pathDiversity: number;
	/** Hub avoidance ratio */
	hubAvoidance: number;
	/** Frontier divergence score (higher = more frontier separation) */
	frontierDivergence: number;
	/** Discovered paths */
	paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }>;
	/** Raw expansion result */
	rawResult: DegreePrioritisedExpansionResult;
}

/**
 * SUT registration metadata.
 */
export const registration: SutRegistration = {
	id: "path-preserving-v1.0.0",
	name: "Path-Preserving Multi-Frontier Expansion",
	version: "1.0.0",
	role: "primary",
	config: {} satisfies PathPreservingConfig,
	tags: ["traversal", "path-preserving", "ppme", "thesis-algorithm"],
	description: "Penalises overlap between frontiers to preserve path diversity",
};

/**
 * Create a Path-Preserving Expansion SUT instance.
 *
 * @param config - Optional configuration overrides
 * @returns PPEF-compatible SUT object
 */
export const createSut = (config?: Record<string, unknown>): SUT<TraversalInputs, TraversalResult> => {
	const _sutConfig: PathPreservingConfig = {
		targetPathsPerPair: config?.targetPathsPerPair as number | undefined,
	};

	return {
		id: registration.id,
		get config() {
			return { ..._sutConfig };
		},

		/**
		 * Execute path-preserving expansion from seed nodes.
		 *
		 * @param inputs - Graph expander and seed nodes
		 * @returns Traversal result with metrics
		 */
		run: async (inputs: TraversalInputs): Promise<TraversalResult> => {
			const { expander, seeds } = inputs;

			try {
				const expansion = new PathPreservingExpansion(expander, seeds, {
					targetPathsPerPair: _sutConfig.targetPathsPerPair,
				});
				const result = await expansion.run();

				return computeTraversalMetrics(result);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(`Path-preserving expansion failed: ${message}`);
			}
		},
	};
};

/**
 * Compute standardized traversal metrics from expansion result.
 *
 * @param result - Raw expansion result
 * @returns Standardized traversal result
 */
const computeTraversalMetrics = (result: DegreePrioritisedExpansionResult): TraversalResult => {
	// Compute path diversity
	const uniquePathNodes = new Set<string>();
	let totalPathNodes = 0;
	for (const path of result.paths) {
		for (const node of path.nodes) {
			uniquePathNodes.add(node);
			totalPathNodes++;
		}
	}
	const pathDiversity = totalPathNodes > 0 ? uniquePathNodes.size / totalPathNodes : 0;

	// Compute hub avoidance (ratio of low-degree nodes expanded)
	const lowDegreeCount =
		(result.stats.degreeDistribution.get("1-5") ?? 0) +
		(result.stats.degreeDistribution.get("6-10") ?? 0);
	const hubAvoidance = result.stats.nodesExpanded > 0 ? lowDegreeCount / result.stats.nodesExpanded : 0;

	// Compute frontier divergence from visitedPerFrontier
	// Measures how distinct each frontier's exploration is
	const frontierDivergence = computeFrontierDivergence(result.visitedPerFrontier);

	return {
		pathsFound: result.paths.length,
		nodesExpanded: result.stats.nodesExpanded,
		edgesTraversed: result.stats.edgesTraversed,
		iterations: result.stats.iterations,
		pathDiversity,
		hubAvoidance,
		frontierDivergence,
		paths: result.paths,
		rawResult: result,
	};
};

/**
 * Compute frontier divergence score.
 *
 * Measures how distinct each frontier's visited set is from others.
 * Higher score = frontiers explored more distinct regions.
 *
 * @param visitedPerFrontier - Array of visited sets, one per frontier
 * @returns Divergence score in [0, 1]
 */
const computeFrontierDivergence = (visitedPerFrontier: Array<Set<string>>): number => {
	if (visitedPerFrontier.length < 2) {
		return 1; // Single frontier has perfect "divergence" (no overlap possible)
	}

	// Compute pairwise Jaccard distances and average them
	let totalDistance = 0;
	let pairCount = 0;

	for (let index = 0; index < visitedPerFrontier.length; index++) {
		for (let index_ = index + 1; index_ < visitedPerFrontier.length; index_++) {
			const setA = visitedPerFrontier[index];
			const setB = visitedPerFrontier[index_];

			// Jaccard distance = 1 - |A ∩ B| / |A ∪ B|
			const intersection = new Set([...setA].filter(x => setB.has(x)));
			const union = new Set([...setA, ...setB]);

			if (union.size > 0) {
				const jaccardSimilarity = intersection.size / union.size;
				const jaccardDistance = 1 - jaccardSimilarity;
				totalDistance += jaccardDistance;
			} else {
				totalDistance += 1; // Empty sets are maximally divergent
			}

			pairCount++;
		}
	}

	return pairCount > 0 ? totalDistance / pairCount : 1;
};
