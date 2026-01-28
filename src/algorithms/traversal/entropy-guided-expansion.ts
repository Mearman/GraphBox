import { GraphExpander } from "../../interfaces/graph-expander";
import { DegreePrioritisedExpansionResult, ExpansionStats } from "./degree-prioritised-expansion";
import { PriorityQueue } from "./priority-queue";

/**
 * State for a single expansion frontier.
 * @internal
 */
interface FrontierState {
	/** Index of this frontier (corresponds to seed index) */
	index: number;

	/** Priority queue of nodes to expand (priority = entropy-based) */
	frontier: PriorityQueue<string>;

	/** Set of visited nodes */
	visited: Set<string>;

	/** Parent pointers for path reconstruction */
	parents: Map<string, { parent: string; edge: string }>;
}

/**
 * Entropy-Guided Expansion (EGE)
 *
 * **Thesis Alignment**: This is an experimental variant of the seed-bounded
 * sampling algorithm that uses local neighbourhood entropy to guide expansion
 * instead of simple degree prioritisation.
 *
 * **Design Motivation**:
 * - DegreePrioritisedExpansion: Defers hubs using degree alone
 * - EntropyGuidedExpansion: Incorporates neighbourhood diversity via entropy
 *
 * Use this implementation when:
 * - Neighbourhood diversity should influence exploration order
 * - Homogeneous neighbourhoods (low entropy) should be explored first
 * - Heterogeneous neighbourhoods (high entropy) should be deferred
 *
 * **Key Design Properties**:
 * 1. **Parameter-free termination**: No arbitrary limits on nodes, edges, or iterations.
 *    The sole termination condition is structural: all frontiers exhausted.
 * 2. **N-seed generalisation**: Single algorithm handles N=1 (ego-network), N=2
 *    (bidirectional), and N≥3 (multi-frontier) with identical code path.
 * 3. **Entropy-based prioritisation**: Priority π_EGE(v) = (1 / (H_local(v) + ε)) × log(deg(v) + 1)
 *    where H_local(v) is Shannon entropy of neighbour type distribution.
 * 4. **Hub deferral maintained**: log(deg + 1) term preserves degree-based ordering.
 *
 * **Algorithm**:
 * ```
 * 1. Initialize N frontiers, one per seed
 * 2. While any frontier is non-empty:
 *    a. Select the frontier with the lowest entropy-weighted node at its front
 *    b. Pop that node and expand its neighbours
 *    c. For each new neighbour, check intersection with all other frontiers
 *    d. If intersection found, record path between the two seeds
 * 3. Return sampled subgraph (union of all visited nodes)
 * ```
 *
 * **Priority Function**:
 * π_EGE(v) = (1 / (H_local(v) + ε)) × log(deg(v) + 1)
 *
 * Where:
 * - H_local(v) = -Σ p(τ) log p(τ) (Shannon entropy of neighbour types)
 * - p(τ) = proportion of neighbours with relationship type τ
 * - ε = 0.001 (prevents division by zero)
 * - deg(v) = total degree of node v
 *
 * **Complexity**: O(E log V) where E = edges explored, V = vertices
 *
 * @template T - Type of node data returned by expander
 * @example
 * ```typescript
 * const expansion = new EntropyGuidedExpansion(expander, ['seedA', 'seedB']);
 * const result = await expansion.run();
 * console.log(`Found ${result.paths.length} paths`);
 * console.log(`Sampled ${result.sampledNodes.size} nodes`);
 * ```
 *
 * @see DegreePrioritisedExpansion - Base implementation using degree alone
 */
export class EntropyGuidedExpansion<T> {
	private readonly frontiers: FrontierState[] = [];
	private readonly paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }> = [];
	private readonly sampledEdges = new Set<string>();
	private stats: ExpansionStats;
	/** Tracks when each node was first discovered (iteration number) */
	private readonly nodeDiscoveryIteration = new Map<string, number>();

	/** Track which frontier owns each node for O(1) intersection checking */
	private readonly nodeToFrontierIndex = new Map<string, number>();

	/** Track path signatures for O(1) deduplication */
	private readonly pathSignatures = new Set<string>();

	/** Epsilon value to prevent division by zero in entropy calculation */
	private static readonly EPSILON = 0.001;

	/**
	 * Create a new entropy-guided expansion.
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
			const priority = this.calculateEntropyPriority(seed);
			frontier.push(seed, priority);

			this.frontiers.push({
				index: index,
				frontier,
				visited: new Set([seed]),
				parents: new Map(),
			});

			// Track which frontier owns this seed
			this.nodeToFrontierIndex.set(seed, index);

			// Seeds are discovered at iteration 0
			this.nodeDiscoveryIteration.set(seed, 0);
		}

		this.stats = {
			nodesExpanded: 0,
			edgesTraversed: 0,
			iterations: 0,
			degreeDistribution: new Map(),
		};
	}

	/**
	 * Compute local entropy H_local(v) for a node based on neighbour type distribution.
	 *
	 * H_local(v) = -Σ p(τ) log₂ p(τ)
	 *
	 * Where p(τ) is the proportion of neighbours with relationship type τ.
	 *
	 * @param nodeId - Node to compute entropy for
	 * @returns Shannon entropy of neighbour type distribution
	 * @internal
	 */
	private async computeLocalEntropy(nodeId: string): Promise<number> {
		const neighbours = await this.expander.getNeighbors(nodeId);

		if (neighbours.length === 0) {
			return 0; // No neighbours = no entropy
		}

		// Count relationship types
		const typeCounts = new Map<string, number>();
		for (const { relationshipType } of neighbours) {
			const count = typeCounts.get(relationshipType) ?? 0;
			typeCounts.set(relationshipType, count + 1);
		}

		// Compute Shannon entropy: -Σ p(τ) log₂ p(τ)
		let entropy = 0;
		const total = neighbours.length;

		for (const count of typeCounts.values()) {
			const p = count / total;
			// Skip zero probabilities (would cause log(0))
			if (p > 0) {
				entropy -= p * Math.log2(p);
			}
		}

		return entropy;
	}

	/**
	 * Calculate entropy-guided priority for a node.
	 *
	 * π_EGE(v) = (1 / (H_local(v) + ε)) × log(deg(v) + 1)
	 *
	 * Lower priority = explored first (min-heap behaviour).
	 *
	 * @param nodeId - Node to calculate priority for
	 * @returns Priority value (lower = higher priority)
	 * @internal
	 */
	private calculateEntropyPriority(nodeId: string): number {
		// This is a synchronous wrapper for async entropy computation
		// We'll compute entropy lazily when needed
		const degree = this.expander.getDegree(nodeId);

		// For initial seeds, use degree-only priority
		// Entropy will be computed during expansion
		return Math.log(degree + 1);
	}

	/**
	 * Calculate entropy-guided priority for a node (async version).
	 *
	 * @param nodeId - Node to calculate priority for
	 * @returns Priority value (lower = higher priority)
	 * @internal
	 */
	private async calculateEntropyPriorityAsync(nodeId: string): Promise<number> {
		const degree = this.expander.getDegree(nodeId);
		const entropy = await this.computeLocalEntropy(nodeId);

		// π_EGE(v) = (1 / (H_local(v) + ε)) × log(deg(v) + 1)
		const entropyFactor = 1 / (entropy + EntropyGuidedExpansion.EPSILON);
		const degreeFactor = Math.log(degree + 1);

		return entropyFactor * degreeFactor;
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
		// Core loop: always expand globally lowest entropy-weighted node
		while (this.hasNonEmptyFrontier()) {
			this.stats.iterations++;

			// Select frontier with lowest entropy-weighted node at front
			const activeIndex = this.selectLowestEntropyFrontier();
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

				// Track first discovery iteration (only if not already discovered)
				if (!this.nodeDiscoveryIteration.has(targetId)) {
					this.nodeDiscoveryIteration.set(targetId, this.stats.iterations);
				}

				// Check for intersection BEFORE setting frontier ownership
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
						}
					}
				}

				// Track which frontier owns this node (for O(1) intersection checking)
				this.nodeToFrontierIndex.set(targetId, activeIndex);

				// Add to frontier with entropy-based priority
				const priority = await this.calculateEntropyPriorityAsync(targetId);
				activeState.frontier.push(targetId, priority);
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
		return this.frontiers.some((state) => state.frontier.length > 0);
	}

	/**
	 * Select the frontier with the lowest entropy-weighted node at its front.
	 * Returns -1 if all frontiers are empty.
	 * @internal
	 */
	private selectLowestEntropyFrontier(): number {
		let minPriority = Infinity;
		let minIndex = -1;

		for (let index = 0; index < this.frontiers.length; index++) {
			const state = this.frontiers[index];
			if (state.frontier.length > 0) {
				// Peek at the front node's priority (min-heap)
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
		if (pathFromB.length > 0 && pathFromB[pathFromB.length - 1] !== seedB && // Path from B should end at seed B, or be empty if meeting node is seed B
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
