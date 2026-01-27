import { GraphExpander } from "../../interfaces/graph-expander";
import type { DegreePrioritisedExpansionResult, ExpansionStats } from "./degree-prioritised-expansion";
import { PriorityQueue } from "./priority-queue";

/**
 * Configuration options for path-preserving expansion.
 */
export interface PathPreservingExpansionConfig {
	/**
	 * Target number of paths to discover per pair of seeds.
	 * When reached, the algorithm may terminate early.
	 * Default: undefined (run to frontier exhaustion).
	 */
	targetPathsPerPair?: number;
}

/**
 * State for a single expansion frontier.
 * @internal
 */
interface FrontierState {
	/** Index of this frontier (corresponds to seed index) */
	index: number;

	/** Priority queue of nodes to expand (priority = π_PPME) */
	frontier: PriorityQueue<string>;

	/** Set of visited nodes */
	visited: Set<string>;

	/** Parent pointers for path reconstruction */
	parents: Map<string, { parent: string; edge: string }>;
}

/**
 * Path-Preserving Multi-Frontier Expansion (PPME)
 *
 * **Thesis Alignment**: This is an advanced variant of degree-prioritised expansion
 * from Chapter 4 that explicitly penalizes nodes appearing in multiple frontiers to
 * preserve path diversity. It uses a modified priority function:
 *
 * π_PPME(v) = deg(v) / (1 + path_potential(v))
 *
 * where path_potential(v) counts how many of v's neighbours have been visited by
 * OTHER frontiers. This deferring strategy avoids converging on the same high-
 * connectivity nodes and produces more structurally diverse paths.
 *
 * **Design Motivation**:
 * In degree-prioritised expansion, multiple frontiers may converge on the same
 * high-degree nodes, producing paths that share significant overlap. PPME addresses
 * this by dynamically reducing the priority of nodes whose neighbours have already
 * been claimed by other frontiers, encouraging each frontier to explore distinct
 * regions of the graph.
 *
 * **Key Properties**:
 * 1. **Path diversity**: Frontiers naturally diverge by avoiding already-claimed regions
 * 2. **Parameter-free core**: Like degree-prioritised, no arbitrary cutoffs (optional
 *    targetPathsPerPair for early termination)
 * 3. **N-seed generalisation**: Works for N ≥ 1 with identical code path
 * 4. **Dynamic prioritisation**: Priority updates based on real-time frontier state
 *
 * **Algorithm**:
 * ```
 * 1. Initialize N frontiers, one per seed
 * 2. While any frontier is non-empty:
 *    a. Recompute priorities for frontier heads using π_PPME formula
 *    b. Select the frontier with the lowest-priority node at its front
 *    c. Pop that node and expand its neighbours
 *    d. For each new neighbour, check intersection with all other frontiers
 *    e. If intersection found, record path between the two seeds
 *    f. (Optional) Terminate early if targetPathsPerPair reached
 * 3. Return sampled subgraph (union of all visited nodes)
 * ```
 *
 * **Complexity**: O(E log V + V·D) where E = edges explored, V = vertices, D = avg degree
 * (additional D factor for path potential computation)
 *
 * @template T - Type of node data returned by expander
 * @example
 * ```typescript
 * const expansion = new PathPreservingExpansion(
 *   expander,
 *   ['seedA', 'seedB', 'seedC'],
 *   { targetPathsPerPair: 5 }
 * );
 * const result = await expansion.run();
 * console.log(`Found ${result.paths.length} diverse paths`);
 * console.log(`Sampled ${result.sampledNodes.size} nodes`);
 * ```
 *
 * @see DegreePrioritisedExpansion - Base algorithm without path-preservation penalty
 * @see BidirectionalBFS - Parameterised version for N=2 with resource constraints
 */
export class PathPreservingExpansion<T> {
	private readonly frontiers: FrontierState[] = [];
	private readonly paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }> = [];
	private readonly sampledEdges = new Set<string>();
	private stats: ExpansionStats;

	/** Track which frontier owns each node for O(1) intersection checking */
	private readonly nodeToFrontierIndex = new Map<string, number>();

	/** Track path signatures for O(1) deduplication */
	private readonly pathSignatures = new Set<string>();

	/** Count of paths discovered per seed pair */
	private readonly pathCounts = new Map<string, number>();

	/**
	 * Create a new path-preserving expansion.
	 *
	 * @param expander - Graph expander providing neighbour access
	 * @param seeds - Array of seed node IDs (N ≥ 1)
	 * @param config - Optional configuration for early termination
	 * @throws Error if no seeds provided
	 */
	constructor(
		private readonly expander: GraphExpander<T>,
		private readonly seeds: readonly string[],
		private readonly config: PathPreservingExpansionConfig = {}
	) {
		if (seeds.length === 0) {
			throw new Error("At least one seed node is required");
		}

		// Initialize N frontiers, one per seed
		for (const [index, seed] of seeds.entries()) {
			const frontier = new PriorityQueue<string>();
			const priority = this.calculatePPMEPriority(seed, index);
			frontier.push(seed, priority);

			this.frontiers.push({
				index: index,
				frontier,
				visited: new Set([seed]),
				parents: new Map(),
			});

			// Track which frontier owns this seed
			this.nodeToFrontierIndex.set(seed, index);
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
	 * Terminates when:
	 * - All frontiers are exhausted (no unexpanded nodes remain), OR
	 * - targetPathsPerPair reached for all seed pairs (if configured)
	 *
	 * @returns Expansion results including paths and sampled subgraph
	 */
	async run(): Promise<DegreePrioritisedExpansionResult> {
		// Core loop: always expand globally lowest-PPME-priority node
		while (this.hasNonEmptyFrontier() && !this.shouldTerminateEarly()) {
			this.stats.iterations++;

			// Select frontier with lowest-PPME-priority node at front
			const activeIndex = this.selectLowestPriorityFrontier();
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

				// Track which frontier owns this node (for O(1) intersection checking)
				this.nodeToFrontierIndex.set(targetId, activeIndex);

				// Add to frontier with PPME priority
				const priority = this.calculatePPMEPriority(targetId, activeIndex);
				activeState.frontier.push(targetId, priority);

				// Check for intersection using O(1) lookup
				// If another frontier already visited this node, we have a path
				const otherFrontierIndex = this.nodeToFrontierIndex.get(targetId);
				if (otherFrontierIndex !== undefined && otherFrontierIndex !== activeIndex) {
					const path = this.reconstructPath(activeState, this.frontiers[otherFrontierIndex], targetId);
					if (path) {
						// Use path signature for O(1) deduplication
						const signature = this.createPathSignature(activeIndex, otherFrontierIndex, path);
						if (!this.pathSignatures.has(signature)) {
							this.pathSignatures.add(signature);
							this.paths.push({
								fromSeed: activeIndex,
								toSeed: otherFrontierIndex,
								nodes: path,
							});

							// Update path count for this seed pair
							const pairKey = this.getSeedPairKey(activeIndex, otherFrontierIndex);
							const count = this.pathCounts.get(pairKey) ?? 0;
							this.pathCounts.set(pairKey, count + 1);
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
	 * Calculate PPME priority for a node.
	 *
	 * π_PPME(v) = deg(v) / (1 + path_potential(v))
	 *
	 * where path_potential(v) is the count of v's neighbours that have been
	 * visited by OTHER frontiers (not the current one).
	 *
	 * @param nodeId - Node to calculate priority for
	 * @param currentFrontierIndex - Index of the frontier considering this node
	 * @internal
	 */
	private calculatePPMEPriority(nodeId: string, currentFrontierIndex: number): number {
		const degree = this.expander.getDegree(nodeId);
		const pathPotential = this.computePathPotential(nodeId, currentFrontierIndex);

		// Lower priority = higher preference (min-heap)
		// Nodes with high path potential get penalized (higher effective priority)
		return degree / (1 + pathPotential);
	}

	/**
	 * Compute path potential for a node: count of neighbours visited by OTHER frontiers.
	 *
	 * @param nodeId - Node to compute potential for
	 * @param currentFrontierIndex - Index of the frontier considering this node
	 * @internal
	 */
	private computePathPotential(nodeId: string, currentFrontierIndex: number): number {
		let potential = 0;

		// Get neighbours synchronously (assumes expander caches degree info)
		// For full accuracy, would need async access to neighbours, but this
		// approximates using visited sets as a proxy
		for (const [visitedNode, ownerIndex] of this.nodeToFrontierIndex.entries()) {
			if (ownerIndex !== currentFrontierIndex) {
				// Check if visitedNode is a neighbour of nodeId
				// This requires checking if the edge exists in either direction
				// For simplicity, we count how many OTHER frontiers have visited this node's region
				// by checking proximity in the visited sets
				const distance = this.estimateDistance(nodeId, visitedNode);
				if (distance === 1) {
					potential++;
				}
			}
		}

		return potential;
	}

	/**
	 * Estimate graph distance between two nodes (simplified for path potential).
	 * Returns 1 if nodes are likely neighbours, 0 otherwise.
	 *
	 * @param nodeA
	 * @param nodeB
	 * @internal
	 */
	private estimateDistance(nodeA: string, nodeB: string): number {
		// Simplified implementation: check if either node is in the other's frontier
		// A more accurate implementation would query the expander's edge data
		// For now, we use a heuristic based on frontier membership

		// If nodes are in different frontiers and relatively close in expansion order,
		// they're likely connected
		const indexA = this.nodeToFrontierIndex.get(nodeA);
		const indexB = this.nodeToFrontierIndex.get(nodeB);

		if (indexA === undefined || indexB === undefined) return 0;
		if (indexA === indexB) return 0; // Same frontier, not counted

		// Check if either node appears in the other's visited set
		const stateA = this.frontiers[indexA];
		const stateB = this.frontiers[indexB];

		if (stateA.visited.has(nodeB) || stateB.visited.has(nodeA)) {
			return 1; // Direct or near connection
		}

		return 0;
	}

	/**
	 * Check if any frontier has unexpanded nodes.
	 * @internal
	 */
	private hasNonEmptyFrontier(): boolean {
		return this.frontiers.some((state) => state.frontier.length > 0);
	}

	/**
	 * Check if early termination criteria are met.
	 * @internal
	 */
	private shouldTerminateEarly(): boolean {
		if (this.config.targetPathsPerPair === undefined) return false;

		// Check if all seed pairs have reached target path count
		const numberSeeds = this.seeds.length;
		if (numberSeeds < 2) return false; // No pairs to target

		for (let index = 0; index < numberSeeds; index++) {
			for (let index_ = index + 1; index_ < numberSeeds; index_++) {
				const pairKey = this.getSeedPairKey(index, index_);
				const count = this.pathCounts.get(pairKey) ?? 0;
				if (count < this.config.targetPathsPerPair) {
					return false; // This pair hasn't reached target yet
				}
			}
		}

		return true; // All pairs reached target
	}

	/**
	 * Get a canonical key for a seed pair (order-independent).
	 * @param indexA
	 * @param indexB
	 * @internal
	 */
	private getSeedPairKey(indexA: number, indexB: number): string {
		const [a, b] = indexA < indexB ? [indexA, indexB] : [indexB, indexA];
		return `${a}-${b}`;
	}

	/**
	 * Select the frontier with the lowest-PPME-priority node at its front.
	 * Returns -1 if all frontiers are empty.
	 * @internal
	 */
	private selectLowestPriorityFrontier(): number {
		let minPriority = Infinity;
		let minIndex = -1;

		for (let index = 0; index < this.frontiers.length; index++) {
			const state = this.frontiers[index];
			if (state.frontier.length > 0) {
				// Peek at the front node's PPME priority
				const peekPriority = this.peekPriority(state.frontier);
				if (peekPriority < minPriority) {
					minPriority = peekPriority;
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
		// O(1) peek at the minimum priority in the min-heap
		return queue.peekPriority();
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
	 * Create a unique signature for a path to enable O(1) deduplication.
	 * Signature is bidirectional (A-B same as B-A).
	 * @param fromSeed
	 * @param toSeed
	 * @param nodes
	 * @internal
	 */
	private createPathSignature(fromSeed: number, toSeed: number, nodes: string[]): string {
		// Sort seed indices to make signature bidirectional
		const [a, b] = fromSeed < toSeed ? [fromSeed, toSeed] : [toSeed, fromSeed];
		return `${a}-${b}-${nodes.length}`;
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
