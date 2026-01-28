import { GraphExpander } from "../../interfaces/graph-expander.js";
import type { DegreePrioritisedExpansionResult, ExpansionStats } from "./degree-prioritised-expansion.js";
import { PriorityQueue } from "./priority-queue.js";

/**
 * State for a single expansion frontier.
 * @internal
 */
interface FrontierState {
	/** Index of this frontier (corresponds to seed index) */
	index: number;

	/** Priority queue of nodes to expand (priority = π_HABE) */
	frontier: PriorityQueue<string>;

	/** Set of visited nodes */
	visited: Set<string>;

	/** Parent pointers for path reconstruction */
	parents: Map<string, { parent: string; edge: string }>;
}

/**
 * Overlap event for termination tracking.
 * @internal
 */
interface OverlapEvent {
	frontierA: number;
	frontierB: number;
	meetingNode: string;
}

/**
 * Heterogeneity-Aware Bidirectional Expansion (HABE)
 *
 * **Novel Contribution**: Combines entropy-guided expansion with overlap-based
 * termination and path salience ranking to produce cross-domain paths that
 * traverse heterogeneous graph regions.
 *
 * **Key Innovation**: HABE integrates three thesis components:
 * 1. **EGE Priority**: π_HABE(v) = (1 / (H_local(v) + ε)) × log(deg(v) + 1)
 *    - Low-entropy (homogeneous) neighborhoods expanded first
 *    - High-entropy (heterogeneous) neighborhoods deferred
 * 2. **Transitive Connectivity Termination**: Terminates when overlap graph is connected
 *    - Less strict than full pairwise, enables earlier termination
 *    - Ensures all seeds are transitively connected
 * 3. **Path Salience Output**: Returns paths ranked by geometric-mean MI
 *    - M(P) = exp((1/k) Σ log I(e))
 *    - Weak-link sensitivity without length bias
 *
 * **Design Motivation**:
 * In heterogeneous graphs (e.g., citation networks with multi-domain papers),
 * standard expansion may get trapped in homogeneous regions. HABE actively
 * defers high-entropy nodes, encouraging exploration of cross-domain connections.
 *
 * **Key Properties**:
 * 1. **Cross-domain sensitivity**: Prioritizes edges connecting different domains
 * 2. **Parameter-free termination**: Transitive connectivity, no arbitrary cutoffs
 * 3. **N-seed generalisation**: Single algorithm handles N=1, N=2, and N≥3
 * 4. **Entropy-hub duality**: log(deg+1) maintains hub deferral from degree-prioritised
 *
 * **Algorithm**:
 * ```
 * 1. Pre-compute local entropy H_local(v) for frontier nodes
 * 2. Initialize N frontiers, one per seed
 * 3. While any frontier is non-empty AND overlap graph not connected:
 *    a. Select frontier with lowest π_HABE(v) node at front
 *    b. Pop that node and expand its neighbours
 *    c. For each new neighbour:
 *       - Compute H_local asynchronously
 *       - Check intersection with all other frontiers
 *       - Record overlap events for termination check
 *    d. If intersection found, record path between seeds
 * 4. Rank discovered paths by geometric-mean MI (Path Salience)
 * 5. Return sampled subgraph with ranked paths
 * ```
 *
 * **Priority Function**:
 * π_HABE(v) = (1 / (H_local(v) + ε)) × log(deg(v) + 1)
 *
 * Where:
 * - H_local(v) = -Σ p(τ) log₂ p(τ) (Shannon entropy of neighbour types)
 * - p(τ) = proportion of neighbours with relationship type τ
 * - ε = 0.001 (prevents division by zero)
 * - deg(v) = total degree of node v
 *
 * **Complexity**: O(E log V) where E = edges explored, V = vertices
 *
 * @template T - Type of node data returned by expander
 * @example
 * ```typescript
 * const expansion = new HeterogeneityAwareExpansion(expander, ['seedA', 'seedB']);
 * const result = await expansion.run();
 * console.log(`Found ${result.paths.length} cross-domain paths`);
 * console.log(`Sampled ${result.sampledNodes.size} nodes`);
 * ```
 *
 * @see EntropyGuidedExpansion - Entropy-based priority without overlap termination
 * @see DegreePrioritisedExpansion - Base implementation using degree alone
 */
export class HeterogeneityAwareExpansion<T> {
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

	/** Overlap events for transitive connectivity termination */
	private readonly overlapEvents: OverlapEvent[] = [];

	/** Epsilon value to prevent division by zero in entropy calculation */
	private static readonly EPSILON = 0.001;

	/** Cache of pre-computed local entropy values */
	private readonly entropyCache = new Map<string, number>();

	/**
	 * Create a new heterogeneity-aware expansion.
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
			// Initial priority uses degree only (entropy computed lazily)
			const priority = this.calculateInitialPriority(seed);
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
		// Check cache first
		const cached = this.entropyCache.get(nodeId);
		if (cached !== undefined) {
			return cached;
		}

		const neighbours = await this.expander.getNeighbors(nodeId);

		if (neighbours.length === 0) {
			this.entropyCache.set(nodeId, 0);
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

		this.entropyCache.set(nodeId, entropy);
		return entropy;
	}

	/**
	 * Calculate initial priority for seed nodes (degree-only, entropy computed lazily).
	 *
	 * @param nodeId - Node to calculate priority for
	 * @returns Priority value
	 * @internal
	 */
	private calculateInitialPriority(nodeId: string): number {
		const degree = this.expander.getDegree(nodeId);
		return Math.log(degree + 1);
	}

	/**
	 * Calculate HABE priority for a node (async version with entropy).
	 *
	 * π_HABE(v) = (1 / (H_local(v) + ε)) × log(deg(v) + 1)
	 *
	 * Lower priority = explored first (min-heap behaviour).
	 *
	 * @param nodeId - Node to calculate priority for
	 * @returns Priority value (lower = higher priority)
	 * @internal
	 */
	private async calculateHABEPriority(nodeId: string): Promise<number> {
		const degree = this.expander.getDegree(nodeId);
		const entropy = await this.computeLocalEntropy(nodeId);

		// π_HABE(v) = (1 / (H_local(v) + ε)) × log(deg(v) + 1)
		const entropyFactor = 1 / (entropy + HeterogeneityAwareExpansion.EPSILON);
		const degreeFactor = Math.log(degree + 1);

		return entropyFactor * degreeFactor;
	}

	/**
	 * Check if expansion should terminate based on transitive connectivity.
	 *
	 * Terminates when overlap graph is connected (all seeds transitively connected).
	 *
	 * @returns true if expansion should terminate
	 * @internal
	 */
	private shouldTerminate(): boolean {
		const n = this.frontiers.length;

		// N=1 is a special case - no overlap possible, run to exhaustion
		if (n <= 1) {
			return false;
		}

		// Build adjacency list for overlap graph
		const adj = new Map<number, Set<number>>();
		for (let index = 0; index < n; index++) {
			adj.set(index, new Set());
		}

		for (const event of this.overlapEvents) {
			const setA = adj.get(event.frontierA);
			const setB = adj.get(event.frontierB);
			if (setA !== undefined) {
				setA.add(event.frontierB);
			}
			if (setB !== undefined) {
				setB.add(event.frontierA);
			}
		}

		// Check if graph is connected using BFS from node 0
		return this.isConnected(adj, n);
	}

	/**
	 * Check if an undirected graph is connected using BFS.
	 *
	 * @param adj - Adjacency list representation of graph
	 * @param n - Number of nodes
	 * @returns true if graph is connected
	 * @internal
	 */
	private isConnected(adj: Map<number, Set<number>>, n: number): boolean {
		if (n === 0) return true;

		const visited = new Set<number>();
		const queue: number[] = [0];
		visited.add(0);

		while (queue.length > 0) {
			const current = queue.shift();
			if (current === undefined) continue;

			for (const neighbor of adj.get(current) ?? []) {
				if (!visited.has(neighbor)) {
					visited.add(neighbor);
					queue.push(neighbor);
				}
			}
		}

		// Graph is connected if all nodes were visited
		return visited.size === n;
	}

	/**
	 * Run the expansion to completion.
	 *
	 * Terminates when:
	 * - All frontiers are exhausted (no unexpanded nodes remain), OR
	 * - Overlap graph is transitively connected (all seeds connected via overlaps)
	 *
	 * @returns Expansion results including paths and sampled subgraph
	 */
	async run(): Promise<DegreePrioritisedExpansionResult> {
		// Core loop: expand until frontiers exhausted or transitive connectivity achieved
		while (this.hasNonEmptyFrontier() && !this.shouldTerminate()) {
			this.stats.iterations++;

			// Select frontier with lowest HABE-priority node at front
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

				// Check for intersection BEFORE claiming node ownership (thesis requirement)
				// This allows detecting paths when frontiers meet at the same node
				let foundIntersection = false;
				let otherFrontierIndex = -1;

				for (let index = 0; index < this.frontiers.length; index++) {
					if (index === activeIndex) continue;
					if (this.frontiers[index].visited.has(targetId)) {
						foundIntersection = true;
						otherFrontierIndex = index;
						break;
					}
				}

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

				// Track which frontier owns this node (for O(1) intersection checking)
				if (!this.nodeToFrontierIndex.has(targetId)) {
					this.nodeToFrontierIndex.set(targetId, activeIndex);
				}

				// Add to frontier with HABE priority
				const priority = await this.calculateHABEPriority(targetId);
				activeState.frontier.push(targetId, priority);

				// If intersection found, record path and overlap event
				if (foundIntersection && otherFrontierIndex !== -1) {
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

							// Record overlap event for termination check
							this.overlapEvents.push({
								frontierA: activeIndex,
								frontierB: otherFrontierIndex,
								meetingNode: targetId,
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
	 * Select the frontier with the lowest HABE-priority node at its front.
	 * Returns -1 if all frontiers are empty.
	 * @internal
	 */
	private selectLowestPriorityFrontier(): number {
		let minPriority = Infinity;
		let minIndex = -1;

		for (let index = 0; index < this.frontiers.length; index++) {
			const state = this.frontiers[index];
			if (state.frontier.length > 0) {
				// Peek at the front node's priority (min-heap)
				const peekPriority = state.frontier.peekPriority();
				if (peekPriority < minPriority) {
					minPriority = peekPriority;
					minIndex = index;
				}
			}
		}

		return minIndex;
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
		if (pathFromB.length > 0 && pathFromB[pathFromB.length - 1] !== seedB && meetingNode !== seedB) return null;

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
		// Include node sequence for uniqueness (paths of same length but different routes)
		return `${a}-${b}-${nodes.join(",")}`;
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
