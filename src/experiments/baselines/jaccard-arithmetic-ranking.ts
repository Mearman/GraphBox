/**
 * Jaccard Arithmetic Mean Baseline for Path Ranking
 *
 * Ranks paths by the arithmetic mean of Jaccard similarity coefficients
 * between consecutive nodes along the path.
 *
 * This baseline compares against Path Salience Ranking to see if
 * neighbourhood overlap between adjacent nodes captures similar
 * structural relationships to information-theoretic measures.
 */

import { type Graph } from "../../algorithms/graph/graph";
// Import types from path-ranking
import type { RankedPath } from "../../algorithms/pathfinding/path-ranking";
import { type Path } from "../../algorithms/types/algorithm-results";
import { type Edge, type Node } from "../../algorithms/types/graph";
import { None, type Option, Some } from "../../algorithms/types/option";
import { Err as Error_, Ok, type Result } from "../../algorithms/types/result";

/**
 * Configuration for Jaccard arithmetic ranking.
 */
export interface JaccardRankingConfig {
	/**
	 * Traversal mode for path finding.
	 */
	traversalMode?: "directed" | "undirected";

	/**
	 * Maximum number of paths to return.
	 */
	maxPaths?: number;
}

/**
 * Find all shortest paths between two nodes using BFS.
 * @param graph
 * @param startId
 * @param endId
 * @param traversalMode
 */
const findAllShortestPaths = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	startId: string,
	endId: string,
	traversalMode: "directed" | "undirected" = "undirected",
): Path<N, E>[] => {
	if (startId === endId) {
		const node = graph.getNode(startId);
		if (node.some) {
			return [{ nodes: [node.value], edges: [], totalWeight: 0 }];
		}
		return [];
	}

	const distances = new Map<string, number>();
	const predecessors = new Map<string, Array<{ nodeId: string; edge: E }>>();

	distances.set(startId, 0);
	predecessors.set(startId, []);

	const queue: string[] = [startId];
	let targetDistance = Infinity;

	const incomingEdgesByNode = new Map<string, E[]>();
	if (traversalMode === "undirected") {
		for (const edge of graph.getAllEdges()) {
			const targetEdges = incomingEdgesByNode.get(edge.target) ?? [];
			targetEdges.push(edge);
			incomingEdgesByNode.set(edge.target, targetEdges);
		}
	}

	const getTraversableNeighbours = (current: string): Array<{ neighbour: string; edge: E }> => {
		const result: Array<{ neighbour: string; edge: E }> = [];
		const seenEdges = new Set<string>();

		const outgoing = graph.getOutgoingEdges(current);
		if (outgoing.ok) {
			for (const edge of outgoing.value) {
				const neighbour = edge.source === current ? edge.target : edge.source;
				result.push({ neighbour, edge });
				seenEdges.add(edge.id);
			}
		}

		if (traversalMode === "undirected") {
			const incoming = incomingEdgesByNode.get(current) ?? [];
			for (const edge of incoming) {
				if (!seenEdges.has(edge.id)) {
					const neighbour = edge.source;
					result.push({ neighbour, edge });
					seenEdges.add(edge.id);
				}
			}
		}

		return result;
	};

	while (queue.length > 0) {
		const current = queue.shift();
		if (current === undefined) break;

		const currentDistance = distances.get(current) ?? 0;
		if (currentDistance >= targetDistance) continue;

		const neighbours = getTraversableNeighbours(current);

		for (const { neighbour, edge } of neighbours) {
			const newDistance = currentDistance + 1;
			const existing = distances.get(neighbour);

			if (existing === undefined) {
				distances.set(neighbour, newDistance);
				predecessors.set(neighbour, [{ nodeId: current, edge }]);
				queue.push(neighbour);

				if (neighbour === endId) {
					targetDistance = newDistance;
				}
			} else if (existing === newDistance) {
				const preds = predecessors.get(neighbour);
				if (preds) {
					preds.push({ nodeId: current, edge });
				}
			}
		}
	}

	if (!distances.has(endId)) return [];

	const paths: Path<N, E>[] = [];

	const reconstructPaths = (
		nodeId: string,
		currentNodes: N[],
		currentEdges: E[],
	): void => {
		if (nodeId === startId) {
			const startNode = graph.getNode(startId);
			if (startNode.some) {
				paths.push({
					nodes: [startNode.value, ...currentNodes],
					edges: [...currentEdges].reverse(),
					totalWeight: currentEdges.length,
				});
			}
			return;
		}

		const preds = predecessors.get(nodeId);
		if (!preds) return;

		for (const { nodeId: predId, edge } of preds) {
			const predNode = graph.getNode(predId);
			const node = graph.getNode(nodeId);
			if (predNode.some && node.some) {
				reconstructPaths(predId, [node.value, ...currentNodes], [edge, ...currentEdges]);
			}
		}
	};

	reconstructPaths(endId, [], []);
	return paths;
};

/**
 * Compute Jaccard similarity coefficient between two nodes.
 *
 * Jaccard(A, B) = |neighbours(A) intersection neighbours(B)| / |neighbours(A) union neighbours(B)|
 *
 * Returns 0 if both nodes have no neighbours.
 * @param graph
 * @param nodeIdA
 * @param nodeIdB
 */
const computeJaccardSimilarity = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	nodeIdA: string,
	nodeIdB: string,
): number => {
	const resultA = graph.getNeighbors(nodeIdA);
	const resultB = graph.getNeighbors(nodeIdB);
	const neighboursA = new Set(resultA.ok ? resultA.value : []);
	const neighboursB = new Set(resultB.ok ? resultB.value : []);

	if (neighboursA.size === 0 && neighboursB.size === 0) {
		return 0;
	}

	let intersectionSize = 0;
	for (const id of neighboursA) {
		if (neighboursB.has(id)) {
			intersectionSize++;
		}
	}

	const unionSize = neighboursA.size + neighboursB.size - intersectionSize;

	if (unionSize === 0) {
		return 0;
	}

	return intersectionSize / unionSize;
};

/**
 * Rank paths between two nodes by arithmetic mean of Jaccard similarity.
 *
 * This baseline ranks paths by the arithmetic mean of Jaccard similarity
 * coefficients between consecutive node pairs along the path. Paths
 * where adjacent nodes share more neighbours receive higher scores.
 *
 * @template N - Node type
 * @template E - Edge type
 * @param graph - The graph to search
 * @param startId - Source node ID
 * @param endId - Target node ID
 * @param config - Optional configuration
 * @returns Result containing Jaccard-ranked paths or error
 */
export const jaccardArithmeticRanking = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	startId: string,
	endId: string,
	config: JaccardRankingConfig = {},
): Result<Option<RankedPath<N, E>[]>, { type: string; message: string }> => {
	const { traversalMode = "undirected", maxPaths = 10 } = config;

	const startNode = graph.getNode(startId);
	if (!startNode.some) {
		return Error_({
			type: "invalid-input",
			message: `Start node '${startId}' not found in graph`,
		});
	}

	const endNode = graph.getNode(endId);
	if (!endNode.some) {
		return Error_({
			type: "invalid-input",
			message: `End node '${endId}' not found in graph`,
		});
	}

	const paths = findAllShortestPaths(graph, startId, endId, traversalMode);

	if (paths.length === 0) {
		return Ok(None());
	}

	const rankedPaths = paths.map((path) => {
		// Score is arithmetic mean of Jaccard similarity between consecutive nodes
		let score = 0;

		if (path.nodes.length < 2) {
			return {
				path,
				score: 0,
				geometricMeanMI: 0,
				edgeMIValues: [],
			};
		}

		let totalJaccard = 0;
		const pairCount = path.nodes.length - 1;

		for (let index = 0; index < pairCount; index++) {
			totalJaccard += computeJaccardSimilarity(graph, path.nodes[index].id, path.nodes[index + 1].id);
		}

		score = totalJaccard / pairCount;

		return {
			path,
			score,
			geometricMeanMI: 0,
			edgeMIValues: [],
		};
	});

	// Sort by score descending (highest Jaccard mean first)
	rankedPaths.sort((a, b) => b.score - a.score);

	const limitedPaths = rankedPaths.slice(0, maxPaths);

	return Ok(Some(limitedPaths));
};
