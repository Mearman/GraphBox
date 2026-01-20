/**
 * Random Path Baseline for Path Ranking
 *
 * Ranks paths randomly, serving as a statistical null hypothesis.
 * All paths receive the same score, but their order is randomised.
 *
 * This baseline helps establish whether Path Salience Ranking provides
 * meaningful improvements over random selection.
 */

import { type Graph } from "../../algorithms/graph/graph";
// Import types from path-ranking
import type { RankedPath } from "../../algorithms/pathfinding/path-ranking";
import { type Path } from "../../algorithms/types/algorithm-results";
import { type Edge, type Node } from "../../algorithms/types/graph";
import { None, type Option, Some } from "../../algorithms/types/option";
import { Err as Error_, Ok, type Result } from "../../algorithms/types/result";

/**
 * Configuration for random path ranking.
 */
export interface RandomPathConfig {
	/**
	 * Traversal mode for path finding.
	 */
	traversalMode?: "directed" | "undirected";

	/**
	 * Maximum number of paths to return.
	 */
	maxPaths?: number;

	/**
	 * Random seed for reproducibility.
	 */
	seed?: number;
}

/**
 * Creates a seeded pseudo-random number generator.
 * Uses mulberry32 algorithm for deterministic results.
 * @param seed
 */
const createSeededRng = (seed: number): (() => number) => {
	let state = seed >>> 0;
	return () => {
		state = Math.trunc(state + 0x6D_2B_79_F5);
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
};

/**
 * Fisher-Yates shuffle with seeded RNG.
 * @param array
 * @param rng
 */
const shuffle = <T>(array: T[], rng: () => number): T[] => {
	const result = [...array];
	for (let index = result.length - 1; index > 0; index--) {
		const index_ = Math.floor(rng() * (index + 1));
		[result[index], result[index_]] = [result[index_], result[index]];
	}
	return result;
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
 * Rank paths between two nodes randomly.
 *
 * This baseline serves as a statistical control. All paths receive
 * the same score (1.0), but their order is randomised. This helps
 * establish whether Path Salience Ranking provides meaningful improvements.
 *
 * @template N - Node type
 * @template E - Edge type
 * @param graph - The graph to search
 * @param startId - Source node ID
 * @param endId - Target node ID
 * @param config - Optional configuration including seed for reproducibility
 * @returns Result containing randomly-ranked paths or error
 */
export const randomPathRanking = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	startId: string,
	endId: string,
	config: RandomPathConfig = {},
): Result<Option<RankedPath<N, E>[]>, { type: string; message: string }> => {
	const { traversalMode = "undirected", maxPaths = 10, seed = Date.now() } = config;

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

	const rng = createSeededRng(seed);
	const shuffledPaths = shuffle(paths, rng);

	const rankedPaths = shuffledPaths.map((path) => ({
		path,
		score: 1,
		geometricMeanMI: 0,
		edgeMIValues: [],
	}));

	const limitedPaths = rankedPaths.slice(0, maxPaths);

	return Ok(Some(limitedPaths));
};
