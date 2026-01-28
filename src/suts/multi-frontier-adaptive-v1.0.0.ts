/**
 * Multi-Frontier Adaptive Salience-Feedback Expansion SUT (Worker-Compatible)
 *
 * Standalone SUT file for PPEF worker thread execution.
 * Wraps the MultiFrontierAdaptiveExpansion traversal algorithm.
 *
 * Usage:
 *   import { createSut, registration } from "./suts/multi-frontier-adaptive-v1.0.0.js";
 *   const sut = createSut({ minPaths: 5 });
 *   const result = await sut.run({ expander, seeds });
 */

import type { SUT, SutRegistration } from "ppef/types/sut";

import type { DegreePrioritisedExpansionResult } from "../algorithms/traversal/degree-prioritised-expansion.js";
import { type MFASFConfig,MultiFrontierAdaptiveExpansion } from "../algorithms/traversal/multi-frontier-adaptive-expansion.js";
import type { GraphExpander } from "../interfaces/graph-expander.js";

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
	/** Mean path salience (estimated) */
	meanPathSalience: number;
	/** Nodes per salient path (efficiency metric) */
	nodesPerSalientPath: number;
	/** Final phase reached (1, 2, or 3) */
	finalPhase: number;
	/** Discovered paths */
	paths: Array<{ fromSeed: number; toSeed: number; nodes: string[]; salience?: number }>;
	/** Raw expansion result */
	rawResult: DegreePrioritisedExpansionResult;
}

/**
 * SUT registration metadata.
 */
export const registration: SutRegistration = {
	id: "multi-frontier-adaptive-v1.0.0",
	name: "Multi-Frontier Adaptive Salience-Feedback",
	version: "1.0.0",
	role: "primary",
	config: {
		minPaths: 3,
		diversityThreshold: 0.5,
		salienceFeedbackWeight: 1,
		plateauWindowSize: 5,
		plateauThreshold: 0.01,
	} satisfies MFASFConfig,
	tags: ["traversal", "adaptive", "salience", "thesis-algorithm", "mfasf"],
	description: "Three-phase adaptive expansion with salience feedback for high-quality path discovery",
};

/**
 * Create a Multi-Frontier Adaptive Expansion SUT instance.
 *
 * @param config - Optional configuration overrides
 * @returns PPEF-compatible SUT object
 */
export const createSut = (config?: Record<string, unknown>): SUT<TraversalInputs, TraversalResult> => {
	const sutConfig: MFASFConfig = {
		minPaths: (config?.minPaths as number | undefined) ?? 3,
		diversityThreshold: (config?.diversityThreshold as number | undefined) ?? 0.5,
		salienceFeedbackWeight: (config?.salienceFeedbackWeight as number | undefined) ?? 1,
		plateauWindowSize: (config?.plateauWindowSize as number | undefined) ?? 5,
		plateauThreshold: (config?.plateauThreshold as number | undefined) ?? 0.01,
	};

	return {
		id: registration.id,
		get config() {
			return { ...sutConfig };
		},

		/**
		 * Execute multi-frontier adaptive expansion from seed nodes.
		 *
		 * @param inputs - Graph expander and seed nodes
		 * @returns Traversal result with metrics
		 */
		run: async (inputs: TraversalInputs): Promise<TraversalResult> => {
			const { expander, seeds } = inputs;

			try {
				const expansion = new MultiFrontierAdaptiveExpansion(expander, seeds, sutConfig);
				const result = await expansion.run();

				// Access internal phase for metrics
				const finalPhase = expansion["currentPhase"] as number;

				return computeTraversalMetrics(result, finalPhase);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(`Multi-frontier adaptive expansion failed: ${message}`);
			}
		},
	};
};

/**
 * Compute standardized traversal metrics from expansion result.
 *
 * @param result - Raw expansion result
 * @param finalPhase - Final phase reached by algorithm
 * @returns Standardized traversal result
 */
const computeTraversalMetrics = (
	result: DegreePrioritisedExpansionResult,
	finalPhase: number
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

	// Compute hub avoidance
	const lowDegreeCount =
		(result.stats.degreeDistribution.get("1-5") ?? 0) +
		(result.stats.degreeDistribution.get("6-10") ?? 0);
	const hubAvoidance = result.stats.nodesExpanded > 0 ? lowDegreeCount / result.stats.nodesExpanded : 0;

	// Extract salience from paths (if available)
	const pathsWithSalience = result.paths as Array<{ fromSeed: number; toSeed: number; nodes: string[]; salience?: number }>;
	const salienceValues = pathsWithSalience
		.filter((p) => typeof p.salience === "number")
		.map((p) => p.salience as number);

	const meanPathSalience =
		salienceValues.length > 0 ? salienceValues.reduce((a, b) => a + b, 0) / salienceValues.length : 0;

	// Compute nodes per salient path (efficiency metric)
	// Lower is better - fewer nodes explored to find quality paths
	const salientPaths = pathsWithSalience.filter((p) => (p.salience ?? 0) > 0.5);
	const nodesPerSalientPath =
		salientPaths.length > 0 ? result.stats.nodesExpanded / salientPaths.length : result.stats.nodesExpanded;

	return {
		pathsFound: result.paths.length,
		nodesExpanded: result.stats.nodesExpanded,
		edgesTraversed: result.stats.edgesTraversed,
		iterations: result.stats.iterations,
		pathDiversity,
		hubAvoidance,
		meanPathSalience,
		nodesPerSalientPath,
		finalPhase,
		paths: pathsWithSalience,
		rawResult: result,
	};
};
