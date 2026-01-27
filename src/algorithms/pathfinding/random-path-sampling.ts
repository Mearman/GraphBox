/**
 * Random Path Sampling for Graph Analysis
 *
 * Generates random paths between two nodes using Monte Carlo sampling.
 * Used as a statistical baseline for path ranking experiments.
 */

import { type Graph } from "../graph/graph.js";
import { type Path } from "../types/algorithm-results.js";
import { type GraphError } from "../types/errors.js";
import { type Edge, type Node } from "../types/graph.js";
import { Err as Error_, Ok, type Result } from "../types/result.js";
import { type RankedPath } from "./path-ranking.js";

/**
 * Configuration for random path sampling.
 */
export interface RandomPathSamplingConfig {
	/** Maximum number of paths to sample */
	maxPaths?: number;
	/** Random seed for reproducibility */
	seed?: number;
	/** Maximum path length to prevent infinite walks */
	maxLength?: number;
	/** Maximum attempts per path before giving up */
	maxAttemptsPerPath?: number;
}

/**
 * Seeded random number generator (simple LCG).
 * @param seed - Initial seed value
 * @returns Function that returns random numbers in [0, 1)
 */
const createSeededRandom = (seed: number): (() => number) => {
	let state = seed;
	return () => {
		state = (state * 1_103_515_245 + 12_345) & 0x7F_FF_FF_FF;
		return state / 0x7F_FF_FF_FF;
	};
};

/**
 * Sample random paths between source and target using random walks.
 *
 * Performs multiple random walks from source, attempting to reach target.
 * Each successful path is converted to a RankedPath with placeholder MI values.
 * @param graph - The graph to sample paths from
 * @param sourceId - Starting node ID
 * @param targetId - Ending node ID
 * @param config - Sampling configuration
 * @returns Result containing array of ranked paths or error
 */
export const sampleRandomPaths = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	sourceId: string,
	targetId: string,
	config: RandomPathSamplingConfig = {}
): Result<Array<RankedPath<N, E>>, GraphError> => {
	const {
		maxPaths = 10,
		seed = 42,
		maxLength = 100,
		maxAttemptsPerPath = 1000,
	} = config;

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

	const random = createSeededRandom(seed);
	const paths: Array<RankedPath<N, E>> = [];

	// Attempt to sample maxPaths paths
	for (let pathIndex = 0; pathIndex < maxPaths; pathIndex++) {
		let foundPath = false;

		// Try multiple times to find a path
		for (let attempt = 0; attempt < maxAttemptsPerPath && !foundPath; attempt++) {
			const walkedPath = randomWalk(
				graph,
				sourceId,
				targetId,
				maxLength,
				random
			);

			if (walkedPath !== null) {
				// Convert to RankedPath format
				const rankedPath: RankedPath<N, E> = {
					path: walkedPath,
					score: 0, // Placeholder: random paths have no meaningful score
					geometricMeanMI: 0, // Placeholder: would need MI calculation
					edgeMIValues: walkedPath.edges.map(() => 0), // Placeholder
				};
				paths.push(rankedPath);
				foundPath = true;
			}
		}

		// If we couldn't find a path after max attempts, stop trying
		if (!foundPath) {
			break;
		}
	}

	return Ok(paths);
};

/**
 * Perform a single random walk from source attempting to reach target.
 * @param graph - The graph to walk on
 * @param sourceId - Starting node ID
 * @param targetId - Target node ID
 * @param maxLength - Maximum number of steps
 * @param random - Random number generator
 * @returns Path if target reached, null otherwise
 */
const randomWalk = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	sourceId: string,
	targetId: string,
	maxLength: number,
	random: () => number
): Path<N, E> | null => {
	const visited = new Set<string>();
	const pathNodes: N[] = [];
	const pathEdges: E[] = [];

	const startNode = graph.getNode(sourceId);
	if (!startNode.some) return null;

	let currentId = sourceId;
	pathNodes.push(startNode.value);
	visited.add(currentId);

	for (let step = 0; step < maxLength; step++) {
		// Check if we reached target
		if (currentId === targetId) {
			const totalWeight = pathEdges.reduce((sum, e) => sum + (e.weight ?? 1), 0);
			return {
				nodes: pathNodes,
				edges: pathEdges,
				totalWeight,
			};
		}

		// Get neighbors
		const neighborsResult = graph.getNeighbors(currentId);
		if (!neighborsResult.ok) return null;

		const neighbors = neighborsResult.value;
		if (neighbors.length === 0) return null;

		// Filter out already-visited neighbors to avoid cycles
		const unvisitedNeighbors = neighbors.filter((nId) => !visited.has(nId));

		if (unvisitedNeighbors.length === 0) {
			// Dead end: all neighbors visited
			return null;
		}

		// Choose random unvisited neighbor
		const randomIndex = Math.floor(random() * unvisitedNeighbors.length);
		const nextId = unvisitedNeighbors[randomIndex];

		// Get the edge and node
		const edges = graph.getAllEdges();
		const edge = edges.find(
			(e) => e.source === currentId && e.target === nextId
		);
		if (!edge) return null;

		const nextNode = graph.getNode(nextId);
		if (!nextNode.some) return null;

		pathEdges.push(edge);
		pathNodes.push(nextNode.value);
		visited.add(nextId);
		currentId = nextId;
	}

	// Max length exceeded without reaching target
	return null;
};
