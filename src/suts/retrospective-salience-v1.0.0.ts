/**
 * Retrospective Salience-Guided Expansion SUT (Worker-Compatible)
 *
 * Standalone SUT file for PPEF worker thread execution.
 * Wraps the RetrospectiveSalienceExpansion traversal algorithm.
 *
 * Usage:
 *   import { createSut, registration } from "./suts/retrospective-salience-v1.0.0.js";
 *   const sut = createSut({});
 *   const result = await sut.run({ expander, seeds });
 */

import type { SUT, SutRegistration } from "ppef/types/sut";

import type { DegreePrioritisedExpansionResult } from "../algorithms/traversal/degree-prioritised-expansion.js";
import { RetrospectiveSalienceExpansion } from "../algorithms/traversal/retrospective-salience-expansion.js";
import type { GraphExpander } from "../interfaces/graph-expander.js";

/**
 * Configuration for Retrospective Salience Expansion SUT.
 */
export type RetrospectiveSalienceConfig = Record<string, never>;

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
	/** Mean estimated MI across discovered path nodes */
	meanPathMI: number;
	/** Iteration when salience phase activated (0 if never) */
	saliencePhaseIteration: number;
	/** Discovered paths */
	paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }>;
	/** Raw expansion result */
	rawResult: DegreePrioritisedExpansionResult;
}

/**
 * SUT registration metadata.
 */
export const registration: SutRegistration = {
	id: "retrospective-salience-v1.0.0",
	name: "Retrospective Salience-Guided Expansion",
	version: "1.0.0",
	role: "primary",
	config: {} satisfies RetrospectiveSalienceConfig,
	tags: ["traversal", "salience", "rsge", "adaptive", "thesis-algorithm"],
	description: "Two-phase adaptive expansion transitioning from degree to salience-aware prioritisation",
};

/**
 * Create a Retrospective Salience Expansion SUT instance.
 *
 * @param config - Optional configuration overrides
 * @returns PPEF-compatible SUT object
 */
export const createSut = (config?: Record<string, unknown>): SUT<TraversalInputs, TraversalResult> => {
	const _sutConfig = {
		...config,
	};

	return {
		id: registration.id,
		get config() {
			return { ..._sutConfig };
		},

		/**
		 * Execute retrospective salience expansion from seed nodes.
		 *
		 * @param inputs - Graph expander and seed nodes
		 * @returns Traversal result with metrics
		 */
		run: async (inputs: TraversalInputs): Promise<TraversalResult> => {
			const { expander, seeds } = inputs;

			try {
				const expansion = new RetrospectiveSalienceExpansion(expander, seeds);
				const result = await expansion.run();

				return computeTraversalMetrics(result);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(`Retrospective salience expansion failed: ${message}`);
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

	// Estimate mean path MI from path node discovery patterns
	// Nodes discovered earlier in paths typically have higher estimated MI
	const meanPathMI = computeMeanPathMI(result);

	// Determine salience phase activation iteration
	// This is approximated by when the first path was discovered
	const saliencePhaseIteration = computeSaliencePhaseIteration(result);

	return {
		pathsFound: result.paths.length,
		nodesExpanded: result.stats.nodesExpanded,
		edgesTraversed: result.stats.edgesTraversed,
		iterations: result.stats.iterations,
		pathDiversity,
		hubAvoidance,
		meanPathMI,
		saliencePhaseIteration,
		paths: result.paths,
		rawResult: result,
	};
};

/**
 * Compute mean estimated MI across path nodes.
 *
 * Uses discovery iteration as a proxy for MI: nodes discovered earlier
 * after phase transition tend to have higher estimated MI.
 *
 * @param result - Raw expansion result
 * @returns Mean MI estimate in [0, 1]
 */
const computeMeanPathMI = (result: DegreePrioritisedExpansionResult): number => {
	if (result.paths.length === 0 || result.stats.iterations === 0) {
		return 0;
	}

	// Collect all path nodes and their discovery iterations
	const pathNodes = new Set<string>();
	for (const path of result.paths) {
		for (const node of path.nodes) {
			pathNodes.add(node);
		}
	}

	// Compute average "earliness" as MI proxy
	// Earlier discovery relative to first path = higher MI estimate
	let totalMI = 0;
	let nodeCount = 0;

	const maxIteration = result.stats.iterations;
	for (const node of pathNodes) {
		const discoveryIteration = result.nodeDiscoveryIteration.get(node) ?? maxIteration;
		// Normalize to [0, 1] where earlier = higher MI
		const normalizedMI = 1 - (discoveryIteration / maxIteration);
		totalMI += normalizedMI;
		nodeCount++;
	}

	return nodeCount > 0 ? totalMI / nodeCount : 0;
};

/**
 * Determine the iteration when salience phase activated.
 *
 * Approximates by finding when the first path was discovered.
 *
 * @param result - Raw expansion result
 * @returns Iteration number (0 if no paths discovered)
 */
const computeSaliencePhaseIteration = (result: DegreePrioritisedExpansionResult): number => {
	if (result.paths.length === 0) {
		return 0;
	}

	// Find the earliest discovery of any path node beyond seeds
	// The first path discovery triggers phase transition
	let earliestPathNodeIteration = Infinity;

	for (const path of result.paths) {
		for (const node of path.nodes) {
			const iteration = result.nodeDiscoveryIteration.get(node) ?? 0;
			if (iteration > 0 && iteration < earliestPathNodeIteration) {
				earliestPathNodeIteration = iteration;
			}
		}
	}

	return earliestPathNodeIteration === Infinity ? 0 : earliestPathNodeIteration;
};
