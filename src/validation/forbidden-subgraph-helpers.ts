/**
 * Helper algorithms for forbidden subgraph validation
 *
 * Implements complex graph class detection algorithms:
 * - Asteroidal triple detection (AT-free)
 * - House and hole detection (HH-free)
 * - Distance hereditary checking
 */

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
 * This implementation uses the characterization that distance hereditary graphs
 * are exactly the graphs with no isometric cycle of length 5 or more.
 *
 * @param adjacency - Graph adjacency list
 * @param vertexSet - All vertices in graph
 * @returns true if graph is distance hereditary
 */
export const isDistanceHereditary = (
	adjacency: Map<number, Set<number>>,
	vertexSet: Set<number>
): boolean => {
	// Check for isometric cycles of length >= 5
	// For each cycle length >= 5, check if it's isometric
	for (let cycleLength = 5; cycleLength <= vertexSet.size; cycleLength++) {
		if (hasIsometricCycle(adjacency, vertexSet, cycleLength)) {
			return false;
		}
	}

	return true;
};

/**
 * Check if graph has an isometric cycle of given length.
 * A cycle is isometric if the distance between any two vertices in the cycle
 * along the cycle equals their shortest path distance in the whole graph.
 *
 * @param adjacency - Graph adjacency list
 * @param vertexSet - All vertices in graph
 * @param k - Cycle length
 * @returns true if isometric k-cycle exists
 */
const hasIsometricCycle = (
	adjacency: Map<number, Set<number>>,
	vertexSet: Set<number>,
	k: number
): boolean => {
	if (vertexSet.size < k) {
		return false;
	}

	const vertices = [...vertexSet];

	// Try all combinations of k vertices
	for (const startCombo of getCombinations(vertices, k)) {
		const combo = new Set(startCombo);

		// First check if these vertices form a cycle
		if (!hasInducedCycle(adjacency, combo, k)) {
			continue;
		}

		// Now check if the cycle is isometric
		if (isCycleIsometric(adjacency, combo, k)) {
			return true;
		}
	}

	return false;
};

/**
 * Check if a cycle is isometric.
 *
 * @param adjacency - Graph adjacency list
 * @param cycleVertices - Vertices forming the cycle
 * @param cycleLength - Length of the cycle
 * @returns true if cycle is isometric
 */
const isCycleIsometric = (
	adjacency: Map<number, Set<number>>,
	cycleVertices: Set<number>,
	cycleLength: number
): boolean => {
	const cycleArray = [...cycleVertices];

	// For each pair of vertices in the cycle
	for (let index = 0; index < cycleArray.length; index++) {
		for (let index_ = index + 1; index_ < cycleArray.length; index_++) {
			const v1 = cycleArray[index];
			const v2 = cycleArray[index_];

			// Get distance along the cycle (min of clockwise or counter-clockwise)
			const cycleDistribution = Math.min(index_ - index, cycleLength - (index_ - index));

			// Get actual shortest path distance in the graph
			const actualDistribution = shortestPathDistance(adjacency, v1, v2, cycleVertices);

			if (actualDistribution !== cycleDistribution) {
				return false;
			}
		}
	}

	return true;
};

/**
 * Compute shortest path distance between two vertices using BFS.
 *
 * @param adjacency - Graph adjacency list
 * @param source - Start vertex
 * @param target - End vertex
 * @param vertexSet - All vertices (for visited set initialization)
 * @returns Shortest path distance, or Infinity if no path exists
 */
const shortestPathDistance = (
	adjacency: Map<number, Set<number>>,
	source: number,
	target: number,
	vertexSet: Set<number>
): number => {
	if (source === target) {
		return 0;
	}

	const visited = new Set<number>([source]);
	const queue: [number, number][] = [[source, 0]];

	while (queue.length > 0) {
		const entry = queue.shift();
		if (entry === undefined) {
			break;
		}
		const [current, distribution] = entry;

		for (const neighbor of adjacency.get(current) || []) {
			if (!vertexSet.has(neighbor)) {
				continue;
			}

			if (neighbor === target) {
				return distribution + 1;
			}

			if (!visited.has(neighbor)) {
				visited.add(neighbor);
				queue.push([neighbor, distribution + 1]);
			}
		}
	}

	return Infinity;
};
