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

import { SUTRegistry } from "ppef/registry";
import type { SUT, SutRegistration } from "ppef/types/sut";

import type { BidirectionalBFSResult } from "../algorithms/traversal/bidirectional-bfs.js";
import { BidirectionalBFS } from "../algorithms/traversal/bidirectional-bfs.js";
import type { DegreePrioritisedExpansionResult } from "../algorithms/traversal/degree-prioritised-expansion.js";
import { DegreePrioritisedExpansion } from "../algorithms/traversal/degree-prioritised-expansion.js";
import type { OverlapBasedExpansionResult } from "../algorithms/traversal/overlap-based/overlap-result.js";
import { computeNodeSalienceFromRankedPaths,SaliencePrioritisedExpansion } from "../algorithms/traversal/salience-prioritised-expansion.js";
import { FrontierBalancedExpansion } from "../experiments/baselines/frontier-balanced.js";
import { registerOverlapSuts } from "./register-overlap-suts.js";
// Re-export overlap-based SUT registration for convenience
export { OVERLAP_SUT_REGISTRATIONS, overlapSutRegistry, registerOverlapSuts } from "./register-overlap-suts.js";
import { rankPaths } from "../algorithms/pathfinding/path-ranking.js";
import { RandomPriorityExpansion } from "../experiments/baselines/random-priority.js";
import { StandardBfsExpansion } from "../experiments/baselines/standard-bfs.js";
import type { GraphExpander } from "../interfaces/graph-expander.js";

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

	/** Optional underlying graph for algorithms that need full graph access (e.g., path ranking) */
	graph?: import("../algorithms/graph/graph.js").Graph<import("../algorithms/types/graph.js").Node, import("../algorithms/types/graph.js").Edge>;
}

/**
 * Result type for all expansion SUTs.
 *
 * Union type supporting:
 * - DegreePrioritisedExpansionResult (parameter-free frontier exhaustion)
 * - BidirectionalBFSResult (parameterised termination: targetPaths, maxIterations)
 * - OverlapBasedExpansionResult (overlap-based termination)
 */
export type ExpansionResult = DegreePrioritisedExpansionResult | BidirectionalBFSResult | OverlapBasedExpansionResult;

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
	"bidirectional-bfs-v1.0.0": {
		id: "bidirectional-bfs-v1.0.0",
		name: "Bidirectional BFS",
		version: "1.0.0",
		role: "baseline",
		config: {} satisfies { targetPaths?: number; maxIterations?: number; minIterations?: number },
		tags: ["traversal", "bidirectional", "parameterised", "early-termination"],
		description: "Earlier design with parameterised termination (targetPaths, maxIterations, minIterations)",
	},
	"degree-prioritised-v1.0.0": {
		id: "degree-prioritised-v1.0.0",
		name: "Degree-Prioritised Expansion",
		version: "1.0.0",
		role: "primary",
		config: {},
		tags: ["traversal", "bidirectional", "hub-avoidance", "parameter-free"],
		description: "Refined design with parameter-free frontier exhaustion (N≥1 seeds)",
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
	"salience-prioritised-v1.0.0": {
		id: "salience-prioritised-v1.0.0",
		name: "Salience-Prioritised Expansion",
		version: "1.0.0",
		role: "baseline",
		config: {} satisfies { topK?: number },
		tags: ["traversal", "bidirectional", "salience-aware", "parameter-free"],
		description: "Path quality-aware expansion prioritizing nodes by participation in high-salience paths",
	},
};

/**
 * SUT wrapper for BidirectionalBFS.
 *
 * Wraps the earlier design with parameterised termination to conform
 * to the universal SUT interface.
 */
class BidirectionalBfsSUT implements SUT<ExpansionInputs, BidirectionalBFSResult> {
	readonly id = "bidirectional-bfs-v1.0.0";
	readonly config: Readonly<Record<string, unknown>>;

	constructor(config?: Record<string, unknown>) {
		this.config = { ...config };
	}

	async run(inputs: ExpansionInputs): Promise<BidirectionalBFSResult> {
		const { expander, seeds } = inputs;
		// BidirectionalBFS requires exactly 2 seeds
		const seedArray = seeds.length >= 2
			? [seeds[0], seeds[1]] as [string, string]
			: [seeds[0], seeds[0]] as [string, string];

		// Extract termination parameters from config (with defaults)
		const targetPaths = typeof this.config?.targetPaths === "number"
			? this.config.targetPaths
			: 5;
		const maxIterations = typeof this.config?.maxIterations === "number"
			? this.config.maxIterations
			: 100;
		const minIterations = typeof this.config?.minIterations === "number"
			? this.config.minIterations
			: 2;

		const algorithm = new BidirectionalBFS<unknown>(
			expander,
			seedArray[0],
			seedArray[1],
			{ targetPaths, maxIterations, minIterations }
		);
		return algorithm.search();
	}
}

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
 * SUT wrapper for Salience-Prioritised Expansion.
 *
 * **Novel Contribution**: Pre-computes node salience scores from Path Salience ranking
 * and uses them to prioritize expansion toward high-quality paths.
 *
 * This SUT automatically:
 * 1. Runs Path Salience ranking on the graph to find top-K salient paths
 * 2. Computes node participation scores for those paths
 * 3. Uses those scores to drive expansion (higher salience = expanded earlier)
 *
 * **Config**:
 * - topK: Number of top salient paths to use for scoring (default: 10)
 *
 * **Expected Outcome**: Higher salience coverage than degree-prioritised expansion
 * because the expansion naturally gravitates toward nodes that appear in
 * high-quality paths.
 */
class SaliencePrioritisedSUT implements SUT<ExpansionInputs, ExpansionResult> {
	readonly id = "salience-prioritised-v1.0.0";
	readonly config: Readonly<Record<string, unknown>>;

	constructor(config?: Record<string, unknown>) {
		this.config = { ...config };
	}

	async run(inputs: ExpansionInputs): Promise<ExpansionResult> {
		const { expander, seeds, graph } = inputs;
		const topK = typeof this.config?.topK === "number" ? this.config.topK : 10;

		// Get the graph for path ranking
		// Priority: 1) Use provided graph, 2) Call toGraph() if available, 3) Error
		let graphForRanking: import("../algorithms/graph/graph.js").Graph<import("../algorithms/types/graph.js").Node, import("../algorithms/types/graph.js").Edge>;
		if (graph) {
			graphForRanking = graph;
		} else if ("toGraph" in expander && typeof expander.toGraph === "function") {
			graphForRanking = await (expander as unknown as { toGraph: () => Promise<typeof graphForRanking> }).toGraph();
		} else {
			throw new Error("SaliencePrioritisedSUT requires either inputs.graph or expander.toGraph()");
		}

		// Pre-compute salience scores by running Path Salience ranking
		const nodeSalience = new Map<string, number>();

		// Run Path Salience for each seed pair to collect top-K paths
		for (let index = 0; index < seeds.length; index++) {
			for (let index_ = index + 1; index_ < seeds.length; index_++) {
				const result = rankPaths(graphForRanking, seeds[index], seeds[index_], {
					lambda: 0,
					maxPaths: topK * 2, // Get more than needed
					shortestOnly: false,
					traversalMode: "undirected",
				});

				if (result.ok && result.value.some) {
					const ranked = result.value.value;
					// Compute node salience from top-K paths
					const topKPaths = ranked.slice(0, topK);
					const scores = computeNodeSalienceFromRankedPaths(topKPaths);

					// Merge scores (sum across all pairs)
					for (const [node, score] of scores) {
						nodeSalience.set(node, (nodeSalience.get(node) ?? 0) + score);
					}
				}
			}
		}

		// Create and run salience-prioritised expansion
		const algorithm = new SaliencePrioritisedExpansion(expander, seeds, nodeSalience);
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
	// BidirectionalBFS (Earlier design with parameterised termination)
	registry.register(
		SUT_REGISTRATIONS["bidirectional-bfs-v1.0.0"],
		(config?: Record<string, unknown>): SUT<ExpansionInputs, ExpansionResult> => new BidirectionalBfsSUT(config)
	);

	// Degree-Prioritised (Primary - refined design)
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

	// Salience-Prioritised (Baseline - path quality-aware expansion)
	registry.register(
		SUT_REGISTRATIONS["salience-prioritised-v1.0.0"],
		(config?: Record<string, unknown>): SUT<ExpansionInputs, ExpansionResult> => new SaliencePrioritisedSUT(config)
	);

	// Register all 27 overlap-based expansion variants
	registerOverlapSuts(registry);

	return registry;
};

/**
 * Global expansion SUT registry with all algorithms registered.
 */
export const expansionSutRegistry = registerExpansionSuts(new SUTRegistry<ExpansionInputs, ExpansionResult>());
