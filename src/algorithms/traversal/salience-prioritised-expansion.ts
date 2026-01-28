import { GraphExpander } from "../../interfaces/graph-expander.js";
import type { DegreePrioritisedExpansionResult, ExpansionStats } from "./degree-prioritised-expansion.js";
import { PriorityQueue } from "./priority-queue.js";

/**
 * Salience-Prioritised Multi-Seed Graph Expansion
 *
 * **Novel Contribution**: Path quality-aware node expansion that prioritizes
 * nodes based on their participation in high-salience paths, rather than
 * degree-based prioritization.
 *
 * **Key Innovation**: Unlike degree-prioritised expansion (which avoids hubs
 * by expanding low-degree nodes first), salience-prioritised expansion actively
 * seeks out nodes that appear in high-quality (high-MI) paths. This should
 * result in higher salience coverage because the expansion naturally gravitates
 * toward the same paths that Path Salience ranking identifies as important.
 *
 * **Design Relationship**:
 * - DegreePrioritisedExpansion: Priority = node degree (ascending)
 * - SaliencePrioritisedExpansion: Priority = node salience score (descending)
 *
 * **Priority Function**:
 * - Primary: Node salience score (higher = better priority)
 * - Secondary: Node degree (lower = better, for tie-breaking hub avoidance)
 *
 * **Expected Behavior**:
 * - Higher salience coverage than degree-prioritised expansion
 * - Discovered paths should more closely match Path Salience top-K
 * - May sacrifice some hub-avoidance for path quality
 *
 * @template T - Node data type
 */
export class SaliencePrioritisedExpansion<T> implements GraphExpander<T> {
	/** Salience scores for each node (pre-computed from Path Salience ranking) */
	private readonly nodeSalience: Map<string, number>;

	/** The underlying graph expander for neighbor access */
	private readonly expander: GraphExpander<T>;

	/** Seed nodes for expansion */
	private readonly seeds: string[];

	/** Frontiers (one per seed) */
	private readonly frontiers: Array<{
		index: number;
		frontier: PriorityQueue<string>;
		visited: Set<string>;
		parents: Map<string, { parent: string; edge: string }>;
	}> = [];

	/** Statistics collected during expansion */
	private stats: ExpansionStats = {
		nodesExpanded: 0,
		edgesTraversed: 0,
		iterations: 0,
		degreeDistribution: new Map(),
	};

	/** Discovered paths between seed pairs */
	private readonly paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }> = [];

	/** Track which frontier owns each node */
	private readonly nodeToFrontierIndex = new Map<string, number>();

	/** Track which seed pairs have connected */
	private readonly connectedPairs = new Set<string>();

	/** Tracks when each node was first discovered (iteration number) */
	private readonly nodeDiscoveryIteration = new Map<string, number>();

	/**
	 * Create a new salience-prioritised expansion.
	 *
	 * @param expander - Underlying graph expander for neighbor access
	 * @param seeds - Array of seed node IDs
	 * @param nodeSalience - Map of node ID to salience score (appearance count in top-K paths)
	 */
	constructor(expander: GraphExpander<T>, seeds: string[], nodeSalience: Map<string, number>) {
		if (seeds.length === 0) {
			throw new Error("At least one seed node is required");
		}

		this.expander = expander;
		this.seeds = seeds;
		this.nodeSalience = nodeSalience;

		// Initialize frontiers
		for (const [index, seed] of seeds.entries()) {
			const frontier = new PriorityQueue<string>();
			// Priority: [salience score, -degree] for max-heap on salience, min on degree
			const priority = expander.calculatePriority(seed);
			const salience = this.nodeSalience.get(seed) ?? 0;
			// Composite priority: higher salience is better, same salience -> lower degree is better
			frontier.push(seed, salience * 1000 - priority); // Scale salience to dominate degree

			this.frontiers.push({
				index,
				frontier,
				visited: new Set([seed]),
				parents: new Map(),
			});

			this.nodeToFrontierIndex.set(seed, index);

			// Seeds are discovered at iteration 0
			this.nodeDiscoveryIteration.set(seed, 0);
		}
	}

	/**
	 * Get neighbors of a node.
	 * @param nodeId
	 */
	async getNeighbors(nodeId: string): Promise<{ targetId: string; relationshipType: string }[]> {
		return this.expander.getNeighbors(nodeId);
	}

	/**
	 * Get node degree for priority computation.
	 * @param nodeId
	 */
	getDegree(nodeId: string): number {
		return this.expander.getDegree(nodeId);
	}

	/**
	 * Calculate weighted priority (delegates to underlying expander).
	 * @param nodeId
	 */
	calculatePriority(nodeId: string): number {
		return this.expander.calculatePriority(nodeId);
	}

	/**
	 * Get node data.
	 * @param nodeId
	 */
	async getNode(nodeId: string): Promise<T | null> {
		return this.expander.getNode(nodeId);
	}

	/**
	 * Add an edge to the output.
	 * @param source
	 * @param target
	 * @param relationshipType
	 */
	addEdge(source: string, target: string, relationshipType: string): void {
		this.expander.addEdge(source, target, relationshipType);
	}

	/**
	 * Run the expansion to completion.
	 */
	async run(): Promise<DegreePrioritisedExpansionResult> {
		// Main expansion loop
		while (this.hasNonEmptyFrontier()) {
			this.stats.iterations++;

			// Select frontier with highest-salience node
			const activeIndex = this.selectHighestSalienceFrontier();
			if (activeIndex === -1) break;

			const activeState = this.frontiers[activeIndex];
			const node = activeState.frontier.pop();
			if (!node) continue;

			this.stats.nodesExpanded++;
			this.recordDegree(this.expander.getDegree(node));

			// Expand neighbors
			const neighbors = await this.expander.getNeighbors(node);

			for (const { targetId, relationshipType } of neighbors) {
				if (activeState.visited.has(targetId)) continue;

				this.stats.edgesTraversed++;

				// Add edge to output
				this.expander.addEdge(node, targetId, relationshipType);

				// Track visited and set parent
				activeState.visited.add(targetId);
				activeState.parents.set(targetId, { parent: node, edge: relationshipType });
				this.nodeToFrontierIndex.set(targetId, activeIndex);

				// Track first discovery iteration (only if not already discovered)
				if (!this.nodeDiscoveryIteration.has(targetId)) {
					this.nodeDiscoveryIteration.set(targetId, this.stats.iterations);
				}

				// Add to frontier with salience priority
				const neighborSalience = this.nodeSalience.get(targetId) ?? 0;
				const priority = neighborSalience * 1000 - this.expander.calculatePriority(targetId);
				activeState.frontier.push(targetId, priority);

				// Check for intersections with other frontiers
				for (let otherIndex = 0; otherIndex < this.frontiers.length; otherIndex++) {
					if (otherIndex === activeIndex) continue;

					const otherState = this.frontiers[otherIndex];
					if (otherState.visited.has(targetId)) {
						const pairKey = [activeIndex, otherIndex].sort((a, b) => a - b).join("-");
						if (!this.connectedPairs.has(pairKey)) {
							// Reconstruct path
							const path = this.reconstructPath(activeState, otherState, targetId);
							if (path.length > 0) {
								this.paths.push({
									fromSeed: activeIndex,
									toSeed: otherIndex,
									nodes: path,
								});
								this.connectedPairs.add(pairKey);
							}
						}
					}
				}
			}
		}

		// Gather sampled nodes and edges
		const sampledNodes = new Set<string>();
		const sampledEdges = new Set<string>();
		const visitedPerFrontier: Array<Set<string>> = [];

		for (const frontier of this.frontiers) {
			for (const node of frontier.visited) {
				sampledNodes.add(node);
			}
			visitedPerFrontier.push(new Set(frontier.visited));
		}

		return {
			paths: this.paths,
			sampledNodes,
			sampledEdges,
			visitedPerFrontier,
			stats: this.stats,
			nodeDiscoveryIteration: this.nodeDiscoveryIteration,
		};
	}

	/**
	 * Check if any frontier has unexpanded nodes.
	 */
	private hasNonEmptyFrontier(): boolean {
		return this.frontiers.some((f) => f.frontier.length > 0);
	}

	/**
	 * Select the frontier with the highest-salience node.
	 */
	private selectHighestSalienceFrontier(): number {
		let bestIndex = -1;
		let bestPriority = -Infinity;

		for (let index = 0; index < this.frontiers.length; index++) {
			const frontier = this.frontiers[index];
			if (frontier.frontier.length === 0) continue;

			const priority = frontier.frontier.peekPriority();
			if (priority > bestPriority) {
				bestPriority = priority;
				bestIndex = index;
			}
		}

		return bestIndex;
	}

	/**
	 * Reconstruct path between two seeds using parent pointers.
	 * @param fromFrontier
	 * @param fromFrontier.index
	 * @param fromFrontier.visited
	 * @param fromFrontier.parents
	 * @param toFrontier
	 * @param toFrontier.index
	 * @param toFrontier.visited
	 * @param toFrontier.parents
	 * @param meetingNode
	 */
	private reconstructPath(
		fromFrontier: { index: number; visited: Set<string>; parents: Map<string, { parent: string; edge: string }> },
		toFrontier: { index: number; visited: Set<string>; parents: Map<string, { parent: string; edge: string }> },
		meetingNode: string
	): string[] {
		// Trace back from meetingNode to fromFrontier's seed
		const pathFromStart: string[] = [];
		let current = meetingNode;
		while (fromFrontier.parents.has(current)) {
			pathFromStart.push(current);
			const parentData = fromFrontier.parents.get(current);
			if (!parentData) break;
			current = parentData.parent;
		}
		pathFromStart.push(current); // Add the seed node
		pathFromStart.reverse();

		// Trace forward from meetingNode to toFrontier's seed (excluding meetingNode to avoid dup)
		const pathToEnd: string[] = [];
		current = meetingNode;
		while (toFrontier.parents.has(current)) {
			const parentData = toFrontier.parents.get(current);
			if (!parentData) break;
			current = parentData.parent;
			if (current !== meetingNode) { // Don't duplicate meetingNode
				pathToEnd.push(current);
			}
		}

		return [...pathFromStart, ...pathToEnd];
	}

	/**
	 * Record degree in statistics.
	 * @param degree
	 */
	private recordDegree(degree: number): void {
		const bucket = this.getDegreeBucket(degree);
		const count = this.stats.degreeDistribution.get(bucket) ?? 0;
		this.stats.degreeDistribution.set(bucket, count + 1);
	}

	/**
	 * Get degree bucket for statistics.
	 * @param degree
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
 * Compute node salience scores from top-K salient paths.
 *
 * For each node, counts how many times it appears in the top-K salient paths.
 * Nodes that appear more frequently in high-quality paths get higher scores.
 *
 * @param topKPaths - Array of top-K salient paths (as node ID arrays)
 * @returns Map of node ID to salience score (appearance count)
 */
export const computeNodeSalienceScores = (topKPaths: string[][]): Map<string, number> => {
	const scores = new Map<string, number>();

	for (const path of topKPaths) {
		const uniqueNodes = new Set(path); // Count each node once per path
		for (const node of uniqueNodes) {
			scores.set(node, (scores.get(node) ?? 0) + 1);
		}
	}

	return scores;
};

/**
 * Compute node salience scores directly from Path Salience ranking results.
 *
 * Extracts node IDs from ranked path objects and computes appearance counts.
 *
 * @param rankedPaths - Array of ranked paths from Path Salience algorithm
 * @returns Map of node ID to salience score
 */
export const computeNodeSalienceFromRankedPaths = (rankedPaths: Array<{ path: { nodes: Array<{ id: string }> } }>): Map<string, number> => {
	const topKPaths = rankedPaths.map((p) => p.path.nodes.map((n) => n.id));
	return computeNodeSalienceScores(topKPaths);
};
