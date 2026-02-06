/**
 * PageRank Sum Baseline for Path Ranking
 *
 * Ranks paths by the sum of PageRank scores along the path.
 * Paths through high-PageRank nodes receive higher scores.
 *
 * This baseline compares against Path Salience Ranking to see if
 * global importance measures (PageRank) provide different rankings
 * than local information-theoretic scoring.
 */

import { type Graph } from "../../algorithms/graph/graph";
// Import types from path-ranking
import type { RankedPath } from "../../algorithms/pathfinding/path-ranking";
import { type Path } from "../../algorithms/types/algorithm-results";
import { type Edge, type Node } from "../../algorithms/types/graph";
import { None, type Option, Some } from "../../algorithms/types/option";
import { Err as Error_, Ok, type Result } from "../../algorithms/types/result";

/**
 * Configuration for PageRank sum ranking.
 */
export interface PageRankRankingConfig {
	/**
	 * Traversal mode for path finding.
	 */
	traversalMode?: "directed" | "undirected";

	/**
	 * Maximum number of paths to return.
	 */
	maxPaths?: number;

	/**
	 * Damping factor for PageRank (default: 0.85).
	 */
	damping?: number;

	/**
	 * Maximum number of power iterations (default: 100).
	 */
	iterations?: number;
}

/**
 * Compute PageRank for all nodes using power iteration.
 *
 * PageRank assigns importance scores based on the link structure of the graph.
 * Nodes that are linked to by many important nodes receive higher scores.
 *
 * Uses a damping factor (default 0.85) and iterates until convergence
 * (threshold 1e-6) or the maximum number of iterations is reached.
 *
 * @param graph
 * @param damping - Damping factor (probability of following a link)
 * @param maxIterations - Maximum number of iterations
 */
export const computePageRank = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	damping: number,
	maxIterations: number,
): Map<string, number> => {
	const nodes = graph.getAllNodes();
	const n = nodes.length;

	if (n === 0) {
		return new Map();
	}

	const convergenceThreshold = 1e-6;
	const initialScore = 1 / n;
	const dampingComplement = (1 - damping) / n;

	// Initialise scores
	let scores = new Map<string, number>();
	for (const node of nodes) {
		scores.set(node.id, initialScore);
	}

	// Pre-compute outgoing neighbour lists and out-degrees
	const outNeighbours = new Map<string, string[]>();
	const outDegree = new Map<string, number>();

	// Build adjacency from edges
	for (const node of nodes) {
		outNeighbours.set(node.id, []);
		outDegree.set(node.id, 0);
	}

	for (const edge of graph.getAllEdges()) {
		const neighbours = outNeighbours.get(edge.source);
		if (neighbours) {
			neighbours.push(edge.target);
			outDegree.set(edge.source, (outDegree.get(edge.source) ?? 0) + 1);
		}
	}

	// Collect dangling nodes (no outgoing edges)
	const danglingNodes: string[] = [];
	for (const node of nodes) {
		if ((outDegree.get(node.id) ?? 0) === 0) {
			danglingNodes.push(node.id);
		}
	}

	// Pre-compute incoming edges for reverse lookup
	const incomingNeighbours = new Map<string, string[]>();
	for (const node of nodes) {
		incomingNeighbours.set(node.id, []);
	}
	for (const edge of graph.getAllEdges()) {
		const incoming = incomingNeighbours.get(edge.target);
		if (incoming) {
			incoming.push(edge.source);
		}
	}

	// Power iteration
	for (let iteration = 0; iteration < maxIterations; iteration++) {
		const newScores = new Map<string, number>();

		// Compute dangling node contribution (distributed equally)
		let danglingSum = 0;
		for (const nodeId of danglingNodes) {
			danglingSum += scores.get(nodeId) ?? 0;
		}
		const danglingContribution = damping * danglingSum / n;

		// Compute new scores
		for (const node of nodes) {
			let incomingScore = 0;
			const incoming = incomingNeighbours.get(node.id) ?? [];

			for (const sourceId of incoming) {
				const sourceScore = scores.get(sourceId) ?? 0;
				const sourceOutDegree = outDegree.get(sourceId) ?? 1;
				incomingScore += sourceScore / sourceOutDegree;
			}

			const newScore = dampingComplement + damping * incomingScore + danglingContribution;
			newScores.set(node.id, newScore);
		}

		// Check convergence
		let maxDifference = 0;
		for (const node of nodes) {
			const oldScore = scores.get(node.id) ?? 0;
			const newScore = newScores.get(node.id) ?? 0;
			const difference = Math.abs(newScore - oldScore);
			if (difference > maxDifference) {
				maxDifference = difference;
			}
		}

		scores = newScores;

		if (maxDifference < convergenceThreshold) {
			break;
		}
	}

	return scores;
};

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
 * Rank paths between two nodes by sum of PageRank scores.
 *
 * This baseline ranks paths by the sum of PageRank scores of all nodes
 * along the path. Paths through globally important nodes (as measured
 * by PageRank) receive higher scores.
 *
 * @template N - Node type
 * @template E - Edge type
 * @param graph - The graph to search
 * @param startId - Source node ID
 * @param endId - Target node ID
 * @param config - Optional configuration
 * @returns Result containing PageRank-ranked paths or error
 */
export const pageRankSumRanking = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	startId: string,
	endId: string,
	config: PageRankRankingConfig = {},
): Result<Option<RankedPath<N, E>[]>, { type: string; message: string }> => {
	const {
		traversalMode = "undirected",
		maxPaths = 10,
		damping = 0.85,
		iterations = 100,
	} = config;

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

	// Compute PageRank for all nodes
	const pageRankScores = computePageRank(graph, damping, iterations);

	const paths = findAllShortestPaths(graph, startId, endId, traversalMode);

	if (paths.length === 0) {
		return Ok(None());
	}

	const rankedPaths = paths.map((path) => {
		// Score is sum of PageRank scores for nodes in path
		let score = 0;
		for (const node of path.nodes) {
			score += pageRankScores.get(node.id) ?? 0;
		}

		return {
			path,
			score,
			geometricMeanMI: 0,
			edgeMIValues: [],
		};
	});

	// Sort by score descending (highest PageRank sum first)
	rankedPaths.sort((a, b) => b.score - a.score);

	const limitedPaths = rankedPaths.slice(0, maxPaths);

	return Ok(Some(limitedPaths));
};
