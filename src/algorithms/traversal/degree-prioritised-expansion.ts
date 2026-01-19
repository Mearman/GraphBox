import { GraphExpander } from "../../interfaces/graph-expander";
import { PriorityQueue } from "./priority-queue";

/**
 * Result from degree-prioritised expansion.
 */
export interface DegreePrioritisedExpansionResult {
	/** Discovered paths (only populated when N ≥ 2 seeds) */
	paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }>;

	/** Union of all nodes visited by all frontiers */
	sampledNodes: Set<string>;

	/** Set of edges visited during expansion */
	sampledEdges: Set<string>;

	/** Per-frontier visited sets (for diagnostics) */
	visitedPerFrontier: Array<Set<string>>;

	/** Statistics about the expansion */
	stats: ExpansionStats;
}

/**
 * Statistics collected during expansion.
 */
export interface ExpansionStats {
	/** Total nodes expanded (popped from frontiers) */
	nodesExpanded: number;

	/** Total edges traversed */
	edgesTraversed: number;

	/** Iterations (single node expansions) performed */
	iterations: number;

	/** Breakdown of nodes by degree ranges */
	degreeDistribution: Map<string, number>;
}

/**
 * State for a single expansion frontier.
 * @internal
 */
interface FrontierState {
	/** Index of this frontier (corresponds to seed index) */
	index: number;

	/** Priority queue of nodes to expand (priority = degree) */
	frontier: PriorityQueue<string>;

	/** Set of visited nodes */
	visited: Set<string>;

	/** Parent pointers for path reconstruction */
	parents: Map<string, { parent: string; edge: string }>;
}

/**
 * Degree-Prioritised Bidirectional Expansion
 *
 * **Thesis Alignment**: This is the primary implementation of the seed-bounded
 * sampling algorithm described in Chapter 4 of the thesis. It embodies the
 * parameter-free design with implicit termination via frontier exhaustion.
 *
 * **Design Relationship**:
 * - BidirectionalBFS: Earlier design, N=2 only, has termination parameters (targetPaths, maxIterations)
 * - DegreePrioritisedExpansion: Refined design (this file), N≥1 with identical code path, parameter-free
 *
 * Use this implementation when:
 * - Representative sampling of graph structure is required
 * - Evaluation dataset construction demands bias-free samples
 * - N≥1 seed nodes need to be supported
 * - Termination should be determined by graph structure, not arbitrary limits
 *
 * For production pathfinding with resource constraints, consider BidirectionalBFS instead.
 *
 * A unified algorithm for representative graph sampling between N ≥ 1 seed nodes.
 * Uses node degree as priority (low degree = high priority) to explore peripheral
 * routes before hub-dominated paths.
 *
 * **Key Design Properties**:
 * 1. **Parameter-free termination**: No arbitrary limits on nodes, edges, or iterations.
 *    The sole termination condition is structural: all frontiers exhausted.
 * 2. **N-seed generalisation**: Single algorithm handles N=1 (ego-network), N=2
 *    (bidirectional), and N≥3 (multi-frontier) with identical code path.
 * 3. **Emergent behaviour**: Different behaviours for different N values emerge
 *    naturally from the same loop—no conditional branching based on seed count.
 * 4. **Degree prioritisation**: Always expands the globally lowest-degree node
 *    across all frontiers, naturally avoiding hub explosion.
 *
 * **Algorithm**:
 * ```
 * 1. Initialize N frontiers, one per seed
 * 2. While any frontier is non-empty:
 *    a. Select the frontier with the lowest-degree node at its front
 *    b. Pop that node and expand its neighbours
 *    c. For each new neighbour, check intersection with all other frontiers
 *    d. If intersection found, record path between the two seeds
 * 3. Return sampled subgraph (union of all visited nodes)
 * ```
 *
 * **Complexity**: O(E log V) where E = edges explored, V = vertices
 *
 * @template T - Type of node data returned by expander
 * @example
 * ```typescript
 * const expansion = new DegreePrioritisedExpansion(expander, ['seedA', 'seedB']);
 * const result = await expansion.run();
 * console.log(`Found ${result.paths.length} paths`);
 * console.log(`Sampled ${result.sampledNodes.size} nodes`);
 * ```
 *
 * @see BidirectionalBFS - Parameterised version for N=2 with resource constraints
 */
export class DegreePrioritisedExpansion<T> {
	private readonly frontiers: FrontierState[] = [];
	private readonly paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }> = [];
	private readonly sampledEdges = new Set<string>();
	private stats: ExpansionStats;

	/**
	 * Create a new degree-prioritised expansion.
	 *
	 * @param expander - Graph expander providing neighbour access
	 * @param seeds - Array of seed node IDs (N ≥ 1)
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
			const frontier = new PriorityQueue<string>();
			const priority = expander.calculatePriority(seed);
			frontier.push(seed, priority);

			this.frontiers.push({
				index: index,
				frontier,
				visited: new Set([seed]),
				parents: new Map(),
			});
		}

		this.stats = {
			nodesExpanded: 0,
			edgesTraversed: 0,
			iterations: 0,
			degreeDistribution: new Map(),
		};
	}

	/**
	 * Run the expansion to completion.
	 *
	 * Terminates when all frontiers are exhausted (no unexpanded nodes remain).
	 * This is the ONLY termination condition—no arbitrary limits.
	 *
	 * @returns Expansion results including paths and sampled subgraph
	 */
	async run(): Promise<DegreePrioritisedExpansionResult> {
		// Core loop: always expand globally lowest-degree node
		while (this.hasNonEmptyFrontier()) {
			this.stats.iterations++;

			// Select frontier with lowest-degree node at front
			const activeIndex = this.selectLowestDegreeFrontier();
			if (activeIndex === -1) break; // Safety check (should not happen)

			const activeState = this.frontiers[activeIndex];
			const node = activeState.frontier.pop();
			if (!node) continue; // Safety check

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

				// Add to frontier with thesis priority as priority
				const priority = this.expander.calculatePriority(targetId);
				activeState.frontier.push(targetId, priority);

				// Check intersection with ALL other frontiers (N ≥ 2 only)
				// This loop naturally handles all N without branching:
				// - N=1: Loop iterates zero times (no other frontiers exist) → no paths
				// - N=2: Loop checks the one other frontier → bidirectional path detection
				// - N≥3: Loop checks all other frontiers → multi-seed path detection
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
	 * Check if any frontier has unexpanded nodes.
	 * @internal
	 */
	private hasNonEmptyFrontier(): boolean {
		return this.frontiers.some((state) => state.frontier.length > 0);
	}

	/**
	 * Select the frontier with the lowest-degree node at its front.
	 * Returns -1 if all frontiers are empty.
	 * @internal
	 */
	private selectLowestDegreeFrontier(): number {
		let minDegree = Infinity;
		let minIndex = -1;

		for (let index = 0; index < this.frontiers.length; index++) {
			const state = this.frontiers[index];
			if (state.frontier.length > 0) {
				// Peek at the front node's degree (priority queue stores by degree)
				const peekDegree = this.peekPriority(state.frontier);
				if (peekDegree < minDegree) {
					minDegree = peekDegree;
					minIndex = index;
				}
			}
		}

		return minIndex;
	}

	/**
	 * Peek at the priority of the front item without removing it.
	 * @param queue
	 * @internal
	 */
	private peekPriority(queue: PriorityQueue<string>): number {
		// The priority queue is a min-heap, so the front item has minimum priority.
		// We use calculatePriority to ensure consistent prioritization across the algorithm.
		for (const item of queue) {
			return this.expander.calculatePriority(item);
		}
		return Infinity;
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

		// Trace back from meeting point to seed B (excluding meeting node to avoid duplication)
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
		if (pathFromB.length > 0 && pathFromB.at(-1) !== seedB && // Path from B should end at seed B, or be empty if meeting node is seed B
      meetingNode !== seedB) return null;

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
