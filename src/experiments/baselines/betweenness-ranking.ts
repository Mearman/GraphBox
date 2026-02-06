/**
 * Betweenness Centrality Baseline for Path Ranking
 *
 * Ranks paths by the sum of node betweenness centrality values.
 * Paths through high-centrality nodes receive higher scores.
 *
 * This baseline compares against Path Salience Ranking to see if
 * information-theoretic scoring provides different results than
 * structural centrality measures.
 */

import { type Graph } from "../../algorithms/graph/graph";
// Import types from path-ranking
import type { RankedPath } from "../../algorithms/pathfinding/path-ranking";
import { type Path } from "../../algorithms/types/algorithm-results";
import { type Edge, type Node } from "../../algorithms/types/graph";
import { None, type Option, Some } from "../../algorithms/types/option";
import { Err as Error_, Ok, type Result } from "../../algorithms/types/result";

/**
 * Configuration for betweenness ranking.
 */
export interface BetweennessConfig {
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
 * Compute betweenness centrality for all nodes using Brandes' algorithm.
 *
 * Betweenness centrality measures how often a node appears on shortest paths
 * between other nodes. Higher values indicate the node is a key connector.
 *
 * Time Complexity: O(VE) for unweighted graphs
 * Space Complexity: O(V)
 * @param graph
 * @param traversalMode
 */
export const computeBetweennessCentrality = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	traversalMode: "directed" | "undirected",
): Map<string, number> => {
	const nodes = graph.getAllNodes();
	const _nodeIds = new Map(nodes.map((n, index) => [n.id, index]));
	const n = nodes.length;

	const betweenness = new Map<string, number>();
	for (const node of nodes) {
		betweenness.set(node.id, 0);
	}

	// Pre-compute incoming edges for undirected traversal
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

	// Brandes' algorithm: for each source node, compute shortest paths
	for (const source of nodes) {
		const sourceId = source.id;

		// Data structures for BFS from source
		const stack: string[] = [];
		const predecessors = new Map<string, string[]>();
		const sigma = new Map<string, number>(); // Number of shortest paths to each node
		const distance = new Map<string, number>();

		for (const node of nodes) {
			predecessors.set(node.id, []);
			sigma.set(node.id, 0);
			distance.set(node.id, -1);
		}

		sigma.set(sourceId, 1);
		distance.set(sourceId, 0);

		const queue: string[] = [sourceId];

		// BFS to find shortest paths
		while (queue.length > 0) {
			const current = queue.shift();
			if (current === undefined) break;
			stack.push(current);

			const currentDistance = distance.get(current) ?? 0;

			const neighbours = getTraversableNeighbours(current);
			for (const { neighbour } of neighbours) {
				const neighbourDistance = distance.get(neighbour) ?? -1;
				// First time discovering neighbour
				if (neighbourDistance === -1) {
					distance.set(neighbour, currentDistance + 1);
					queue.push(neighbour);
				}

				// Found another shortest path to neighbour
				const updatedNeighbourDistance = distance.get(neighbour) ?? -1;
				if (updatedNeighbourDistance === currentDistance + 1) {
					const sigmaNeighbour = sigma.get(neighbour) ?? 0;
					const sigmaCurrent = sigma.get(current) ?? 0;
					sigma.set(neighbour, sigmaNeighbour + sigmaCurrent);
					const preds = predecessors.get(neighbour);
					if (preds) {
						preds.push(current);
					}
				}
			}
		}

		// Accumulate betweenness using dependency values
		const delta = new Map<string, number>();
		for (const node of nodes) {
			delta.set(node.id, 0);
		}

		// Process nodes in reverse order of discovery
		while (stack.length > 0) {
			const current = stack.pop();
			if (current === undefined) break;

			const preds = predecessors.get(current);
			if (preds) {
				const sigmaCurrent = sigma.get(current) ?? 0;
				const deltaCurrent = delta.get(current) ?? 0;
				for (const pred of preds) {
					const sigmaPred = sigma.get(pred) ?? 0;
					const deltaPred = delta.get(pred) ?? 0;
					const contribution = (sigmaPred / sigmaCurrent) * (1 + deltaCurrent);
					delta.set(pred, deltaPred + contribution);
				}
			}

			if (current !== sourceId) {
				const betweennessCurrent = betweenness.get(current) ?? 0;
				const deltaCurrent = delta.get(current) ?? 0;
				betweenness.set(current, betweennessCurrent + deltaCurrent);
			}
		}
	}

	// Normalise betweenness (for undirected graphs, divide by 2)
	const scale = traversalMode === "undirected" ? 2 : 1;
	const normalisationFactor = n > 2 ? (n - 1) * (n - 2) / scale : 1;

	for (const [nodeId, value] of betweenness) {
		betweenness.set(nodeId, value / normalisationFactor);
	}

	return betweenness;
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
 * Rank paths between two nodes by betweenness centrality.
 *
 * This baseline ranks paths by the sum of betweenness centrality values
 * of nodes along the path. Paths through highly central nodes receive
 * higher scores.
 *
 * @template N - Node type
 * @template E - Edge type
 * @param graph - The graph to search
 * @param startId - Source node ID
 * @param endId - Target node ID
 * @param config - Optional configuration
 * @returns Result containing betweenness-ranked paths or error
 */
export const betweennessRanking = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	startId: string,
	endId: string,
	config: BetweennessConfig = {},
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

	// Compute betweenness centrality for all nodes
	const betweenness = computeBetweennessCentrality(graph, traversalMode);

	const paths = findAllShortestPaths(graph, startId, endId, traversalMode);

	if (paths.length === 0) {
		return Ok(None());
	}

	const rankedPaths = paths.map((path) => {
		// Score is sum of betweenness centrality for nodes in path
		let score = 0;
		for (const node of path.nodes) {
			score += betweenness.get(node.id) ?? 0;
		}

		return {
			path,
			score,
			geometricMeanMI: 0,
			edgeMIValues: [],
		};
	});

	// Sort by score descending (highest betweenness first)
	rankedPaths.sort((a, b) => b.score - a.score);

	const limitedPaths = rankedPaths.slice(0, maxPaths);

	return Ok(Some(limitedPaths));
};
