/**
 * Heterogeneity-Aware Bidirectional Expansion SUT (Worker-Compatible)
 *
 * Standalone SUT file for PPEF worker thread execution.
 * Wraps the HeterogeneityAwareExpansion traversal algorithm.
 *
 * Usage:
 *   import { createSut, registration } from "./suts/heterogeneity-aware-v1.0.0.js";
 *   const sut = createSut({});
 *   const result = await sut.run({ expander, seeds });
 */

import type { SUT, SutRegistration } from "ppef/types/sut";

import type { DegreePrioritisedExpansionResult } from "../algorithms/traversal/degree-prioritised-expansion.js";
import { HeterogeneityAwareExpansion } from "../algorithms/traversal/heterogeneity-aware-expansion.js";
import type { GraphExpander } from "../interfaces/graph-expander.js";

/**
 * Configuration for Heterogeneity-Aware Expansion SUT.
 */
export type HeterogeneityAwareConfig = Record<string, never>;

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
	/** Cross-domain path ratio */
	crossDomainPathRatio: number;
	/** Mean entropy of expanded nodes */
	meanExpansionEntropy: number;
	/** Discovered paths */
	paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }>;
	/** Raw expansion result */
	rawResult: DegreePrioritisedExpansionResult;
}

/**
 * SUT registration metadata.
 */
export const registration: SutRegistration = {
	id: "heterogeneity-aware-v1.0.0",
	name: "Heterogeneity-Aware Bidirectional Expansion",
	version: "1.0.0",
	role: "primary",
	config: {} satisfies HeterogeneityAwareConfig,
	tags: ["traversal", "entropy", "cross-domain", "thesis-algorithm", "habe"],
	description: "Entropy-guided expansion with overlap termination for heterogeneous graphs",
};

/**
 * Create a Heterogeneity-Aware Expansion SUT instance.
 *
 * @param config - Optional configuration overrides
 * @returns PPEF-compatible SUT object
 */
export const createSut = (config?: Record<string, unknown>): SUT<TraversalInputs, TraversalResult> => {
	const _sutConfig = {
		// Reserved for future options
		...config,
	};

	return {
		id: registration.id,
		get config() {
			return { ..._sutConfig };
		},

		/**
		 * Execute heterogeneity-aware expansion from seed nodes.
		 *
		 * @param inputs - Graph expander and seed nodes
		 * @returns Traversal result with metrics
		 */
		run: async (inputs: TraversalInputs): Promise<TraversalResult> => {
			const { expander, seeds } = inputs;

			try {
				const expansion = new HeterogeneityAwareExpansion(expander, seeds);
				const result = await expansion.run();

				return computeTraversalMetrics(result, expander);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(`Heterogeneity-aware expansion failed: ${message}`);
			}
		},
	};
};

/**
 * Compute standardized traversal metrics from expansion result.
 *
 * @param result - Raw expansion result
 * @param expander - Graph expander for additional metrics
 * @param _expander
 * @returns Standardized traversal result
 */
const computeTraversalMetrics = (
	result: DegreePrioritisedExpansionResult,
	_expander: GraphExpander<unknown>
): TraversalResult => {
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

	// Compute cross-domain path ratio (placeholder - would need edge type analysis)
	// For now, estimate based on path diversity as proxy
	const crossDomainPathRatio = pathDiversity > 0.5 ? pathDiversity : 0;

	// Compute mean expansion entropy (estimate from degree distribution)
	// Higher diversity in degree distribution suggests higher entropy exploration
	const degreeCategories = [...result.stats.degreeDistribution.values()];
	const totalCounts = degreeCategories.reduce((a, b) => a + b, 0);
	let entropy = 0;
	if (totalCounts > 0) {
		for (const count of degreeCategories) {
			const p = count / totalCounts;
			if (p > 0) {
				entropy -= p * Math.log2(p);
			}
		}
	}
	const meanExpansionEntropy = entropy;

	return {
		pathsFound: result.paths.length,
		nodesExpanded: result.stats.nodesExpanded,
		edgesTraversed: result.stats.edgesTraversed,
		iterations: result.stats.iterations,
		pathDiversity,
		hubAvoidance,
		crossDomainPathRatio,
		meanExpansionEntropy,
		paths: result.paths,
		rawResult: result,
	};
};
