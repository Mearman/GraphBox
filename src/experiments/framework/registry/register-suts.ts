/**
 * SUT Registration for Expansion Algorithms
 *
 * Registers all System Under Test implementations for graph expansion
 * with the global registry. This file should be imported at experiment
 * startup to ensure all SUTs are available.
 *
 * Domain-specific types:
 * - ExpansionInputs: Algorithm-specific inputs (expander + seeds)
 */

import type { DegreePrioritisedExpansionResult } from "../../../algorithms/traversal/degree-prioritised-expansion.js";
import { DegreePrioritisedExpansion } from "../../../algorithms/traversal/degree-prioritised-expansion.js";
import type { GraphExpander } from "../../../interfaces/graph-expander.js";
import { FrontierBalancedExpansion } from "../../baselines/frontier-balanced.js";
import { RandomPriorityExpansion } from "../../baselines/random-priority.js";
import { StandardBfsExpansion } from "../../baselines/standard-bfs.js";
import type { SUT, SutRegistration } from "../types/sut.js";
import { SUTRegistry } from "./sut-registry.js";

/**
 * Domain-specific input type for expansion algorithms.
 *
 * This type lives in the domain-specific registration file, not in the core framework.
 * The core framework remains universal - it doesn't need to know what "expander" or "seeds" mean.
 */
export interface ExpansionInputs {
	/** Graph expander for dynamic graph expansion */
	expander: GraphExpander<unknown>;

	/** Seed node IDs for expansion */
	seeds: string[];
}

/**
 * Result type for all expansion SUTs.
 */
export type ExpansionResult = DegreePrioritisedExpansionResult;

/**
 * Create a typed SUT registry for expansion algorithms.
 *
 * The registry is parameterized with:
 * - TInputs = ExpansionInputs (domain-specific type)
 * - TResult = ExpansionResult (algorithm output)
 */
export type ExpansionSutRegistry = SUTRegistry<ExpansionInputs, ExpansionResult>;

/**
 * SUT registrations for expansion algorithms.
 */
export const SUT_REGISTRATIONS: Record<string, SutRegistration> = {
	"degree-prioritised-v1.0.0": {
		id: "degree-prioritised-v1.0.0",
		name: "Degree-Prioritised Expansion",
		version: "1.0.0",
		role: "primary",
		config: {},
		tags: ["traversal", "bidirectional", "hub-avoidance"],
		description: "Bidirectional BFS with degree-based priority (low degree first)",
	},
	"standard-bfs-v1.0.0": {
		id: "standard-bfs-v1.0.0",
		name: "Standard BFS",
		version: "1.0.0",
		role: "baseline",
		config: {},
		tags: ["traversal", "bidirectional", "baseline"],
		description: "Standard bidirectional BFS with FIFO queue",
	},
	"frontier-balanced-v1.0.0": {
		id: "frontier-balanced-v1.0.0",
		name: "Frontier-Balanced",
		version: "1.0.0",
		role: "baseline",
		config: {},
		tags: ["traversal", "bidirectional", "baseline"],
		description: "Bidirectional BFS with smallest-frontier-first strategy",
	},
	"random-priority-v1.0.0": {
		id: "random-priority-v1.0.0",
		name: "Random Priority",
		version: "1.0.0",
		role: "baseline",
		config: {},
		tags: ["traversal", "bidirectional", "baseline", "null-hypothesis"],
		description: "Bidirectional expansion with random node selection",
	},
};

/**
 * SUT wrapper for Degree-Prioritised Expansion.
 *
 * Wraps the existing DegreePrioritisedExpansion class to conform
 * to the universal SUT interface.
 */
class DegreePrioritisedSUT implements SUT<ExpansionInputs, ExpansionResult> {
	readonly id = "degree-prioritised-v1.0.0";
	readonly config: Readonly<Record<string, unknown>>;

	constructor(config?: Record<string, unknown>) {
		this.config = { ...config };
	}

	async run(inputs: ExpansionInputs): Promise<ExpansionResult> {
		const { expander, seeds } = inputs;
		// Handle N=1 by duplicating seed
		const seedArray = seeds.length >= 2
			? [seeds[0], seeds[1]] as [string, string]
			: [seeds[0], seeds[0]] as [string, string];

		const algorithm = new DegreePrioritisedExpansion(expander, seedArray);
		return algorithm.run();
	}
}

/**
 * SUT wrapper for Standard BFS.
 */
class StandardBfsSUT implements SUT<ExpansionInputs, ExpansionResult> {
	readonly id = "standard-bfs-v1.0.0";
	readonly config: Readonly<Record<string, unknown>>;

	constructor(config?: Record<string, unknown>) {
		this.config = { ...config };
	}

	async run(inputs: ExpansionInputs): Promise<ExpansionResult> {
		const { expander, seeds } = inputs;
		// Handle N=1 by duplicating seed
		const seedArray = seeds.length >= 2
			? seeds
			: [seeds[0], seeds[0]] as [string, string];

		const algorithm = new StandardBfsExpansion(expander, seedArray);
		return algorithm.run();
	}
}

/**
 * SUT wrapper for Frontier-Balanced.
 */
class FrontierBalancedSUT implements SUT<ExpansionInputs, ExpansionResult> {
	readonly id = "frontier-balanced-v1.0.0";
	readonly config: Readonly<Record<string, unknown>>;

	constructor(config?: Record<string, unknown>) {
		this.config = { ...config };
	}

	async run(inputs: ExpansionInputs): Promise<ExpansionResult> {
		const { expander, seeds } = inputs;
		// Handle N=1 by duplicating seed
		const seedArray = seeds.length >= 2
			? seeds
			: [seeds[0], seeds[0]] as [string, string];

		const algorithm = new FrontierBalancedExpansion(expander, seedArray);
		return algorithm.run();
	}
}

/**
 * SUT wrapper for Random Priority.
 */
class RandomPrioritySUT implements SUT<ExpansionInputs, ExpansionResult> {
	readonly id = "random-priority-v1.0.0";
	readonly config: Readonly<Record<string, unknown>>;

	constructor(config?: Record<string, unknown>) {
		this.config = { ...config };
	}

	async run(inputs: ExpansionInputs): Promise<ExpansionResult> {
		const { expander, seeds } = inputs;
		const seed = typeof this.config?.seed === "number" ? this.config.seed : 42;
		// Handle N=1 by duplicating seed
		const seedArray = seeds.length >= 2
			? seeds
			: [seeds[0], seeds[0]] as [string, string];

		const algorithm = new RandomPriorityExpansion(expander, seedArray, seed);
		return algorithm.run();
	}
}

/**
 * Register all expansion SUTs with a registry.
 *
 * @param registry - Registry to populate (defaults to new instance)
 * @returns The populated registry
 */
export const registerExpansionSuts = (
	registry: ExpansionSutRegistry = new SUTRegistry<ExpansionInputs, ExpansionResult>()
): ExpansionSutRegistry => {
	// Degree-Prioritised (Primary)
	registry.register(
		SUT_REGISTRATIONS["degree-prioritised-v1.0.0"],
		(config?: Record<string, unknown>): SUT<ExpansionInputs, ExpansionResult> => new DegreePrioritisedSUT(config)
	);

	// Standard BFS (Baseline)
	registry.register(
		SUT_REGISTRATIONS["standard-bfs-v1.0.0"],
		(config?: Record<string, unknown>): SUT<ExpansionInputs, ExpansionResult> => new StandardBfsSUT(config)
	);

	// Frontier-Balanced (Baseline)
	registry.register(
		SUT_REGISTRATIONS["frontier-balanced-v1.0.0"],
		(config?: Record<string, unknown>): SUT<ExpansionInputs, ExpansionResult> => new FrontierBalancedSUT(config)
	);

	// Random Priority (Baseline / Null Hypothesis)
	registry.register(
		SUT_REGISTRATIONS["random-priority-v1.0.0"],
		(config?: Record<string, unknown>): SUT<ExpansionInputs, ExpansionResult> => new RandomPrioritySUT(config)
	);

	return registry;
};

/**
 * Global expansion SUT registry with all algorithms registered.
 */
export const expansionSutRegistry = registerExpansionSuts(new SUTRegistry<ExpansionInputs, ExpansionResult>());
