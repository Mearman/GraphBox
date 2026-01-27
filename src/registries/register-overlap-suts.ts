/**
 * SUT Registration for Overlap-Based Expansion Algorithms
 *
 * Registers all 27 overlap-based expansion variants with the global registry.
 * Each variant represents a unique combination of:
 * - Overlap Detection Strategy (3: physical, threshold, sphere)
 * - Termination Strategy (3: fullpair, transitive, converge)
 * - Between-Graph Strategy (3: minimal, truncated, salience)
 *
 * SUT IDs follow the pattern: overlap-{detection}-{termination}-{betweenGraph}-v1.0.0
 *
 * Example: overlap-physical-fullpair-minimal-v1.0.0
 */

import { SUTRegistry } from "ppef/registry";
import type { SUT, SutRegistration } from "ppef/types/sut";

import {
	CommonConvergenceStrategy,
	CoverageThresholdStrategy,
	FullPairwiseStrategy,
	MinimalPathsStrategy,
	PhysicalMeetingStrategy,
	SaliencePreservingStrategy,
	SphereIntersectionStrategy,
	ThresholdSharingStrategy,
	TransitiveConnectivityStrategy,
	TruncatedComponentStrategy,
} from "../algorithms/traversal/overlap-based/index.js";
import { OverlapBasedExpansion } from "../algorithms/traversal/overlap-based/overlap-based-expansion.js";
import type { OverlapBasedExpansionResult } from "../algorithms/traversal/overlap-based/overlap-result.js";
import type { ExpansionInputs, ExpansionResult } from "./register-suts.js";

/**
 * Extend ExpansionResult to include OverlapBasedExpansionResult.
 */
export type OverlapExpansionResult = ExpansionResult | OverlapBasedExpansionResult;

/**
 * Overlap expansion SUT registry type.
 */
export type OverlapExpansionSutRegistry = SUTRegistry<ExpansionInputs, OverlapExpansionResult>;

/**
 * Strategy combination for overlap-based expansion.
 */
interface StrategyCombination {
	overlapDetection: "physical" | "threshold" | "sphere";
	termination: "fullpair" | "transitive" | "converge";
	betweenGraph: "minimal" | "truncated" | "salience";
}

/**
 * All 27 strategy combinations (3 × 3 × 3).
 */
const STRATEGY_COMBINATIONS: StrategyCombination[] = [
	// Physical meeting combinations
	{ overlapDetection: "physical", termination: "fullpair", betweenGraph: "minimal" },
	{ overlapDetection: "physical", termination: "fullpair", betweenGraph: "truncated" },
	{ overlapDetection: "physical", termination: "fullpair", betweenGraph: "salience" },
	{ overlapDetection: "physical", termination: "transitive", betweenGraph: "minimal" },
	{ overlapDetection: "physical", termination: "transitive", betweenGraph: "truncated" },
	{ overlapDetection: "physical", termination: "transitive", betweenGraph: "salience" },
	{ overlapDetection: "physical", termination: "converge", betweenGraph: "minimal" },
	{ overlapDetection: "physical", termination: "converge", betweenGraph: "truncated" },
	{ overlapDetection: "physical", termination: "converge", betweenGraph: "salience" },

	// Threshold sharing combinations
	{ overlapDetection: "threshold", termination: "fullpair", betweenGraph: "minimal" },
	{ overlapDetection: "threshold", termination: "fullpair", betweenGraph: "truncated" },
	{ overlapDetection: "threshold", termination: "fullpair", betweenGraph: "salience" },
	{ overlapDetection: "threshold", termination: "transitive", betweenGraph: "minimal" },
	{ overlapDetection: "threshold", termination: "transitive", betweenGraph: "truncated" },
	{ overlapDetection: "threshold", termination: "transitive", betweenGraph: "salience" },
	{ overlapDetection: "threshold", termination: "converge", betweenGraph: "minimal" },
	{ overlapDetection: "threshold", termination: "converge", betweenGraph: "truncated" },
	{ overlapDetection: "threshold", termination: "converge", betweenGraph: "salience" },

	// Sphere intersection combinations
	{ overlapDetection: "sphere", termination: "fullpair", betweenGraph: "minimal" },
	{ overlapDetection: "sphere", termination: "fullpair", betweenGraph: "truncated" },
	{ overlapDetection: "sphere", termination: "fullpair", betweenGraph: "salience" },
	{ overlapDetection: "sphere", termination: "transitive", betweenGraph: "minimal" },
	{ overlapDetection: "sphere", termination: "transitive", betweenGraph: "truncated" },
	{ overlapDetection: "sphere", termination: "transitive", betweenGraph: "salience" },
	{ overlapDetection: "sphere", termination: "converge", betweenGraph: "minimal" },
	{ overlapDetection: "sphere", termination: "converge", betweenGraph: "truncated" },
	{ overlapDetection: "sphere", termination: "converge", betweenGraph: "salience" },
];

/**
 * Generate SUT ID from strategy combination.
 * @param combination
 */
const getSutId = (combination: StrategyCombination): string => `overlap-${combination.overlapDetection}-${combination.termination}-${combination.betweenGraph}-v1.0.0`;

/**
 * Generate SUT name from strategy combination.
 * @param combination
 */
const getSutName = (combination: StrategyCombination): string => {
	const detectionNames = {
		physical: "Physical Meeting",
		threshold: "Threshold Sharing",
		sphere: "Sphere Intersection",
	};
	const terminationNames = {
		fullpair: "Full Pairwise",
		transitive: "Transitive Connectivity",
		converge: "Common Convergence",
	};
	const betweenGraphNames = {
		minimal: "Minimal Paths",
		truncated: "Truncated Component",
		salience: "Salience Preserving",
	};

	return `Overlap: ${detectionNames[combination.overlapDetection]} + ${terminationNames[combination.termination]} + ${betweenGraphNames[combination.betweenGraph]}`;
};

/**
 * Generate SUT registration from strategy combination.
 * @param combination
 */
const createSutRegistration = (combination: StrategyCombination): SutRegistration => ({
	id: getSutId(combination),
	name: getSutName(combination),
	version: "1.0.0",
	role: "baseline" as const,
	config: {},
	tags: [
		"overlap-based",
		combination.overlapDetection,
		combination.termination,
		combination.betweenGraph,
	],
	description: `Overlap-based expansion with ${combination.overlapDetection} overlap detection, ${combination.termination} termination, and ${combination.betweenGraph} between-graph extraction`,
});

/**
 * Create overlap detection strategy instance.
 * @param type
 */
const createOverlapDetectionStrategy = (type: StrategyCombination["overlapDetection"]) => {
	switch (type) {
		case "physical": {
			return new PhysicalMeetingStrategy();
		}
		case "threshold": {
			return new ThresholdSharingStrategy();
		}
		case "sphere": {
			return new SphereIntersectionStrategy();
		}
	}
};

/**
 * Create termination strategy instance.
 * @param type
 */
const createTerminationStrategy = (type: StrategyCombination["termination"]) => {
	switch (type) {
		case "fullpair": {
			return new FullPairwiseStrategy();
		}
		case "transitive": {
			return new TransitiveConnectivityStrategy();
		}
		case "converge": {
			return new CommonConvergenceStrategy();
		}
	}
};

/**
 * Create between-graph strategy instance.
 * @param type
 */
const createBetweenGraphStrategy = (type: StrategyCombination["betweenGraph"]) => {
	switch (type) {
		case "minimal": {
			return new MinimalPathsStrategy();
		}
		case "truncated": {
			return new TruncatedComponentStrategy();
		}
		case "salience": {
			return new SaliencePreservingStrategy();
		}
	}
};

/**
 * SUT wrapper class factory for overlap-based expansion.
 *
 * Creates a SUT wrapper class for a specific strategy combination.
 * @param combination
 */
const createOverlapSutClass = (combination: StrategyCombination): new (
	config?: Record<string, unknown>
) => SUT<ExpansionInputs, OverlapExpansionResult> => {
	const overlapDetection = createOverlapDetectionStrategy(combination.overlapDetection);
	const termination = createTerminationStrategy(combination.termination);
	const betweenGraph = createBetweenGraphStrategy(combination.betweenGraph);
	const n1Handling = new CoverageThresholdStrategy();
	const sutId = getSutId(combination);

	return class implements SUT<ExpansionInputs, OverlapExpansionResult> {
		readonly id = sutId;
		readonly config: Readonly<Record<string, unknown>>;

		constructor(config?: Record<string, unknown>) {
			this.config = { ...config };
		}

		async run(inputs: ExpansionInputs): Promise<OverlapExpansionResult> {
			const { expander, seeds } = inputs;

			// Build OverlapBasedExpansion config
			const overlapConfig = {
				overlapDetection,
				termination,
				n1Handling,
				betweenGraph,
				maxIterations: typeof this.config?.maxIterations === "number"
					? this.config.maxIterations
					: 10_000, // Default limit to prevent infinite loops
				totalNodes: typeof this.config?.totalNodes === "number"
					? this.config.totalNodes
					: undefined,
			};

			const algorithm = new OverlapBasedExpansion(expander, seeds, overlapConfig);
			return algorithm.run();
		}
	};
};

/**
 * SUT registrations for all 27 overlap-based variants.
 */
export const OVERLAP_SUT_REGISTRATIONS: Record<string, SutRegistration> = {};

// Generate all 27 registrations
for (const combination of STRATEGY_COMBINATIONS) {
	const registration = createSutRegistration(combination);
	OVERLAP_SUT_REGISTRATIONS[registration.id] = registration;
}

/**
 * Register all overlap-based expansion SUTs with a registry.
 *
 * @param registry - Registry to populate (defaults to new instance)
 * @returns The populated registry
 */
export const registerOverlapSuts = (
	registry: OverlapExpansionSutRegistry = new SUTRegistry<ExpansionInputs, OverlapExpansionResult>()
): OverlapExpansionSutRegistry => {
	// Register all 27 variants
	for (const combination of STRATEGY_COMBINATIONS) {
		const registration = createSutRegistration(combination);
		const SutClass = createOverlapSutClass(combination);

		registry.register(
			registration,
			(config?: Record<string, unknown>): SUT<ExpansionInputs, OverlapExpansionResult> => new SutClass(config)
		);
	}

	return registry;
};

/**
 * Global overlap expansion SUT registry with all 27 variants registered.
 */
export const overlapSutRegistry = registerOverlapSuts(
	new SUTRegistry<ExpansionInputs, OverlapExpansionResult>()
);
