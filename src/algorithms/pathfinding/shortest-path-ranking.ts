/**
 * Shortest Path Ranking for Graph Analysis
 *
 * Finds k-shortest paths between two nodes using Dijkstra's algorithm.
 * Used as a baseline for path ranking experiments.
 */

import { type Graph } from "../graph/graph.js";
import { type GraphError } from "../types/errors.js";
import { type Edge, type Node } from "../types/graph.js";
import { Err as Error_, Ok, type Result } from "../types/result.js";
import { dijkstra } from "./dijkstra.js";
import { type RankedPath } from "./path-ranking.js";

/**
 * Configuration for shortest path ranking.
 */
export interface ShortestPathRankingConfig {
	/** Maximum number of paths to find */
	maxPaths?: number;
}

/**
 * Find k-shortest paths between source and target.
 *
 * Uses a modified Dijkstra approach: finds shortest path, then iteratively
 * finds next-shortest paths by removing edges from previously found paths.
 *
 * Note: This is a simplified k-shortest paths implementation. For production,
 * consider Yen's algorithm or Eppstein's algorithm for better performance.
 * @param graph - The graph to search
 * @param sourceId - Starting node ID
 * @param targetId - Ending node ID
 * @param config - Configuration for pathfinding
 * @returns Result containing array of ranked paths or error
 */
export const shortestPathRanking = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	sourceId: string,
	targetId: string,
	config: ShortestPathRankingConfig = {}
): Result<Array<RankedPath<N, E>>, GraphError> => {
	const { maxPaths = 10 } = config;

	// Validate inputs
	const sourceNode = graph.getNode(sourceId);
	if (!sourceNode.some) {
		return Error_({
			type: "invalid-input",
			message: `Source node '${sourceId}' not found`,
		});
	}

	const targetNode = graph.getNode(targetId);
	if (!targetNode.some) {
		return Error_({
			type: "invalid-input",
			message: `Target node '${targetId}' not found`,
		});
	}

	const paths: Array<RankedPath<N, E>> = [];
	const excludedEdgeSets: Array<Set<string>> = [];

	// Find up to maxPaths paths
	for (let k = 0; k < maxPaths; k++) {
		// Find shortest path avoiding excluded edges
		const pathResult = findShortestPathExcluding(
			graph,
			sourceId,
			targetId,
			k > 0 ? excludedEdgeSets[k - 1] : new Set()
		);

		if (!pathResult.ok || !pathResult.value.some) {
			// No more paths available
			break;
		}

		const path = pathResult.value.value;

		// Convert to RankedPath format
		const rankedPath: RankedPath<N, E> = {
			path,
			score: path.nodes.length, // Rank by length (shorter is better)
			geometricMeanMI: 0, // Placeholder: would need MI calculation
			edgeMIValues: path.edges.map(() => 0), // Placeholder
		};
		paths.push(rankedPath);

		// For next iteration, exclude edges from this path
		const newExcludedSet = new Set(
			k > 0 ? excludedEdgeSets[k - 1] : []
		);
		for (const edge of path.edges) {
			newExcludedSet.add(edgeKey(edge));
		}
		excludedEdgeSets.push(newExcludedSet);
	}

	return Ok(paths);
};

/**
 * Create a unique key for an edge.
 * @param edge - The edge to create a key for
 * @returns String key for the edge
 */
const edgeKey = <E extends Edge>(edge: E): string => {
	return `${edge.source}->${edge.target}`;
};

/**
 * Find shortest path while excluding specified edges.
 * @param graph - The graph to search
 * @param sourceId - Starting node ID
 * @param targetId - Ending node ID
 * @param excludedEdges - Set of edge keys to exclude
 * @returns Result containing optional path or error
 */
const findShortestPathExcluding = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	sourceId: string,
	targetId: string,
	excludedEdges: Set<string>
): ReturnType<typeof dijkstra<N, E>> => {
	// Create a weight function that returns Infinity for excluded edges
	const weightFunction = (edge: E): number => {
		const key = edgeKey(edge);
		if (excludedEdges.has(key)) {
			return Infinity;
		}
		return edge.weight ?? 1;
	};

	return dijkstra(graph, sourceId, targetId, weightFunction);
};
