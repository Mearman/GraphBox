/**
 * Degree-Prioritised Expansion SUT (Worker-Compatible)
 *
 * Standalone SUT file for PPEF worker thread execution.
 * Wraps the DegreePrioritisedExpansion traversal algorithm.
 *
 * Usage:
 *   import { createSut, registration } from "./suts/degree-prioritised-v1.0.0.js";
 *   const sut = createSut({});
 *   const result = await sut.run({ expander, seeds });
 */

import type { SUT, SutRegistration } from "ppef/types/sut";

import { DegreePrioritisedExpansion, type DegreePrioritisedExpansionResult } from "../algorithms/traversal/degree-prioritised-expansion.js";
import type { GraphExpander } from "../interfaces/graph-expander.js";

/**
 * Configuration for Degree-Prioritised Expansion SUT.
 */
export interface DegreePrioritisedConfig {
	/** Maximum iterations (optional, defaults to unlimited) */
	maxIterations?: number;
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
	/** Discovered paths */
	paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }>;
	/** Raw expansion result */
	rawResult: DegreePrioritisedExpansionResult;
}

/**
 * SUT registration metadata.
 */
export const registration: SutRegistration = {
	id: "degree-prioritised-v1.0.0",
	name: "Degree-Prioritised Expansion",
	version: "1.0.0",
	role: "primary",
	config: {} satisfies DegreePrioritisedConfig,
	tags: ["traversal", "hub-avoidance", "thesis-algorithm"],
	description: "Parameter-free multi-seed expansion with hub deferral via ascending degree priority",
};

/**
 * Create a Degree-Prioritised Expansion SUT instance.
 *
 * @param config - Optional configuration overrides
 * @returns PPEF-compatible SUT object
 */
export const createSut = (config?: Record<string, unknown>): SUT<TraversalInputs, TraversalResult> => {
	const _sutConfig = {
		maxIterations: (config?.maxIterations as number | undefined),
	};

	return {
		id: registration.id,
		get config() {
			return { ..._sutConfig };
		},

		/**
		 * Execute degree-prioritised expansion from seed nodes.
		 *
		 * @param inputs - Graph expander and seed nodes
		 * @returns Traversal result with metrics
		 */
		run: async (inputs: TraversalInputs): Promise<TraversalResult> => {
			const { expander, seeds } = inputs;

			try {
				const expansion = new DegreePrioritisedExpansion(expander, seeds);
				const result = await expansion.run();

				return computeTraversalMetrics(result);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(`Degree-prioritised expansion failed: ${message}`);
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

	return {
		pathsFound: result.paths.length,
		nodesExpanded: result.stats.nodesExpanded,
		edgesTraversed: result.stats.edgesTraversed,
		iterations: result.stats.iterations,
		pathDiversity,
		hubAvoidance,
		paths: result.paths,
		rawResult: result,
	};
};
