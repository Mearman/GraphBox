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

	/** Priority queue of nodes to expand */
	frontier: PriorityQueue<string>;

	/** Set of visited nodes */
	visited: Set<string>;

	/** Parent pointers for path reconstruction */
	parents: Map<string, { parent: string; edge: string }>;
}

/**
 * Configuration for MFASF algorithm.
 */
export interface MFASFConfig {
	/**
	 * Minimum number of paths to discover before considering phase 3 termination.
	 * @default 3
	 */
	minPaths?: number;

	/**
	 * Diversity threshold τ for phase 3 termination.
	 * Diversity = |unique nodes in paths| / |total path nodes|
	 * @default 0.5
	 */
	diversityThreshold?: number;

	/**
	 * Salience feedback weight λ for phase 2 priority.
	 * Higher values give more weight to salience feedback.
	 * @default 1.0
	 */
	salienceFeedbackWeight?: number;

	/**
	 * Rolling window size for salience plateau detection.
	 * @default 5
	 */
	plateauWindowSize?: number;

	/**
	 * Threshold for salience plateau detection (relative change).
	 * If salience improves by less than this ratio, consider plateaued.
	 * @default 0.01
	 */
	plateauThreshold?: number;
}

/**
 * Multi-Frontier Adaptive Salience-Feedback (MFASF)
 *
 * **Novel Contribution**: Three-phase adaptive expansion that dynamically adjusts
 * priority based on salience feedback from discovered paths, achieving higher
 * mean path salience than static prioritization strategies.
 *
 * **Key Innovation**: Unlike static prioritization (degree-only, salience-only),
 * MFASF adapts its exploration strategy based on real-time feedback from path
 * quality. The algorithm transitions through three phases:
 *
 * **Phase 1: Path Potential Discovery**
 * - Priority: π_MFASF_1(v) = deg(v) / (1 + path_potential(v))
 * - path_potential(v) = count of v's neighbours visited by OTHER frontiers
 * - Goal: Discover diverse connecting paths between seeds
 * - Duration: Until M paths discovered (M = minPaths config)
 *
 * **Phase 2: Salience Feedback Expansion**
 * - Priority: π_MFASF_2(v) = π_MFASF_1(v) × (1 + λ × salience_feedback(v))
 * - salience_feedback(v) = estimated MI based on similarity to high-salience paths
 * - Goal: Exploit discovered high-quality paths to find more
 * - Duration: Until salience plateau detected
 *
 * **Phase 3: Termination**
 * - Conditions: salience plateau reached AND diversity > τ AND |P| ≥ K
 * - salience plateau: mean salience not improving significantly over window
 * - diversity: ratio of unique nodes to total path nodes
 * - Goal: Ensure sufficient quality and diversity before termination
 *
 * **Expected Behavior**:
 * - Higher mean path salience than degree-prioritised expansion
 * - Better exploration efficiency (fewer nodes per salient path)
 * - Adaptive exploration balances exploitation and exploration
 *
 * **Complexity**:
 * - Time: O(E log V + P × D) where E = edges, V = vertices, P = paths, D = avg degree
 * - Space: O(V + E + P × K) where K = avg path length
 *
 * @template T - Node data type
 */
export class MultiFrontierAdaptiveExpansion<T> {
	private readonly frontiers: FrontierState[] = [];
	private readonly paths: Array<{ fromSeed: number; toSeed: number; nodes: string[]; salience?: number }> = [];
	private readonly sampledEdges = new Set<string>();
	private stats: ExpansionStats;
	/** Tracks when each node was first discovered (iteration number) */
	private readonly nodeDiscoveryIteration = new Map<string, number>();

	/** Track which frontier owns each node for O(1) intersection checking */
	private readonly nodeToFrontierIndex = new Map<string, number>();

	/** Track path signatures for O(1) deduplication */
	private readonly pathSignatures = new Set<string>();

	/** Current phase (1, 2, or 3) */
	private currentPhase: 1 | 2 | 3 = 1;

	/** Salience feedback scores for nodes */
	private readonly salienceFeedback = new Map<string, number>();

	/** Rolling window of mean salience values for plateau detection */
	private readonly salienceHistory: number[] = [];

	/** Cache of neighbor sets for path potential computation */
	private readonly neighborCache = new Map<string, Set<string>>();

	/** Configuration with defaults applied */
	private readonly config: Required<MFASFConfig>;

	/**
	 * Create a new multi-frontier adaptive expansion.
	 *
	 * @param expander - Graph expander providing neighbour access
	 * @param seeds - Array of seed node IDs (N ≥ 1)
	 * @param config - Optional configuration overrides
	 * @throws Error if no seeds provided
	 */
	constructor(
		private readonly expander: GraphExpander<T>,
		private readonly seeds: readonly string[],
		config: MFASFConfig = {}
	) {
		if (seeds.length === 0) {
			throw new Error("At least one seed node is required");
		}

		// Apply defaults to configuration
		this.config = {
			minPaths: config.minPaths ?? 3,
			diversityThreshold: config.diversityThreshold ?? 0.5,
			salienceFeedbackWeight: config.salienceFeedbackWeight ?? 1,
			plateauWindowSize: config.plateauWindowSize ?? 5,
			plateauThreshold: config.plateauThreshold ?? 0.01,
		};

		// Initialize N frontiers, one per seed
		for (const [index, seed] of seeds.entries()) {
			const frontier = new PriorityQueue<string>();
			const priority = this.calculatePhase1Priority(seed);
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
	 * Calculate Phase 1 priority: π_MFASF_1(v) = deg(v) / (1 + path_potential(v))
	 *
	 * @param nodeId - Node to calculate priority for
	 * @returns Priority value (lower = higher priority)
	 * @internal
	 */
	private calculatePhase1Priority(nodeId: string): number {
		const degree = this.expander.getDegree(nodeId);
		const pathPotential = this.computePathPotential(nodeId);

		// Lower priority = higher preference (min-heap)
		return degree / (1 + pathPotential);
	}

	/**
	 * Calculate Phase 2 priority: π_MFASF_2(v) = π_MFASF_1(v) × (1 + λ × salience_feedback(v))
	 *
	 * @param nodeId - Node to calculate priority for
	 * @returns Priority value (lower = higher priority)
	 * @internal
	 */
	private calculatePhase2Priority(nodeId: string): number {
		const phase1Priority = this.calculatePhase1Priority(nodeId);
		const feedback = this.salienceFeedback.get(nodeId) ?? 0;

		// Higher feedback = lower priority (explored first)
		// Invert feedback: (1 - feedback) so high feedback nodes get lower priority values
		const feedbackFactor = 1 / (1 + this.config.salienceFeedbackWeight * feedback);

		return phase1Priority * feedbackFactor;
	}

	/**
	 * Calculate priority based on current phase.
	 *
	 * @param nodeId - Node to calculate priority for
	 * @returns Priority value
	 * @internal
	 */
	private calculateCurrentPriority(nodeId: string): number {
		if (this.currentPhase === 1) {
			return this.calculatePhase1Priority(nodeId);
		}
		// Phases 2 and 3 use the same priority (phase 3 is just about termination)
		return this.calculatePhase2Priority(nodeId);
	}

	/**
	 * Compute path potential for a node: count of neighbours visited by OTHER frontiers.
	 *
	 * @param nodeId - Node to compute potential for
	 * @returns Path potential count
	 * @internal
	 */
	private computePathPotential(nodeId: string): number {
		// Get the frontier this node belongs to (if any)
		const ownerFrontier = this.nodeToFrontierIndex.get(nodeId);

		let potential = 0;

		// Count neighbours visited by other frontiers
		for (const frontier of this.frontiers) {
			if (frontier.index === ownerFrontier) continue;

			// Check if any of this node's cached neighbours are in this frontier
			const neighbors = this.neighborCache.get(nodeId);
			if (neighbors) {
				for (const neighbor of neighbors) {
					if (frontier.visited.has(neighbor)) {
						potential++;
					}
				}
			}
		}

		return potential;
	}

	/**
	 * Update salience feedback based on newly discovered path.
	 *
	 * For each node, computes similarity to path nodes and updates feedback score.
	 *
	 * @param pathNodes - Nodes in the discovered path
	 * @param pathSalience - Estimated salience of the path
	 * @internal
	 */
	private async updateSalienceFeedback(pathNodes: string[], pathSalience: number): Promise<void> {
		const pathNodeSet = new Set(pathNodes);

		// Update feedback for nodes in the path (direct participation)
		for (const nodeId of pathNodes) {
			const current = this.salienceFeedback.get(nodeId) ?? 0;
			// Nodes in path get full salience boost
			this.salienceFeedback.set(nodeId, Math.max(current, pathSalience));
		}

		// Update feedback for neighbours of path nodes (proximity)
		for (const pathNode of pathNodes) {
			const neighbors = await this.getOrCacheNeighbors(pathNode);
			for (const neighbor of neighbors) {
				if (pathNodeSet.has(neighbor)) continue; // Already handled

				const current = this.salienceFeedback.get(neighbor) ?? 0;
				// Neighbours get attenuated salience boost (0.5× path salience)
				const neighbourSalience = pathSalience * 0.5;
				this.salienceFeedback.set(neighbor, Math.max(current, neighbourSalience));
			}
		}

		// Update salience history for plateau detection
		this.salienceHistory.push(pathSalience);
		if (this.salienceHistory.length > this.config.plateauWindowSize * 2) {
			this.salienceHistory.shift();
		}
	}

	/**
	 * Get neighbours for a node, caching for efficiency.
	 *
	 * @param nodeId - Node to get neighbours for
	 * @returns Set of neighbour node IDs
	 * @internal
	 */
	private async getOrCacheNeighbors(nodeId: string): Promise<Set<string>> {
		let neighbors = this.neighborCache.get(nodeId);
		if (!neighbors) {
			neighbors = new Set<string>();
			const neighborList = await this.expander.getNeighbors(nodeId);
			for (const { targetId } of neighborList) {
				neighbors.add(targetId);
			}
			this.neighborCache.set(nodeId, neighbors);
		}
		return neighbors;
	}

	/**
	 * Estimate salience for a path based on node degrees.
	 *
	 * Uses degree-based heuristic: paths through lower-degree nodes are typically
	 * more salient (higher MI) because they represent more specific connections.
	 *
	 * @param pathNodes - Nodes in the path
	 * @returns Estimated salience in [0, 1]
	 * @internal
	 */
	private estimatePathSalience(pathNodes: string[]): number {
		if (pathNodes.length === 0) return 0;

		// Compute geometric mean of inverse log-degree (heuristic for MI)
		let logSum = 0;
		for (const nodeId of pathNodes) {
			const degree = this.expander.getDegree(nodeId);
			// Higher degree = lower contribution to salience
			// Use 1 / log(degree + 2) as proxy for MI
			logSum += Math.log(1 / Math.log(degree + 2));
		}

		const geometricMean = Math.exp(logSum / pathNodes.length);

		// Normalize to [0, 1] range
		return Math.min(1, geometricMean);
	}

	/**
	 * Check if salience has plateaued (not improving significantly).
	 *
	 * @returns true if plateau detected
	 * @internal
	 */
	private isSaliencePlateaued(): boolean {
		if (this.salienceHistory.length < this.config.plateauWindowSize * 2) {
			return false; // Not enough history
		}

		const windowSize = this.config.plateauWindowSize;
		const recentWindow = this.salienceHistory.slice(-windowSize);
		const previousWindow = this.salienceHistory.slice(-2 * windowSize, -windowSize);

		const recentMean = recentWindow.reduce((a, b) => a + b, 0) / windowSize;
		const previousMean = previousWindow.reduce((a, b) => a + b, 0) / windowSize;

		// Check if improvement is below threshold
		const improvement = (recentMean - previousMean) / (previousMean + 0.001);

		return improvement < this.config.plateauThreshold;
	}

	/**
	 * Compute path diversity: ratio of unique nodes to total path nodes.
	 *
	 * @returns Diversity ratio in [0, 1]
	 * @internal
	 */
	private computePathDiversity(): number {
		if (this.paths.length === 0) return 0;

		const uniqueNodes = new Set<string>();
		let totalNodes = 0;

		for (const path of this.paths) {
			for (const node of path.nodes) {
				uniqueNodes.add(node);
				totalNodes++;
			}
		}

		return uniqueNodes.size / totalNodes;
	}

	/**
	 * Check phase transition and termination conditions.
	 *
	 * @returns true if expansion should terminate
	 * @internal
	 */
	private checkPhaseTransition(): boolean {
		// Phase 1 → Phase 2: After minPaths discovered
		if (this.currentPhase === 1 && this.paths.length >= this.config.minPaths) {
			this.currentPhase = 2;
			this.rebuildFrontierPriorities();
		}

		// Phase 2 → Phase 3: After salience plateau detected
		if (this.currentPhase === 2 && this.isSaliencePlateaued()) {
			this.currentPhase = 3;
		}

		// Phase 3 termination: diversity > τ AND |P| ≥ K
		if (this.currentPhase === 3) {
			const diversity = this.computePathDiversity();
			const hasEnoughPaths = this.paths.length >= this.config.minPaths;
			const hasSufficientDiversity = diversity >= this.config.diversityThreshold;

			if (hasEnoughPaths && hasSufficientDiversity) {
				return true; // Terminate
			}
		}

		return false;
	}

	/**
	 * Rebuild all frontier priorities after phase transition.
	 *
	 * @internal
	 */
	private rebuildFrontierPriorities(): void {
		for (const frontier of this.frontiers) {
			const nodes: Array<{ id: string; priority: number }> = [];

			// Extract all nodes from queue
			while (frontier.frontier.length > 0) {
				const node = frontier.frontier.pop();
				if (node) {
					nodes.push({
						id: node,
						priority: this.calculateCurrentPriority(node),
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
	 * Run the expansion to completion.
	 *
	 * Transitions through three phases and terminates when phase 3 conditions met
	 * or all frontiers are exhausted.
	 *
	 * @returns Expansion results including paths and sampled subgraph
	 */
	async run(): Promise<DegreePrioritisedExpansionResult> {
		// Core loop: expand until phase 3 termination or frontiers exhausted
		while (this.hasNonEmptyFrontier()) {
			// Check phase transitions and termination
			if (this.checkPhaseTransition()) {
				break;
			}

			this.stats.iterations++;

			// Select frontier with lowest-priority node at front
			const activeIndex = this.selectLowestPriorityFrontier();
			if (activeIndex === -1) break; // Safety check

			const activeState = this.frontiers[activeIndex];
			const node = activeState.frontier.pop();
			if (!node) continue; // Safety check

			this.stats.nodesExpanded++;
			this.recordDegree(this.expander.getDegree(node));

			// Expand this node's neighbours
			const neighbors = await this.expander.getNeighbors(node);

			// Cache neighbors for path potential computation
			const neighborSet = new Set<string>();
			for (const { targetId } of neighbors) {
				neighborSet.add(targetId);
			}
			this.neighborCache.set(node, neighborSet);

			for (const { targetId, relationshipType } of neighbors) {
				// Skip if already visited by this frontier
				if (activeState.visited.has(targetId)) continue;

				this.stats.edgesTraversed++;

				// Check for intersection BEFORE claiming ownership (thesis pattern)
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

				// Mark as visited and set parent
				activeState.visited.add(targetId);
				activeState.parents.set(targetId, { parent: node, edge: relationshipType });

				// Track first discovery iteration
				if (!this.nodeDiscoveryIteration.has(targetId)) {
					this.nodeDiscoveryIteration.set(targetId, this.stats.iterations);
				}

				// Track frontier ownership
				if (!this.nodeToFrontierIndex.has(targetId)) {
					this.nodeToFrontierIndex.set(targetId, activeIndex);
				}

				// Add to frontier with phase-appropriate priority
				const priority = this.calculateCurrentPriority(targetId);
				activeState.frontier.push(targetId, priority);

				// Handle intersection: record path and update salience feedback
				if (foundIntersection && otherFrontierIndex !== -1) {
					const path = this.reconstructPath(activeState, this.frontiers[otherFrontierIndex], targetId);
					if (path) {
						const signature = this.createPathSignature(activeIndex, otherFrontierIndex, path);
						if (!this.pathSignatures.has(signature)) {
							this.pathSignatures.add(signature);

							// Estimate salience for the path
							const salience = this.estimatePathSalience(path);

							this.paths.push({
								fromSeed: activeIndex,
								toSeed: otherFrontierIndex,
								nodes: path,
								salience,
							});

							// Update salience feedback (triggers phase transition check)
							await this.updateSalienceFeedback(path, salience);
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

		// Trace back from meeting point to seed B
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
	 * Create a unique signature for a path.
	 * @param fromSeed
	 * @param toSeed
	 * @param nodes
	 * @internal
	 */
	private createPathSignature(fromSeed: number, toSeed: number, nodes: string[]): string {
		const [a, b] = fromSeed < toSeed ? [fromSeed, toSeed] : [toSeed, fromSeed];
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
