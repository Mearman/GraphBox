import type { GraphExpander } from "../../interfaces/graph-expander";

/**
 * Result from cross-seed-affinity expansion.
 */
export interface CrossSeedAffinityResult {
	/** Discovered paths (only populated when N >= 2 seeds) */
	paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }>;

	/** Union of all nodes visited by all frontiers */
	sampledNodes: Set<string>;

	/** Set of edges visited during expansion */
	sampledEdges: Set<string>;

	/** Per-frontier visited sets (for diagnostics) */
	visitedPerFrontier: Array<Set<string>>;

	/** Statistics about the expansion */
	stats: CrossSeedAffinityStats;
}

/**
 * Statistics collected during cross-seed-affinity expansion.
 */
export interface CrossSeedAffinityStats {
	/** Total nodes expanded (popped from frontiers) */
	nodesExpanded: number;

	/** Total edges traversed */
	edgesTraversed: number;

	/** Iterations (single node expansions) performed */
	iterations: number;

	/** Breakdown of nodes by degree ranges */
	degreeDistribution: Map<string, number>;

	/** Distribution of frontier visit counts */
	frontierVisitDistribution: Map<number, number>;
}

/**
 * State for a single frontier with priority-based expansion.
 * @internal
 */
interface FrontierState {
	/** Index of this frontier (corresponds to seed index) */
	index: number;

	/** Frontier nodes with computed priorities */
	frontier: Array<{ nodeId: string; priority: number }>;

	/** Set of visited nodes */
	visited: Set<string>;

	/** Parent pointers for path reconstruction */
	parents: Map<string, { parent: string; edge: string }>;
}

/**
 * Cross-Seed-Affinity Bidirectional Expansion
 *
 * Baseline algorithm that prioritises nodes based on their cross-frontier
 * visibility. Nodes visited by multiple frontiers receive lower priority
 * (deferred expansion) relative to their degree, testing whether avoiding
 * "convergence zones" improves path diversity.
 *
 * **Priority Formula**:
 * π(v) = deg(v) / (1 + frontierCount(v))
 *
 * where frontierCount(v) is the number of frontiers that have visited node v.
 *
 * **Key Properties**:
 * - Prioritises low-degree nodes (like degree-prioritised)
 * - Further deprioritises nodes in multiple frontiers' visited sets
 * - Avoids convergence zones where frontiers would naturally meet
 * - Tests hypothesis: "Does deferring shared nodes improve diversity?"
 *
 * **Experimental Purpose**:
 * If cross-seed-affinity achieves better path diversity than simple
 * degree-prioritised expansion, this suggests frontier interaction awareness
 * is important. If not, simple degree ordering suffices.
 *
 * @template T - Type of node data returned by expander
 */
export class CrossSeedAffinityExpansion<T> {
	private readonly frontiers: FrontierState[] = [];
	private readonly paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }> = [];
	private readonly sampledEdges = new Set<string>();
	private readonly frontierVisitCounts = new Map<string, number>();
	private stats: CrossSeedAffinityStats;

	/**
	 * Create a new cross-seed-affinity expansion.
	 *
	 * @param expander - Graph expander providing neighbour access
	 * @param seeds - Array of seed node IDs (N >= 1)
	 * @throws Error if no seeds provided
	 */
	constructor(
		private readonly expander: GraphExpander<T>,
		private readonly seeds: readonly string[]
	) {
		if (seeds.length === 0) {
			throw new Error("At least one seed node is required");
		}

		// Initialize N frontiers, one per seed
		for (const [index, seed] of seeds.entries()) {
			this.frontiers.push({
				index: index,
				frontier: [{ nodeId: seed, priority: 0 }],
				visited: new Set([seed]),
				parents: new Map(),
			});
			// Seeds are visited by their own frontier
			this.frontierVisitCounts.set(seed, 1);
		}

		this.stats = {
			nodesExpanded: 0,
			edgesTraversed: 0,
			iterations: 0,
			degreeDistribution: new Map(),
			frontierVisitDistribution: new Map(),
		};
	}

	/**
	 * Run the expansion to completion.
	 *
	 * Terminates when all frontiers are exhausted (no unexpanded nodes remain).
	 *
	 * @returns Expansion results including paths and sampled subgraph
	 */
	async run(): Promise<CrossSeedAffinityResult> {
		// OPTIMISATION: Only check for path intersections when N >= 2 seeds
		const shouldCheckPaths = this.frontiers.length >= 2;

		// Core loop: priority-based expansion with cross-seed affinity
		while (this.hasNonEmptyFrontier()) {
			this.stats.iterations++;

			// Select next frontier with items (round-robin)
			const activeIndex = this.selectNextFrontier();
			if (activeIndex === -1) break;

			const activeState = this.frontiers[activeIndex];

			// Sort frontier by priority (highest first)
			// Lower degree = higher priority, but penalised by frontier count
			activeState.frontier.sort((a, b) => b.priority - a.priority);

			// Pop highest-priority node
			const item = activeState.frontier.shift();
			if (!item) continue;

			const node = item.nodeId;

			this.stats.nodesExpanded++;
			this.recordDegree(this.expander.getDegree(node));

			// Record frontier visit count for statistics
			const visitCount = this.frontierVisitCounts.get(node) ?? 0;
			const count = this.stats.frontierVisitDistribution.get(visitCount) ?? 0;
			this.stats.frontierVisitDistribution.set(visitCount, count + 1);

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

				// Update frontier visit count
				const currentCount = this.frontierVisitCounts.get(targetId) ?? 0;
				this.frontierVisitCounts.set(targetId, currentCount + 1);

				// Compute cross-seed-affinity priority
				const priority = this.computeCrossSeedAffinityPriority(targetId);

				// Add to frontier with computed priority
				activeState.frontier.push({ nodeId: targetId, priority });

				if (shouldCheckPaths) {
					// Check intersection with ALL other frontiers
					for (let other = 0; other < this.frontiers.length; other++) {
						if (other !== activeIndex && this.frontiers[other].visited.has(targetId)) {
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
		};
	}

	/**
	 * Compute cross-seed-affinity priority for a node.
	 * Priority: π(v) = deg(v) / (1 + frontierCount(v))
	 *
	 * Lower degree = higher base priority (like degree-prioritised).
	 * Nodes in more frontiers get penalised (lower effective priority).
	 *
	 * @param nodeId - Node to compute priority for
	 * @returns Priority value (higher = should expand sooner)
	 * @internal
	 */
	private computeCrossSeedAffinityPriority(nodeId: string): number {
		const degree = this.expander.getDegree(nodeId);
		const frontierCount = this.frontierVisitCounts.get(nodeId) ?? 0;

		// Invert degree so lower degree = higher priority
		// Penalise by frontier count
		return 1 / (degree + 1) / (1 + frontierCount);
	}

	/**
	 * Check if any frontier has unexpanded nodes.
	 * @internal
	 */
	private hasNonEmptyFrontier(): boolean {
		return this.frontiers.some((state) => state.frontier.length > 0);
	}

	/**
	 * Select the next frontier with items (round-robin).
	 * Returns -1 if all frontiers are empty.
	 * @internal
	 */
	private selectNextFrontier(): number {
		for (let index = 0; index < this.frontiers.length; index++) {
			if (this.frontiers[index].frontier.length > 0) {
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
