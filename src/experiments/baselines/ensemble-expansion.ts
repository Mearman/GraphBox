import type { GraphExpander } from "../../interfaces/graph-expander";

/**
 * Result from ensemble expansion.
 */
export interface EnsembleExpansionResult {
	/** Discovered paths (enumerated through union subgraph) */
	paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }>;

	/** Union of all nodes visited by all strategies */
	sampledNodes: Set<string>;

	/** Set of edges visited during expansion */
	sampledEdges: Set<string>;

	/** Per-strategy sampled nodes (for diagnostics) */
	sampledNodesPerStrategy: Map<string, Set<string>>;

	/** Statistics about the expansion */
	stats: EnsembleExpansionStats;
}

/**
 * Statistics collected during ensemble expansion.
 */
export interface EnsembleExpansionStats {
	/** Total nodes in union across all strategies */
	totalUnionNodes: number;

	/** Breakdown of node counts per strategy */
	nodesPerStrategy: Map<string, number>;

	/** Overlap statistics between strategies */
	strategyOverlap: Map<string, number>;

	/** Total paths enumerated through union */
	totalPaths: number;
}

/**
 * State for a single BFS frontier.
 * @internal
 */
interface BfsFrontierState {
	index: number;
	queue: string[];
	visited: Set<string>;
	parents: Map<string, string>;
}

/**
 * State for a single DFS frontier.
 * @internal
 */
interface DfsFrontierState {
	index: number;
	stack: string[];
	visited: Set<string>;
	parents: Map<string, string>;
}

/**
 * State for a single degree-priority frontier.
 * @internal
 */
interface DegreePriorityFrontierState {
	index: number;
	frontier: Array<{ nodeId: string; degree: number }>;
	visited: Set<string>;
	parents: Map<string, string>;
}

/**
 * Ensemble Expansion (Union of BFS, DFS, Degree-Priority)
 *
 * Baseline algorithm that combines results from three different expansion
 * strategies: standard BFS, depth-first search (DFS), and degree-prioritised.
 * Enumerates all paths through the union of discovered subgraphs.
 *
 * **Key Properties**:
 * - Runs BFS, DFS, and degree-priority expansion independently
 * - Computes union of all visited nodes across strategies
 * - Enumerates ALL simple paths through union subgraph
 * - Terminates when all strategies complete
 *
 * **Experimental Purpose**:
 * Tests whether combining multiple exploration strategies provides better
 * coverage and path diversity than any single strategy alone. If ensemble
 * outperforms degree-prioritised, strategy diversity matters. If not,
 * a single well-chosen strategy suffices.
 *
 * **Note**: Path enumeration through large unions can be expensive.
 * Consider depth limits for tractability.
 *
 * @template T - Type of node data returned by expander
 */
export class EnsembleExpansion<T> {
	private readonly sampledEdges = new Set<string>();
	private stats: EnsembleExpansionStats;

	/**
	 * Create a new ensemble expansion.
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

		this.stats = {
			totalUnionNodes: 0,
			nodesPerStrategy: new Map(),
			strategyOverlap: new Map(),
			totalPaths: 0,
		};
	}

	/**
	 * Run the ensemble expansion to completion.
	 *
	 * Executes BFS, DFS, and degree-priority strategies in sequence,
	 * then enumerates paths through the union.
	 *
	 * @returns Ensemble results including paths and union subgraph
	 */
	async run(): Promise<EnsembleExpansionResult> {
		// Run three independent expansion strategies
		const bfsNodes = await this.runBfs();
		const dfsNodes = await this.runDfs();
		const degreeNodes = await this.runDegreePriority();

		// Compute union of all discovered nodes
		const sampledNodes = new Set<string>();
		for (const node of bfsNodes) sampledNodes.add(node);
		for (const node of dfsNodes) sampledNodes.add(node);
		for (const node of degreeNodes) sampledNodes.add(node);

		// Record per-strategy statistics
		this.stats.nodesPerStrategy.set("bfs", bfsNodes.size);
		this.stats.nodesPerStrategy.set("dfs", dfsNodes.size);
		this.stats.nodesPerStrategy.set("degree-priority", degreeNodes.size);
		this.stats.totalUnionNodes = sampledNodes.size;

		// Compute overlap statistics
		const bfsDfsOverlap = new Set([...bfsNodes].filter((n) => dfsNodes.has(n)));
		const bfsDegreeOverlap = new Set([...bfsNodes].filter((n) => degreeNodes.has(n)));
		const dfsDegreeOverlap = new Set([...dfsNodes].filter((n) => degreeNodes.has(n)));
		const allThreeOverlap = new Set([...bfsNodes].filter((n) => dfsNodes.has(n) && degreeNodes.has(n)));

		this.stats.strategyOverlap.set("bfs-dfs", bfsDfsOverlap.size);
		this.stats.strategyOverlap.set("bfs-degree", bfsDegreeOverlap.size);
		this.stats.strategyOverlap.set("dfs-degree", dfsDegreeOverlap.size);
		this.stats.strategyOverlap.set("all-three", allThreeOverlap.size);

		// Enumerate all paths through union subgraph
		const paths = await this.enumeratePathsThroughUnion(sampledNodes);
		this.stats.totalPaths = paths.length;

		const sampledNodesPerStrategy = new Map<string, Set<string>>([["bfs", bfsNodes], ["dfs", dfsNodes], ["degree-priority", degreeNodes]]);

		return {
			paths,
			sampledNodes,
			sampledEdges: this.sampledEdges,
			sampledNodesPerStrategy,
			stats: this.stats,
		};
	}

	/**
	 * Run standard BFS expansion.
	 * @returns Set of visited nodes
	 * @internal
	 */
	private async runBfs(): Promise<Set<string>> {
		const frontiers: BfsFrontierState[] = [];
		const allVisited = new Set<string>();

		for (const [index, seed] of this.seeds.entries()) {
			frontiers.push({
				index,
				queue: [seed],
				visited: new Set([seed]),
				parents: new Map(),
			});
			allVisited.add(seed);
		}

		while (frontiers.some((f) => f.queue.length > 0)) {
			for (const frontier of frontiers) {
				if (frontier.queue.length === 0) continue;

				const node = frontier.queue.shift();
				if (node === undefined) continue;
				const neighbors = await this.expander.getNeighbors(node);

				for (const { targetId, relationshipType } of neighbors) {
					if (frontier.visited.has(targetId)) continue;

					frontier.visited.add(targetId);
					allVisited.add(targetId);
					frontier.parents.set(targetId, node);
					frontier.queue.push(targetId);

					const edgeKey = `${node}->${targetId}`;
					this.sampledEdges.add(edgeKey);
					this.expander.addEdge(node, targetId, relationshipType);
				}
			}
		}

		return allVisited;
	}

	/**
	 * Run depth-first search expansion.
	 * @returns Set of visited nodes
	 * @internal
	 */
	private async runDfs(): Promise<Set<string>> {
		const frontiers: DfsFrontierState[] = [];
		const allVisited = new Set<string>();

		for (const [index, seed] of this.seeds.entries()) {
			frontiers.push({
				index,
				stack: [seed],
				visited: new Set([seed]),
				parents: new Map(),
			});
			allVisited.add(seed);
		}

		while (frontiers.some((f) => f.stack.length > 0)) {
			for (const frontier of frontiers) {
				if (frontier.stack.length === 0) continue;

				const node = frontier.stack.pop();
				if (node === undefined) continue;
				const neighbors = await this.expander.getNeighbors(node);

				for (const { targetId, relationshipType } of neighbors) {
					if (frontier.visited.has(targetId)) continue;

					frontier.visited.add(targetId);
					allVisited.add(targetId);
					frontier.parents.set(targetId, node);
					frontier.stack.push(targetId);

					const edgeKey = `${node}->${targetId}`;
					this.sampledEdges.add(edgeKey);
					this.expander.addEdge(node, targetId, relationshipType);
				}
			}
		}

		return allVisited;
	}

	/**
	 * Run degree-prioritised expansion.
	 * @returns Set of visited nodes
	 * @internal
	 */
	private async runDegreePriority(): Promise<Set<string>> {
		const frontiers: DegreePriorityFrontierState[] = [];
		const allVisited = new Set<string>();

		for (const [index, seed] of this.seeds.entries()) {
			frontiers.push({
				index,
				frontier: [{ nodeId: seed, degree: this.expander.getDegree(seed) }],
				visited: new Set([seed]),
				parents: new Map(),
			});
			allVisited.add(seed);
		}

		while (frontiers.some((f) => f.frontier.length > 0)) {
			for (const frontier of frontiers) {
				if (frontier.frontier.length === 0) continue;

				// Sort by degree (ascending - prefer low-degree nodes)
				frontier.frontier.sort((a, b) => a.degree - b.degree);
				const item = frontier.frontier.shift();
				if (item === undefined) continue;

				const neighbors = await this.expander.getNeighbors(item.nodeId);

				for (const { targetId, relationshipType } of neighbors) {
					if (frontier.visited.has(targetId)) continue;

					frontier.visited.add(targetId);
					allVisited.add(targetId);
					frontier.parents.set(targetId, item.nodeId);

					const degree = this.expander.getDegree(targetId);
					frontier.frontier.push({ nodeId: targetId, degree });

					const edgeKey = `${item.nodeId}->${targetId}`;
					this.sampledEdges.add(edgeKey);
					this.expander.addEdge(item.nodeId, targetId, relationshipType);
				}
			}
		}

		return allVisited;
	}

	/**
	 * Enumerate all simple paths through the union subgraph.
	 * Uses DFS with backtracking to find all paths between seed pairs.
	 *
	 * @param nodes - Union of nodes from all strategies
	 * @returns Array of paths between all seed pairs
	 * @internal
	 */
	private async enumeratePathsThroughUnion(
		nodes: Set<string>
	): Promise<Array<{ fromSeed: number; toSeed: number; nodes: string[] }>> {
		const paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }> = [];

		// Only enumerate paths if we have multiple seeds
		if (this.seeds.length < 2) return paths;

		// For each pair of seeds, find all simple paths
		for (let fromIndex = 0; fromIndex < this.seeds.length; fromIndex++) {
			for (let toIndex = fromIndex + 1; toIndex < this.seeds.length; toIndex++) {
				const fromSeed = this.seeds[fromIndex];
				const toSeed = this.seeds[toIndex];

				const pathsBetween = await this.findAllSimplePaths(fromSeed, toSeed, nodes, 20);

				for (const path of pathsBetween) {
					paths.push({
						fromSeed: fromIndex,
						toSeed: toIndex,
						nodes: path,
					});
				}
			}
		}

		return paths;
	}

	/**
	 * Find all simple paths between two nodes within the sampled subgraph.
	 * Uses DFS with backtracking and depth limit for tractability.
	 *
	 * @param start - Start node ID
	 * @param end - End node ID
	 * @param allowedNodes - Set of nodes in the sampled subgraph
	 * @param maxDepth - Maximum path length to explore
	 * @returns Array of simple paths (each path is array of node IDs)
	 * @internal
	 */
	private async findAllSimplePaths(
		start: string,
		end: string,
		allowedNodes: Set<string>,
		maxDepth: number
	): Promise<string[][]> {
		const paths: string[][] = [];
		const visited = new Set<string>();

		const dfs = async (current: string, path: string[], depth: number) => {
			if (depth > maxDepth) return;

			if (current === end) {
				paths.push([...path]);
				return;
			}

			visited.add(current);

			const neighbors = await this.expander.getNeighbors(current);
			for (const { targetId } of neighbors) {
				if (!allowedNodes.has(targetId) || visited.has(targetId)) continue;

				path.push(targetId);
				await dfs(targetId, path, depth + 1);
				path.pop();
			}

			visited.delete(current);
		};

		await dfs(start, [start], 0);
		return paths;
	}
}
