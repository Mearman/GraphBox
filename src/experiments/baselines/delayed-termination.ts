import type { GraphExpander } from "../../interfaces/graph-expander";

/**
 * Result from delayed-termination expansion.
 */
export interface DelayedTerminationResult {
	/** Discovered paths (only populated when N >= 2 seeds) */
	paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }>;

	/** Union of all nodes visited by all frontiers */
	sampledNodes: Set<string>;

	/** Set of edges visited during expansion */
	sampledEdges: Set<string>;

	/** Per-frontier visited sets (for diagnostics) */
	visitedPerFrontier: Array<Set<string>>;

	/** Statistics about the expansion */
	stats: DelayedTerminationStats;

	/** Map from node ID to the iteration at which it was first discovered */
	nodeDiscoveryIteration: Map<string, number>;
}

/**
 * Statistics collected during delayed-termination expansion.
 */
export interface DelayedTerminationStats {
	/** Total nodes expanded (popped from frontiers) */
	nodesExpanded: number;

	/** Total edges traversed */
	edgesTraversed: number;

	/** Iterations (single node expansions) performed */
	iterations: number;

	/** Breakdown of nodes by degree ranges */
	degreeDistribution: Map<string, number>;

	/** Iteration at which first overlap was detected */
	firstOverlapIteration: number;

	/** Total additional iterations after first overlap */
	delayedIterations: number;
}

/**
 * Configuration for delayed termination.
 */
export interface DelayedTerminationConfig {
	/** Number of additional iterations after first overlap (default: 100) */
	delayIterations: number;
}

/**
 * State for a single frontier.
 * @internal
 */
interface FrontierState {
	/** Index of this frontier (corresponds to seed index) */
	index: number;

	/** Queue of nodes to expand (FIFO) */
	queue: string[];

	/** Set of visited nodes */
	visited: Set<string>;

	/** Parent pointers for path reconstruction */
	parents: Map<string, { parent: string; edge: string }>;
}

/**
 * Delayed-Termination Bidirectional BFS
 *
 * Extends overlap-based termination by continuing expansion for N additional
 * iterations after the first overlap is detected. This baseline tests whether
 * the degree-prioritised algorithm's benefits come from deferred termination
 * rather than the degree heuristic itself.
 *
 * **Key Properties**:
 * - FIFO expansion order (standard BFS)
 * - Detects first overlap between any two frontiers
 * - Continues for N additional iterations after overlap
 * - Tests hypothesis: "Does delayed termination alone improve diversity?"
 *
 * **Experimental Purpose**:
 * If delayed-termination BFS achieves similar path diversity to degree-prioritised
 * expansion, this suggests termination timing (not degree ordering) drives diversity.
 * If degree-prioritised still outperforms delayed BFS, the degree heuristic provides
 * value beyond simply deferring termination.
 *
 * @template T - Type of node data returned by expander
 */
export class DelayedTerminationExpansion<T> {
	private readonly frontiers: FrontierState[] = [];
	private readonly paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }> = [];
	private readonly sampledEdges = new Set<string>();
	private readonly nodeDiscoveryIteration = new Map<string, number>();
	private stats: DelayedTerminationStats;
	private firstOverlapIteration = -1;
	private remainingDelayIterations: number;

	/**
	 * Create a new delayed-termination expansion.
	 *
	 * @param expander - Graph expander providing neighbour access
	 * @param seeds - Array of seed node IDs (N >= 1)
	 * @param config - Configuration for delay iterations
	 * @throws Error if no seeds provided
	 */
	constructor(
		private readonly expander: GraphExpander<T>,
		private readonly seeds: readonly string[],
		private readonly config: DelayedTerminationConfig = { delayIterations: 100 }
	) {
		if (seeds.length === 0) {
			throw new Error("At least one seed node is required");
		}

		this.remainingDelayIterations = config.delayIterations;

		// Initialize N frontiers, one per seed
		for (const [index, seed] of seeds.entries()) {
			this.frontiers.push({
				index: index,
				queue: [seed],
				visited: new Set([seed]),
				parents: new Map(),
			});
			this.nodeDiscoveryIteration.set(seed, 0);
		}

		this.stats = {
			nodesExpanded: 0,
			edgesTraversed: 0,
			iterations: 0,
			degreeDistribution: new Map(),
			firstOverlapIteration: -1,
			delayedIterations: 0,
		};
	}

	/**
	 * Run the expansion to completion.
	 *
	 * Terminates when delay iterations are exhausted after first overlap,
	 * or when all frontiers are exhausted (whichever comes first).
	 *
	 * @returns Expansion results including paths and sampled subgraph
	 */
	async run(): Promise<DelayedTerminationResult> {
		// OPTIMISATION: Only check for path intersections when N >= 2 seeds
		const shouldCheckPaths = this.frontiers.length >= 2;

		// Core loop: BFS expansion with delayed termination
		while (this.hasNonEmptyFrontier()) {
			this.stats.iterations++;

			// Check if we should terminate due to delay exhaustion
			if (this.firstOverlapIteration !== -1) {
				if (this.remainingDelayIterations === 0) {
					break;
				}
				this.remainingDelayIterations--;
				this.stats.delayedIterations++;
			}

			// Select next frontier with items (round-robin)
			const activeIndex = this.selectNextFrontier();
			if (activeIndex === -1) break;

			const activeState = this.frontiers[activeIndex];
			const node = activeState.queue.shift();
			if (!node) continue;

			this.stats.nodesExpanded++;
			this.recordDegree(this.expander.getDegree(node));

			// Expand this node's neighbours
			const neighbors = await this.expander.getNeighbors(node);

			for (const { targetId, relationshipType } of neighbors) {
				// Skip if already visited by this frontier
				if (activeState.visited.has(targetId)) continue;

				this.stats.edgesTraversed++;

				// Record edge in output
				this.expander.addEdge(node, targetId, relationshipType);
				const edgeKey = `${node}->${targetId}`;
				this.sampledEdges.add(edgeKey);

				// Mark as visited and set parent for this frontier
				activeState.visited.add(targetId);
				activeState.parents.set(targetId, { parent: node, edge: relationshipType });

				if (!this.nodeDiscoveryIteration.has(targetId)) {
					this.nodeDiscoveryIteration.set(targetId, this.stats.iterations);
				}

				// Add to queue (FIFO - end of queue)
				activeState.queue.push(targetId);

				if (shouldCheckPaths) {
					// Check intersection with ALL other frontiers
					for (let other = 0; other < this.frontiers.length; other++) {
						if (other !== activeIndex && this.frontiers[other].visited.has(targetId)) {
							// Record first overlap detection
							if (this.firstOverlapIteration === -1) {
								this.firstOverlapIteration = this.stats.iterations;
								this.stats.firstOverlapIteration = this.stats.iterations;
							}

							const path = this.reconstructPath(activeState, this.frontiers[other], targetId);
							if (path && !this.pathExists(activeIndex, other, path)) {
								this.paths.push({
									fromSeed: activeIndex,
									toSeed: other,
									nodes: path,
								});
							}
						}
					}
				}
			}
		}

		// Compute union of all visited sets
		const sampledNodes = new Set<string>();
		const visitedPerFrontier: Array<Set<string>> = [];
		for (const state of this.frontiers) {
			for (const node of state.visited) {
				sampledNodes.add(node);
			}
			visitedPerFrontier.push(new Set(state.visited));
		}

		return {
			paths: this.paths,
			sampledNodes,
			sampledEdges: this.sampledEdges,
			visitedPerFrontier,
			stats: this.stats,
			nodeDiscoveryIteration: this.nodeDiscoveryIteration,
		};
	}

	/**
	 * Check if any frontier has unexpanded nodes.
	 * @internal
	 */
	private hasNonEmptyFrontier(): boolean {
		return this.frontiers.some((state) => state.queue.length > 0);
	}

	/**
	 * Select the next frontier with items (round-robin).
	 * Returns -1 if all frontiers are empty.
	 * @internal
	 */
	private selectNextFrontier(): number {
		for (let index = 0; index < this.frontiers.length; index++) {
			if (this.frontiers[index].queue.length > 0) {
				return index;
			}
		}
		return -1;
	}

	/**
	 * Reconstruct path from meeting point between two frontiers.
	 * @param stateA
	 * @param stateB
	 * @param meetingNode
	 * @internal
	 */
	private reconstructPath(
		stateA: FrontierState,
		stateB: FrontierState,
		meetingNode: string
	): string[] | null {
		const pathFromA: string[] = [];
		const pathFromB: string[] = [];

		// Trace back from meeting point to seed A
		let current: string | undefined = meetingNode;
		while (current !== undefined) {
			pathFromA.unshift(current);
			const parent = stateA.parents.get(current);
			current = parent?.parent;
		}

		// Trace back from meeting point to seed B (excluding meeting node)
		current = meetingNode;
		let parentInfo = stateB.parents.get(current);
		while (parentInfo) {
			pathFromB.push(parentInfo.parent);
			parentInfo = stateB.parents.get(parentInfo.parent);
		}

		// Validate path connects seeds
		const seedA = this.seeds[stateA.index];
		const seedB = this.seeds[stateB.index];

		if (pathFromA[0] !== seedA) return null;
		if (pathFromB.length > 0 && pathFromB.at(-1) !== seedB && meetingNode !== seedB) return null;

		return [...pathFromA, ...pathFromB];
	}

	/**
	 * Check if an equivalent path already exists.
	 * @param fromSeed
	 * @param toSeed
	 * @param nodes
	 * @internal
	 */
	private pathExists(fromSeed: number, toSeed: number, nodes: string[]): boolean {
		return this.paths.some(
			(p) =>
				((p.fromSeed === fromSeed && p.toSeed === toSeed) ||
          (p.fromSeed === toSeed && p.toSeed === fromSeed)) &&
        p.nodes.length === nodes.length &&
        (p.nodes.every((n, index) => n === nodes[index]) ||
          p.nodes.every((n, index) => n === nodes[nodes.length - 1 - index]))
		);
	}

	/**
	 * Record degree in distribution histogram.
	 * @param degree
	 * @internal
	 */
	private recordDegree(degree: number): void {
		const bucket = this.getDegreeBucket(degree);
		const count = this.stats.degreeDistribution.get(bucket) ?? 0;
		this.stats.degreeDistribution.set(bucket, count + 1);
	}

	/**
	 * Get histogram bucket for a degree value.
	 * @param degree
	 * @internal
	 */
	private getDegreeBucket(degree: number): string {
		if (degree <= 5) return "1-5";
		if (degree <= 10) return "6-10";
		if (degree <= 50) return "11-50";
		if (degree <= 100) return "51-100";
		if (degree <= 500) return "101-500";
		if (degree <= 1000) return "501-1000";
		return "1000+";
	}
}
