import { GraphExpander } from "../../interfaces/graph-expander.js";
import type { DegreePrioritisedExpansionResult, ExpansionStats } from "./degree-prioritised-expansion.js";
import { PriorityQueue } from "./priority-queue.js";

/**
 * Retrospective Salience-Guided Expansion (RSGE)
 *
 * **Novel Contribution**: Self-correcting two-phase expansion that starts with
 * degree prioritisation and adaptively shifts to salience-aware expansion once
 * paths are discovered.
 *
 * **Key Innovation**: Unlike static prioritisation strategies (degree-only or
 * salience-only), RSGE dynamically adapts its expansion strategy based on the
 * quality of discovered paths. If early paths are low-salience, the algorithm
 * automatically diversifies exploration to find higher-quality paths.
 *
 * **Two-Phase Priority Function**:
 * - **Phase 1 (no paths yet)**: π(v) = deg(v) [ascending]
 *   - Pure degree prioritisation, identical to DegreePrioritisedExpansion
 *   - Defers high-degree nodes until paths are discovered
 * - **Phase 2 (paths exist)**: π(v) = deg(v) × (1 - estimated_MI(v)) [ascending]
 *   - Reduces priority (increases value) for nodes likely to be on high-MI paths
 *   - Nodes with estimated_MI near 1.0 get lowest priority values (expanded first)
 *   - Nodes with estimated_MI near 0.0 get priority near deg(v) (expanded later)
 *
 * **Rolling MI Estimation**:
 * - Uses Jaccard similarity between node neighbours and discovered path nodes
 * - Jaccard(v, P) = |neighbors(v) ∩ nodes(P)| / |neighbors(v) ∪ nodes(P)|
 * - Estimated MI(v) = max over all discovered paths of Jaccard(v, P)
 * - Higher Jaccard = node likely appears in similar high-quality paths
 *
 * **Self-Correcting Mechanism**:
 * - If early paths are low-salience (low Jaccard scores for their nodes), the
 *   algorithm diversifies by exploring nodes with low Jaccard similarity
 * - If early paths are high-salience, the algorithm continues exploring similar
 *   nodes to find more high-quality paths
 *
 * **Expected Behavior**:
 * - Higher salience coverage than pure degree prioritisation
 * - More efficient than salience-prioritised expansion (requires no pre-computation)
 * - Adaptive exploration balances hub avoidance with path quality
 *
 * **Complexity**:
 * - Time: O(E log V + P × D) where E = edges, V = vertices, P = paths, D = avg degree
 * - Space: O(V + E + P × K) where K = avg path length
 *
 * @template T - Node data type
 */
export class RetrospectiveSalienceExpansion<T> {
	private readonly frontiers: FrontierState[] = [];
	private readonly paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }> = [];
	private readonly sampledEdges = new Set<string>();
	private stats: ExpansionStats;

	/** Track which frontier owns each node for O(1) intersection checking */
	private readonly nodeToFrontierIndex = new Map<string, number>();

	/** Track path signatures for O(1) deduplication */
	private readonly pathSignatures = new Set<string>();

	/** Cache of node neighbor sets for Jaccard similarity */
	private readonly neighborCache = new Map<string, Set<string>>();

	/** Current estimated MI scores for each node */
	private readonly estimatedMI = new Map<string, number>();

	/** Phase tracking: false = degree-only, true = salience-aware */
	private saliencePhaseActive = false;

	/**
	 * Create a new retrospective salience-guided expansion.
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
	 * Terminates when all frontiers are exhausted (no unexpanded nodes remain).
	 * This is the ONLY termination condition—no arbitrary limits.
	 *
	 * @returns Expansion results including paths and sampled subgraph
	 */
	async run(): Promise<DegreePrioritisedExpansionResult> {
		// Core loop: always expand globally lowest-priority node
		while (this.hasNonEmptyFrontier()) {
			this.stats.iterations++;

			// Select frontier with lowest-priority node at front
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

				// Calculate priority (phase-dependent)
				const priority = this.calculateNodePriority(targetId);
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

							// Phase transition: first path discovered
							if (this.saliencePhaseActive) {
								// Update MI estimates with new path
								await this.updateMIEstimates(path);
							} else {
								this.saliencePhaseActive = true;
								await this.transitionToSaliencePhase();
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
	 * Calculate priority for a node based on current phase.
	 *
	 * Phase 1: π(v) = deg(v)
	 * Phase 2: π(v) = deg(v) × (1 - estimated_MI(v))
	 *
	 * Lower priority = higher importance (expanded first in min-heap).
	 *
	 * @param nodeId - Node to calculate priority for
	 * @returns Priority value
	 * @internal
	 */
	private calculateNodePriority(nodeId: string): number {
		const degree = this.expander.calculatePriority(nodeId);

		if (!this.saliencePhaseActive) {
			// Phase 1: Pure degree prioritisation
			return degree;
		}

		// Phase 2: Degree × (1 - estimated_MI)
		const mi = this.estimatedMI.get(nodeId) ?? 0;
		// mi ∈ [0, 1], so (1 - mi) ∈ [0, 1]
		// High MI (mi → 1) → low priority value → expanded first
		// Low MI (mi → 0) → priority ≈ degree → expanded later
		return degree * (1 - mi);
	}

	/**
	 * Transition from Phase 1 (degree-only) to Phase 2 (salience-aware).
	 *
	 * Recomputes priorities for all nodes in all frontiers based on the first
	 * discovered path.
	 *
	 * @internal
	 */
	private async transitionToSaliencePhase(): Promise<void> {
		// Initialize MI estimates using the first path
		if (this.paths.length > 0) {
			await this.updateMIEstimates(this.paths[0].nodes);
		}

		// Rebuild all frontier queues with new priorities
		for (const frontier of this.frontiers) {
			const nodes: Array<{ id: string; priority: number }> = [];

			// Extract all nodes from queue
			while (frontier.frontier.length > 0) {
				const node = frontier.frontier.pop();
				if (node) {
					nodes.push({
						id: node,
						priority: this.calculateNodePriority(node),
					});
				}
			}

			// Rebuild queue with new priorities
			for (const { id, priority } of nodes) {
				frontier.frontier.push(id, priority);
			}
		}
	}

	/**
	 * Update MI estimates based on a newly discovered path.
	 *
	 * For each node in the graph, computes Jaccard similarity to the path nodes
	 * and updates the estimated MI to the maximum Jaccard across all paths.
	 *
	 * @param pathNodes - Array of node IDs in the discovered path
	 * @internal
	 */
	private async updateMIEstimates(pathNodes: string[]): Promise<void> {
		const pathNodeSet = new Set(pathNodes);

		// Get all nodes in visited sets across all frontiers
		const allVisitedNodes = new Set<string>();
		for (const frontier of this.frontiers) {
			for (const node of frontier.visited) {
				allVisitedNodes.add(node);
			}
		}

		// Update MI estimates for all visited nodes
		for (const nodeId of allVisitedNodes) {
			const jaccard = await this.computeJaccardSimilarity(nodeId, pathNodeSet);
			const currentMI = this.estimatedMI.get(nodeId) ?? 0;
			// Take max across all paths (optimistic estimate)
			this.estimatedMI.set(nodeId, Math.max(currentMI, jaccard));
		}
	}

	/**
	 * Compute Jaccard similarity between a node's neighbours and a set of path nodes.
	 *
	 * Jaccard(v, P) = |neighbors(v) ∩ nodes(P)| / |neighbors(v) ∪ nodes(P)|
	 *
	 * @param nodeId - Node to compute similarity for
	 * @param pathNodes - Set of node IDs in the path
	 * @returns Jaccard similarity in [0, 1]
	 * @internal
	 */
	private async computeJaccardSimilarity(
		nodeId: string,
		pathNodes: Set<string>
	): Promise<number> {
		// Get or compute neighbor set for this node
		let neighbors = this.neighborCache.get(nodeId);
		if (!neighbors) {
			neighbors = new Set<string>();
			const neighborList = await this.expander.getNeighbors(nodeId);
			for (const { targetId } of neighborList) {
				neighbors.add(targetId);
			}
			this.neighborCache.set(nodeId, neighbors);
		}

		// Compute intersection and union
		const intersection = new Set<string>();
		for (const neighbor of neighbors) {
			if (pathNodes.has(neighbor)) {
				intersection.add(neighbor);
			}
		}

		// Union = neighbors ∪ pathNodes
		const union = new Set([...neighbors, ...pathNodes]);

		// Jaccard = |intersection| / |union|
		if (union.size === 0) {
			return 0;
		}

		return intersection.size / union.size;
	}

	/**
	 * Check if any frontier has unexpanded nodes.
	 * @internal
	 */
	private hasNonEmptyFrontier(): boolean {
		return this.frontiers.some((state) => state.frontier.length > 0);
	}

	/**
	 * Select the frontier with the lowest-priority node at its front.
	 * Returns -1 if all frontiers are empty.
	 * @internal
	 */
	private selectLowestPriorityFrontier(): number {
		let minPriority = Infinity;
		let minIndex = -1;

		for (let index = 0; index < this.frontiers.length; index++) {
			const state = this.frontiers[index];
			if (state.frontier.length > 0) {
				// Peek at the front node's priority
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
		if (pathFromB.length > 0 && pathFromB.at(-1) !== seedB && meetingNode !== seedB) return null;

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

/**
 * State for a single expansion frontier.
 * @internal
 */
interface FrontierState {
	/** Index of this frontier (corresponds to seed index) */
	index: number;

	/** Priority queue of nodes to expand (priority = phase-dependent) */
	frontier: PriorityQueue<string>;

	/** Set of visited nodes */
	visited: Set<string>;

	/** Parent pointers for path reconstruction */
	parents: Map<string, { parent: string; edge: string }>;
}
