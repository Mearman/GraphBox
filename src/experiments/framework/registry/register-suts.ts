/**
 * SUT Registration
 *
 * Registers all System Under Test implementations with the global registry.
 * This file should be imported at experiment startup to ensure all SUTs
 * are available.
 */

import type { DegreePrioritisedExpansionResult } from "../../../algorithms/traversal/degree-prioritised-expansion.js";
import { DegreePrioritisedExpansion } from "../../../algorithms/traversal/degree-prioritised-expansion.js";
import type { GraphExpander } from "../../../interfaces/graph-expander.js";
import { FrontierBalancedExpansion } from "../../baselines/frontier-balanced.js";
import { RandomPriorityExpansion } from "../../baselines/random-priority.js";
import { StandardBfsExpansion } from "../../baselines/standard-bfs.js";
import type { SutRegistration } from "../types/sut.js";
import { SUTRegistry } from "./sut-registry.js";

/**
 * Create a typed SUT registry for GraphBox expansion algorithms.
 */
export type ExpansionSutRegistry = SUTRegistry<GraphExpander<unknown>, DegreePrioritisedExpansionResult>;

/**
 * SUT registrations for GraphBox algorithms.
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
 * Register all expansion SUTs with a registry.
 *
 * @param registry - Registry to populate (defaults to global)
 * @returns The populated registry
 */
export const registerExpansionSuts = (registry: ExpansionSutRegistry = new SUTRegistry()): ExpansionSutRegistry => {
	// Degree-Prioritised (Primary)
	registry.register(SUT_REGISTRATIONS["degree-prioritised-v1.0.0"], (expander, seeds) => {
		const seedArray = seeds.length >= 2
			? [seeds[0], seeds[1]] as [string, string]
			: [seeds[0], seeds[0]] as [string, string];
		return new DegreePrioritisedExpansion(expander, seedArray);
	});

	// Standard BFS (Baseline)
	registry.register(SUT_REGISTRATIONS["standard-bfs-v1.0.0"], (expander, seeds) => {
		// Handle N=1 by duplicating seed (consistent with degree-prioritised)
		const seedArray = seeds.length >= 2
			? seeds as string[]
			: [seeds[0], seeds[0]] as [string, string];
		return new StandardBfsExpansion(expander, seedArray);
	});

	// Frontier-Balanced (Baseline)
	registry.register(SUT_REGISTRATIONS["frontier-balanced-v1.0.0"], (expander, seeds) => {
		// Handle N=1 by duplicating seed (consistent with degree-prioritised)
		const seedArray = seeds.length >= 2
			? seeds as string[]
			: [seeds[0], seeds[0]] as [string, string];
		return new FrontierBalancedExpansion(expander, seedArray);
	});

	// Random Priority (Baseline / Null Hypothesis)
	registry.register(SUT_REGISTRATIONS["random-priority-v1.0.0"], (expander, seeds, config) => {
		// Handle N=1 by duplicating seed (consistent with degree-prioritised)
		const seed = typeof config?.seed === "number" ? config.seed : 42;
		const seedArray = seeds.length >= 2
			? seeds as string[]
			: [seeds[0], seeds[0]] as [string, string];
		return new RandomPriorityExpansion(expander, seedArray, seed);
	});

	return registry;
};

/**
 * Global expansion SUT registry with all algorithms registered.
 */
export const expansionSutRegistry = registerExpansionSuts(new SUTRegistry());
