import { GraphExpander } from "../../../interfaces/graph-expander";
import { PriorityQueue } from "../priority-queue";
import type { FrontierState } from "./frontier-state.js";
import type { OverlapBasedExpansionResult, OverlapMetadata, ExpansionStats } from "./overlap-result.js";
import type { OverlapDetectionStrategy } from "./strategies/overlap-detection/overlap-detection-strategy.js";
import type { TerminationStrategy } from "./strategies/termination/termination-strategy.js";
import type { N1HandlingStrategy } from "./strategies/n1-handling/n1-handling-strategy.js";
import type { BetweenGraphStrategy } from "./strategies/between-graph/between-graph-strategy.js";

/**
 * Configuration for OverlapBasedExpansion.
 */
export interface OverlapBasedExpansionConfig {
	/**
	 * Strategy for detecting overlap between seed search regions.
	 */
	overlapDetection: OverlapDetectionStrategy;

	/**
	 * Strategy for determining when expansion should terminate.
	 */
	termination: TerminationStrategy;

	/**
	 * Strategy for handling N=1 (single seed) scenario.
	 */
	n1Handling: N1HandlingStrategy;

	/**
	 * Strategy for extracting the between-graph subgraph.
	 */
	betweenGraph: BetweenGraphStrategy;

	/**
	 * Maximum iterations before forced termination (safety limit).
	 * Default: Infinity (no limit unless strategy terminates).
	 */
	maxIterations?: number;

	/**
	 * Total nodes in graph (for N=1 coverage calculation).
	 * Optional - only used if n1Handling strategy requires it.
	 */
	totalNodes?: number;
}

/**
 * Overlap-Based Expansion
 *
 * **Thesis Alignment**: Extends the seed-bounded sampling concept with overlap-based
 * termination instead of frontier exhaustion. This enables efficient sampling of the
 * "between-graph" (region connecting N seeds) while preserving sufficient structure
 * for Path Salience ranking.
 *
 * **Key Design Properties**:
 * 1. **Overlap-based termination**: Stops when seed search regions sufficiently overlap
 * 2. **Strategy pattern architecture**: Modular dimensions for experimental comparison
 * 3. **N-seed generalisation**: Handles N=1 (ego-network), N=2 (bidirectional), N≥3
 * 4. **Degree prioritisation**: Expands globally lowest-degree node across all frontiers
 *
 * **Algorithm**:
 * ```
 * 1. Initialize N frontiers, one per seed
 * 2. While termination condition not met:
 *    a. Select frontier with lowest-degree node at front
 *    b. Pop and expand neighbors
 *    c. Detect overlaps using strategy
 *    d. Check termination condition
 * 3. Extract between-graph subgraph using strategy
 * ```
 *
 * @template T - Type of node data returned by expander
 */
export class OverlapBasedExpansion<T> {
	private readonly frontiers: FrontierState[] = [];
	private readonly paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }> = [];
	private readonly sampledEdges = new Set<string>();
	private readonly overlapEvents: Array<{
		iteration: number;
		frontierA: number;
		frontierB: number;
		meetingNode: string;
	}> = [];
	private stats: ExpansionStats;
	private iteration = 0;

	/** Track which frontier owns each node for O(1) overlap detection */
	private readonly nodeToFrontierIndex = new Map<string, number>();

	/** Track path signatures for O(1) deduplication */
	private readonly pathSignatures = new Set<string>();

	/** Overlap matrix: "0-1" → Set of meeting nodes */
	private readonly overlapMatrix = new Map<string, Set<string>>();

	/**
	 * Create a new overlap-based expansion.
	 *
	 * @param expander - Graph expander providing neighbour access
	 * @param seeds - Array of seed node IDs (N ≥ 1)
	 * @param config - Strategy configuration
	 * @throws Error if no seeds provided
	 */
	constructor(
		private readonly expander: GraphExpander<T>,
		private readonly seeds: readonly string[],
		private readonly config: OverlapBasedExpansionConfig
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
	 * Run the expansion to termination.
	 *
	 * @returns Expansion results including between-graph subgraph
	 */
	async run(): Promise<OverlapBasedExpansionResult> {
		// N=1 case: use dedicated handler
		if (this.seeds.length === 1) {
			return this.runN1();
		}

		// N≥2 case: overlap-based expansion
		return this.runNPlus();
	}

	/**
	 * Run expansion for N=1 (single seed) scenario.
	 *
	 * Uses n1Handling strategy to determine when to terminate.
	 *
	 * @private
	 */
	private async runN1(): Promise<OverlapBasedExpansionResult> {
		const frontier = this.frontiers[0];

		// Core loop with N=1 termination check
		while (frontier.frontier.length > 0) {
			this.iteration++;
			this.stats.iterations++;

			// Check N=1 termination condition
			if (this.config.n1Handling.shouldTerminate(frontier, this.config.totalNodes, this.iteration)) {
				break;
			}

			// Safety limit
			if (this.config.maxIterations !== undefined && this.iteration >= this.config.maxIterations) {
				break;
			}

			// Expand the lowest-degree node (only one frontier)
			const node = frontier.frontier.pop();
			if (!node) continue;

			await this.expandNode(node, frontier, 0);
		}

		return this.buildResult("n1-coverage");
	}

	/**
	 * Run expansion for N≥2 scenario with overlap detection.
	 *
	 * @private
	 */
	private async runNPlus(): Promise<OverlapBasedExpansionResult> {
		// Core loop with overlap-based termination
		while (this.hasNonEmptyFrontier()) {
			this.iteration++;
			this.stats.iterations++;

			// Check termination condition
			if (this.config.termination.shouldTerminate(this.frontiers, this.overlapEvents, this.iteration)) {
				break;
			}

			// Safety limit
			if (this.config.maxIterations !== undefined && this.iteration >= this.config.maxIterations) {
				break;
			}

			// Select frontier with lowest-degree node at front
			const activeIndex = this.selectLowestDegreeFrontier();
			if (activeIndex === -1) break;

			const activeState = this.frontiers[activeIndex];
			const node = activeState.frontier.pop();
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

				// Track which frontier owns this node (for overlap detection)
				this.nodeToFrontierIndex.set(targetId, activeIndex);

				// Add to frontier with thesis priority
				const priority = this.expander.calculatePriority(targetId);
				activeState.frontier.push(targetId, priority);

				// Detect overlap using strategy
				const overlappingFrontiers = this.config.overlapDetection.detectOverlap(
					targetId,
					activeState,
					this.frontiers,
					this.nodeToFrontierIndex
				);

				// Process each overlapping frontier
				for (const otherIndex of overlappingFrontiers) {
					const otherState = this.frontiers[otherIndex];

					// Record overlap event
					this.overlapEvents.push({
						iteration: this.iteration,
						frontierA: activeIndex,
						frontierB: otherIndex,
						meetingNode: targetId,
					});

					// Update overlap matrix
					const matrixKey = this.getMatrixKey(activeIndex, otherIndex);
					if (!this.overlapMatrix.has(matrixKey)) {
						this.overlapMatrix.set(matrixKey, new Set());
					}
					this.overlapMatrix.get(matrixKey)!.add(targetId);

					// Reconstruct path
					const path = this.reconstructPath(activeState, otherState, targetId);
					if (path) {
						// Use path signature for O(1) deduplication
						const signature = this.createPathSignature(activeIndex, otherIndex, path);
						if (!this.pathSignatures.has(signature)) {
							this.pathSignatures.add(signature);
							this.paths.push({
								fromSeed: activeIndex,
								toSeed: otherIndex,
								nodes: path,
							});
						}
					}
				}
			}
		}

		// Determine termination reason
		let terminationReason: OverlapMetadata["terminationReason"];
		if (this.config.termination.shouldTerminate(this.frontiers, this.overlapEvents, this.iteration)) {
			terminationReason = "overlap-satisfied";
		} else if (!this.hasNonEmptyFrontier()) {
			terminationReason = "exhaustion";
		} else {
			terminationReason = "max-iterations";
		}

		return this.buildResult(terminationReason);
	}

	/**
	 * Expand a single node (used in N=1 case).
	 *
	 * @param node - Node to expand
	 * @param frontier - Frontier state
	 * @param frontierIndex - Index of the frontier
	 * @private
	 */
	private async expandNode(node: string, frontier: FrontierState, frontierIndex: number): Promise<void> {
		this.stats.nodesExpanded++;
		this.recordDegree(this.expander.getDegree(node));

		const neighbors = await this.expander.getNeighbors(node);

		for (const { targetId, relationshipType } of neighbors) {
			if (frontier.visited.has(targetId)) continue;

			this.stats.edgesTraversed++;

			this.expander.addEdge(node, targetId, relationshipType);
			const edgeKey = `${node}->${targetId}`;
			this.sampledEdges.add(edgeKey);

			frontier.visited.add(targetId);
			frontier.parents.set(targetId, { parent: node, edge: relationshipType });

			this.nodeToFrontierIndex.set(targetId, frontierIndex);

			const priority = this.expander.calculatePriority(targetId);
			frontier.frontier.push(targetId, priority);
		}
	}

	/**
	 * Build the final result with between-graph subgraph extraction.
	 *
	 * @param terminationReason - Reason for termination
	 * @private
	 */
	private buildResult(terminationReason: OverlapMetadata["terminationReason"]): OverlapBasedExpansionResult {
		// Compute union of all visited sets
		const sampledNodes = new Set<string>();
		const visitedPerFrontier: Array<Set<string>> = [];
		for (const state of this.frontiers) {
			for (const node of state.visited) {
				sampledNodes.add(node);
			}
			visitedPerFrontier.push(new Set(state.visited));
		}

		// Build raw expansion result
		const rawResult: OverlapBasedExpansionResult = {
			paths: this.paths,
			sampledNodes,
			sampledEdges: this.sampledEdges,
			visitedPerFrontier,
			stats: this.stats,
			overlapMetadata: {
				terminationReason,
				overlapEvents: this.overlapEvents,
				iterations: this.iteration,
				overlapMatrix: this.overlapMatrix,
			},
		};

		// Apply between-graph strategy to refine output
		const betweenGraphOutput = this.config.betweenGraph.extractBetweenGraph(rawResult);

		// Return refined result
		return {
			...rawResult,
			paths: betweenGraphOutput.paths,
			sampledNodes: betweenGraphOutput.nodes,
			sampledEdges: betweenGraphOutput.edges,
		};
	}

	/**
	 * Check if any frontier has unexpanded nodes.
	 * @private
	 */
	private hasNonEmptyFrontier(): boolean {
		return this.frontiers.some((state) => state.frontier.length > 0);
	}

	/**
	 * Select the frontier with the lowest-degree node at its front.
	 * Returns -1 if all frontiers are empty.
	 * @private
	 */
	private selectLowestDegreeFrontier(): number {
		let minDegree = Infinity;
		let minIndex = -1;

		for (let index = 0; index < this.frontiers.length; index++) {
			const state = this.frontiers[index];
			if (state.frontier.length > 0) {
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
	 * @private
	 */
	private peekPriority(queue: PriorityQueue<string>): number {
		return queue.peekPriority();
	}

	/**
	 * Reconstruct path from meeting point between two frontiers.
	 * @private
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
		if (pathFromB.length > 0 && pathFromB.at(-1) !== seedB &&
			meetingNode !== seedB) return null;

		return [...pathFromA, ...pathFromB];
	}

	/**
	 * Create a unique signature for a path to enable O(1) deduplication.
	 * Signature is bidirectional (A-B same as B-A).
	 * @private
	 */
	private createPathSignature(fromSeed: number, toSeed: number, nodes: string[]): string {
		const [a, b] = fromSeed < toSeed ? [fromSeed, toSeed] : [toSeed, fromSeed];
		return `${a}-${b}-${nodes.length}`;
	}

	/**
	 * Get matrix key for overlap tracking (always sorted).
	 * @private
	 */
	private getMatrixKey(a: number, b: number): string {
		return a < b ? `${a}-${b}` : `${b}-${a}`;
	}

	/**
	 * Record degree in distribution histogram.
	 * @private
	 */
	private recordDegree(degree: number): void {
		const bucket = this.getDegreeBucket(degree);
		const count = this.stats.degreeDistribution.get(bucket) ?? 0;
		this.stats.degreeDistribution.set(bucket, count + 1);
	}

	/**
	 * Get histogram bucket for a degree value.
	 * @private
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
