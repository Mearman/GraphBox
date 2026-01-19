/**
 * Helper algorithms for forbidden subgraph validation
 *
 * Implements complex graph class detection algorithms:
 * - Asteroidal triple detection (AT-free)
 * - House and hole detection (HH-free)
 * - Distance hereditary checking
 */

import { hasInducedSubgraph } from "../algorithms/extraction/forbidden-subgraphs.js";

/**
 * House graph pattern (5 vertices: square with triangle on top)
 * Vertices 0-1-2-3 form the square, vertex 4 connects to 0 and 2
 */
const HOUSE_PATTERN = {
	name: "house",
	size: 5,
	edges: [
		[0, 1], [1, 2], [2, 3], [3, 0], // Square
		[0, 2], // Diagonal (roof)
	] as Array<[number, number]>,
};

/**
 * 5-hole pattern (5-cycle)
 * House without the diagonal edge
 */
const HOLE_5_PATTERN = {
	name: "hole_5",
	size: 5,
	edges: [
		[0, 1], [1, 2], [2, 3], [3, 4], [4, 0],
	] as Array<[number, number]>,
};

/**
 * Domino pattern (6 vertices: two triangles sharing an edge)
 */
const DOMINO_PATTERN = {
	name: "domino",
	size: 6,
	edges: [
		[0, 1], [1, 2], [2, 0], // First triangle
		[1, 3], [3, 4], [4, 1], // Second triangle sharing edge 1-3
	] as Array<[number, number]>,
};

/**
 * Gem pattern (5 vertices: P4 plus a universal vertex)
 */
const GEM_PATTERN = {
	name: "gem",
	size: 5,
	edges: [
		[0, 1], [1, 2], [2, 3], [3, 0], // P4 (0-1-2-3 with edge 3-0)
		[0, 2], [1, 4], // Extra edges
	] as Array<[number, number]>,
};

/**
 * Check if three vertices form an asteroidal triple.
 * An asteroidal triple is a set of three vertices such that for each pair,
 * there exists a path connecting them that avoids the neighborhood of the third.
 *
 * @param adjacency - Graph adjacency list
 * @param v1 - First vertex
 * @param v2 - Second vertex
 * @param v3 - Third vertex
 * @returns true if {v1, v2, v3} is an asteroidal triple
 */
export const hasAsteroidalTriple = (
	adjacency: Map<number, Set<number>>,
	v1: number,
	v2: number,
	v3: number
): boolean => {
	// Get neighborhoods (including the vertex itself)
	const N1 = new Set(adjacency.get(v1));
	N1.add(v1);
	const N2 = new Set(adjacency.get(v2));
	N2.add(v2);
	const N3 = new Set(adjacency.get(v3));
	N3.add(v3);

	// Check if v1 and v2 can connect without going through N3
	if (!canAvoidNeighborhood(adjacency, v1, v2, N3)) {
		return false;
	}

	// Check if v1 and v3 can connect without going through N2
	if (!canAvoidNeighborhood(adjacency, v1, v3, N2)) {
		return false;
	}

	// Check if v2 and v3 can connect without going through N1
	if (!canAvoidNeighborhood(adjacency, v2, v3, N1)) {
		return false;
	}

	return true;
};

/**
 * BFS to find path from source to target that avoids a neighborhood.
 *
 * @param adjacency - Graph adjacency list
 * @param source - Start vertex
 * @param target - End vertex
 * @param avoidNeighborhood - Set of vertices to avoid
 * @returns true if such path exists
 */
const canAvoidNeighborhood = (
	adjacency: Map<number, Set<number>>,
	source: number,
	target: number,
	avoidNeighborhood: Set<number>
): boolean => {
	if (source === target) {
		return !avoidNeighborhood.has(source);
	}

	const visited = new Set<number>();
	const queue: number[] = [source];
	visited.add(source);

	while (queue.length > 0) {
		const current = queue.shift();
		if (current === undefined) {
			break;
		}

		for (const neighbor of adjacency.get(current) || []) {
			if (visited.has(neighbor)) {
				continue;
			}

			// Don't traverse through avoided neighborhood
			if (avoidNeighborhood.has(neighbor)) {
				continue;
			}

			if (neighbor === target) {
				return true;
			}

			visited.add(neighbor);
			queue.push(neighbor);
		}
	}

	return false;
};

/**
 * Check if graph contains an induced cycle of length k.
 *
 * @param adjacency - Graph adjacency list
 * @param vertexSet - All vertices in graph
 * @param k - Cycle length to detect
 * @returns true if induced k-cycle exists
 */
export const hasInducedCycle = (
	adjacency: Map<number, Set<number>>,
	vertexSet: Set<number>,
	k: number
): boolean => {
	if (vertexSet.size < k) {
		return false;
	}

	// Early exit: count edges in graph, need at least k edges for a k-cycle
	let edgeCount = 0;
	for (const neighbors of adjacency.values()) {
		edgeCount += neighbors.size;
	}
	edgeCount = edgeCount / 2; // Each edge counted twice
	if (edgeCount < k) {
		return false;
	}

	const vertices = [...vertexSet];

	// Try all combinations of k vertices
	for (const startCombo of getCombinations(vertices, k)) {
		const combo = new Set(startCombo);

		// Check if these k vertices form an induced cycle
		// Count edges in the induced subgraph
		let edgeCount = 0;
		const comboArray = [...combo];

		for (let index = 0; index < comboArray.length; index++) {
			for (let index_ = index + 1; index_ < comboArray.length; index_++) {
				const u = comboArray[index];
				const v = comboArray[index_];
				if (adjacency.get(u)?.has(v)) {
					edgeCount++;
				}
			}
		}

		// Induced k-cycle should have exactly k edges
		if (edgeCount !== k) {
			continue;
		}

		// Check if it forms a cycle (each vertex has degree 2)
		let allDegree2 = true;
		for (const v of comboArray) {
			let degree = 0;
			for (const other of comboArray) {
				if (v !== other && adjacency.get(v)?.has(other)) {
					degree++;
				}
			}
			if (degree !== 2) {
				allDegree2 = false;
				break;
			}
		}

		if (allDegree2) {
			return true;
		}
	}

	return false;
};

/**
 * Generate all combinations of size k from array.
 *
 * @param arr - Source array
 * @param array
 * @param k - Combination size
 * @returns Array of combinations
 */
const getCombinations = <T,>(array: T[], k: number): T[][] => {
	if (k === 0) {
		return [[]];
	}

	if (array.length === 0) {
		return [];
	}

	const [first, ...rest] = array;

	const combsWithFirst = getCombinations(rest, k - 1).map((comb) => [first, ...comb]);
	const combsWithoutFirst = getCombinations(rest, k);

	return [...combsWithFirst, ...combsWithoutFirst];
};

/**
 * Check if graph is distance hereditary.
 * A graph is distance hereditary if the distance between any two vertices
 * is the same in every connected induced subgraph containing them.
 *
 * This implementation uses the forbidden subgraph characterization:
 * Distance-hereditary graphs are exactly the graphs with no induced house,
 * hole (cycle of length >= 5), domino, or gem.
 *
 * @param adjacency - Graph adjacency list
 * @param vertexSet - All vertices in graph
 * @param _vertexSet
 * @returns true if graph is distance hereditary
 */
export const isDistanceHereditary = (
	adjacency: Map<number, Set<number>>,
	_vertexSet: Set<number>
): boolean => {
	// Distance-hereditary = no house, hole, domino, or gem as induced subgraph
	if (hasInducedSubgraph(adjacency, HOUSE_PATTERN)) return false;
	if (hasInducedSubgraph(adjacency, HOLE_5_PATTERN)) return false;
	if (hasInducedSubgraph(adjacency, DOMINO_PATTERN)) return false;
	if (hasInducedSubgraph(adjacency, GEM_PATTERN)) return false;
	return true;
};
