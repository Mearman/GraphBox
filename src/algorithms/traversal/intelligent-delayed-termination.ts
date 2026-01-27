import { GraphExpander } from "../../interfaces/graph-expander.js";
import type { DegreePrioritisedExpansionResult, ExpansionStats } from "./degree-prioritised-expansion.js";
import { PriorityQueue } from "./priority-queue.js";

/**
 * Configuration for Intelligent Delayed Termination.
 */
export interface IntelligentDelayedTerminationConfig {
	/**
	 * Number of additional iterations to continue after overlap is detected.
	 * Default: 50
	 */
	delayIterations?: number;

	/**
	 * Jaccard similarity threshold to consider frontiers as overlapping.
	 * Range: [0, 1] where 0 = no overlap, 1 = identical sets
	 * Default: 0.5 (50% overlap)
	 */
	overlapThreshold?: number;
}

/**
 * Intelligent Delayed Termination (IDT)
 *
 * **Novel Contribution**: Two-phase expansion that transitions from degree
 * prioritisation to MI-guided exploration after overlap detection.
 *
 * **Motivation**: Experimental results show that standard expansion methods
 * (including delayed termination with fixed iterations) achieve 0% salience
 * coverage. IDT addresses this by using MI-based priority guidance during
 * the delayed phase to steer exploration toward high-salience regions.
 *
 * **Algorithm**:
 * 1. **Phase 1 (Pre-overlap)**: Standard degree-prioritised expansion
 *    - π(v) = deg(v) [ascending]
 *    - Defers high-degree nodes, explores peripheral routes first
 *
 * 2. **Overlap Detection**: Uses Threshold Sharing strategy with Jaccard >= 0.5
 *    - Jaccard(A,B) = |A ∩ B| / |A ∪ B|
 *    - Transition occurs when any two frontiers achieve sufficient overlap
 *
 * 3. **Phase 2 (Post-overlap, Delayed)**: MI-guided degree prioritisation
 *    - π(v) = deg(v) × (1 - estimated_MI(v)) [ascending]
 *    - Continue for exactly `delayIterations` additional iterations
 *    - Terminate when post-overlap iteration count reaches limit
 *
 * **MI Estimation**:
 * - Uses Jaccard similarity between node neighbours and discovered path nodes
 * - Estimated MI(v) = max over all paths of Jaccard(neighbors(v), nodes(P))
 * - Higher Jaccard = node likely appears on high-quality paths
 *
 * **Key Differences from RSGE**:
 * - RSGE: Runs to frontier exhaustion
 * - IDT: Terminates after N iterations post-overlap
 * - IDT: Explicitly detects overlap satisfaction condition
 *
 * **Complexity**:
 * - Time: O(E log V + P × D) where E = edges, V = vertices, P = paths, D = avg degree
 * - Space: O(V + E + P × K) where K = avg path length
 *
 * @template T - Node data type
 */
export class IntelligentDelayedTermination<T> {
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

	/** Phase tracking: false = degree-only, true = MI-guided */
	private saliencePhaseActive = false;

	/** Track when overlap was first detected */
	private overlapDetectedAt: number | undefined = undefined;

	/** Configuration */
	private readonly delayIterations: number;
	private readonly overlapThreshold: number;

	/**
	 * Create a new intelligent delayed termination expansion.
	 *
	 * @param expander - Graph expander providing neighbour access
	 * @param seeds - Array of seed node IDs (N ≥ 2 required for overlap detection)
	 * @param config - Configuration for delay iterations and overlap threshold
	 * @throws Error if fewer than 2 seeds provided
	 */
	constructor(
		private readonly expander: GraphExpander<T>,
		private readonly seeds: readonly string[],
		config: IntelligentDelayedTerminationConfig = {}
	) {
		if (seeds.length < 2) {
			throw new Error("At least two seed nodes are required for overlap detection");
		}

		this.delayIterations = config.delayIterations ?? 50;
		this.overlapThreshold = config.overlapThreshold ?? 0.5;

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
	 * Run the expansion with intelligent delayed termination.
	 *
	 * Terminates when:
	 * - Pre-overlap: All frontiers exhausted (standard termination)
	 * - Post-overlap: `delayIterations` additional iterations completed
	 *
	 * @returns Expansion results including paths and sampled subgraph
	 */
	async run(): Promise<DegreePrioritisedExpansionResult> {
		// Core loop: always expand globally lowest-priority node
		while (this.hasNonEmptyFrontier() && !this.shouldTerminate()) {
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

				// Check for path intersection BEFORE updating nodeToFrontierIndex
				// If another frontier already visited this node, we have a path
				const otherFrontierIndex = this.nodeToFrontierIndex.get(targetId);
				const isIntersection = otherFrontierIndex !== undefined && otherFrontierIndex !== activeIndex;

				// Mark as visited and set parent for this frontier
				activeState.visited.add(targetId);
				activeState.parents.set(targetId, { parent: node, edge: relationshipType });

				// Track which frontier owns this node (for O(1) intersection checking)
				this.nodeToFrontierIndex.set(targetId, activeIndex);

				// Calculate priority (phase-dependent)
				const priority = this.calculateNodePriority(targetId);
				activeState.frontier.push(targetId, priority);

				// Process path intersection if found
				if (isIntersection) {
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

				// Check for overlap detection (Threshold Sharing strategy)
				if (!this.overlapDetectedAt && this.detectOverlap(activeState)) {
					this.overlapDetectedAt = this.stats.iterations;
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
	 * Detect if the active frontier has sufficient overlap with any other frontier.
	 *
	 * Uses Threshold Sharing strategy: Jaccard similarity >= overlapThreshold
	 *
	 * @param activeFrontier - The frontier that is expanding
	 * @returns True if overlap detected with any frontier
	 * @internal
	 */
	private detectOverlap(activeFrontier: FrontierState): boolean {
		for (const otherFrontier of this.frontiers) {
			if (otherFrontier.index === activeFrontier.index) continue;

			const similarity = this.calculateJaccardSimilarity(
				activeFrontier.visited,
				otherFrontier.visited
			);

			if (similarity >= this.overlapThreshold) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Calculate Jaccard similarity between two sets.
	 *
	 * J(A,B) = |A ∩ B| / |A ∪ B|
	 *
	 * @param setA - First set
	 * @param setB - Second set
	 * @returns Jaccard similarity coefficient [0, 1]
	 * @internal
	 */
	private calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
		// Calculate intersection size
		let intersection = 0;
		for (const item of setA) {
			if (setB.has(item)) {
				intersection++;
			}
		}

		// Calculate union size
		const union = setA.size + setB.size - intersection;

		// Avoid division by zero
		if (union === 0) return 0;

		return intersection / union;
	}

	/**
	 * Check if termination condition is met.
	 *
	 * @returns True if post-overlap iteration limit reached
	 * @internal
	 */
	private shouldTerminate(): boolean {
		if (!this.overlapDetectedAt) return false;

		const postOverlapIterations = this.stats.iterations - this.overlapDetectedAt;
		return postOverlapIterations >= this.delayIterations;
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
	 * Transition from Phase 1 (degree-only) to Phase 2 (MI-guided).
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
	): string[] | undefined {
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

		if (pathFromA[0] !== seedA) return undefined;
		if (pathFromB.length > 0 && pathFromB.at(-1) !== seedB && meetingNode !== seedB) return undefined;

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
