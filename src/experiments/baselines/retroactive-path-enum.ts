import type { GraphExpander } from "../../interfaces/graph-expander";

/**
 * Generic expansion result type - compatible with all baseline results.
 */
export interface ExpansionResult {
	/** Union of all nodes visited during expansion */
	sampledNodes: Set<string>;

	/** Set of edges visited during expansion */
	sampledEdges: Set<string>;
}

/**
 * Result from retroactive path enumeration.
 */
export interface RetroactivePathEnumerationResult {
	/** All simple paths found between seed pairs */
	paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }>;

	/** Statistics about enumeration */
	stats: RetroactivePathEnumerationStats;
}

/**
 * Statistics collected during retroactive path enumeration.
 */
export interface RetroactivePathEnumerationStats {
	/** Total simple paths enumerated */
	totalPaths: number;

	/** Number of seed pairs processed */
	seedPairsProcessed: number;

	/** Average paths per seed pair */
	avgPathsPerPair: number;

	/** Path length distribution */
	pathLengthDistribution: Map<number, number>;
}

/**
 * Retroactive Path Enumeration
 *
 * Post-processing function that takes ANY expansion result (from BFS,
 * degree-prioritised, random, etc.) and enumerates ALL simple paths
 * through the discovered subgraph.
 *
 * **Key Properties**:
 * - Works with any expansion result (union of sampled nodes)
 * - Uses DFS with backtracking to find all simple paths
 * - Depth-limited for tractability on large subgraphs
 * - Pure post-processing (doesn't modify original expansion)
 *
 * **Experimental Purpose**:
 * Disentangles path discovery mechanism from path enumeration completeness.
 * Tests whether different expansion strategies produce subgraphs with
 * different path densities or diversity, independent of online path detection.
 *
 * **Use Case**:
 * Compare path diversity across expansion strategies after exhaustive
 * enumeration. If Strategy A finds more paths than Strategy B retroactively,
 * A's subgraph is structurally richer (not just faster to converge).
 *
 * **Note**: This can be expensive on dense subgraphs. Use maxLength to
 * control tractability.
 */

/**
 * Enumerate all simple paths between seed pairs in a sampled subgraph.
 *
 * @param result - Expansion result containing sampledNodes
 * @param expander - Graph expander providing neighbour access
 * @param seeds - Array of seed node IDs (N >= 2)
 * @param maxLength - Maximum path length to explore (default: 20)
 * @returns Enumeration results including all discovered paths
 *
 * @example
 * ```typescript
 * // Run standard BFS
 * const bfsExpansion = new StandardBfsExpansion(expander, seeds);
 * const bfsResult = await bfsExpansion.run();
 *
 * // Retroactively enumerate all paths through BFS subgraph
 * const enumResult = await retroactivePathEnumeration(
 *   bfsResult,
 *   expander,
 *   seeds,
 *   20
 * );
 *
 * console.log(`BFS found ${bfsResult.paths.length} paths online`);
 * console.log(`Retroactive enumeration found ${enumResult.paths.length} paths`);
 * ```
 */
export const retroactivePathEnumeration = async <T>(result: ExpansionResult, expander: GraphExpander<T>, seeds: readonly string[], maxLength = 20): Promise<RetroactivePathEnumerationResult> => {
	if (seeds.length < 2) {
		throw new Error("At least two seeds required for path enumeration");
	}

	const paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }> = [];
	const pathLengthDistribution = new Map<number, number>();

	let seedPairsProcessed = 0;

	// For each pair of seeds, find all simple paths
	for (let fromIndex = 0; fromIndex < seeds.length; fromIndex++) {
		for (let toIndex = fromIndex + 1; toIndex < seeds.length; toIndex++) {
			const fromSeed = seeds[fromIndex];
			const toSeed = seeds[toIndex];

			const pathsBetween = await findAllSimplePaths(
				fromSeed,
				toSeed,
				result.sampledNodes,
				expander,
				maxLength
			);

			for (const path of pathsBetween) {
				paths.push({
					fromSeed: fromIndex,
					toSeed: toIndex,
					nodes: path,
				});

				// Record path length distribution
				const length = path.length;
				const count = pathLengthDistribution.get(length) ?? 0;
				pathLengthDistribution.set(length, count + 1);
			}

			seedPairsProcessed++;
		}
	}

	const avgPathsPerPair = seedPairsProcessed > 0 ? paths.length / seedPairsProcessed : 0;

	return {
		paths,
		stats: {
			totalPaths: paths.length,
			seedPairsProcessed,
			avgPathsPerPair,
			pathLengthDistribution,
		},
	};
};

/**
 * Find all simple paths between two nodes within a sampled subgraph.
 * Uses DFS with backtracking and depth limit for tractability.
 *
 * @param start - Start node ID
 * @param end - End node ID
 * @param allowedNodes - Set of nodes in the sampled subgraph
 * @param expander - Graph expander providing neighbour access
 * @param maxDepth - Maximum path length to explore
 * @returns Array of simple paths (each path is array of node IDs)
 * @internal
 */
const findAllSimplePaths = async <T>(start: string, end: string, allowedNodes: Set<string>, expander: GraphExpander<T>, maxDepth: number): Promise<string[][]> => {
	const paths: string[][] = [];
	const visited = new Set<string>();

	const dfs = async (current: string, path: string[], depth: number) => {
		if (depth > maxDepth) return;

		if (current === end) {
			paths.push([...path]);
			return;
		}

		visited.add(current);

		const neighbors = await expander.getNeighbors(current);
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
};
