/**
 * Forbidden Subgraph Detection
 *
 * Efficient detection of induced subgraphs in graphs.
 * Core infrastructure for 120+ forbidden subgraph graph classes.
 *
 * Key operations:
 * - `hasInducedSubgraph()` - Check if graph contains specific induced subgraph
 * - `detectMultipleSubgraphs()` - Batch detection of multiple patterns
 * - `SUBGRAPH_PATTERNS` - Predefined pattern library
 */

/**
 * Subgraph pattern template
 *
 * Patterns define vertex count and edge connections.
 * Vertices are numbered 0 to size-1.
 */
export interface SubgraphPattern {
	/** Pattern name (e.g., "P5", "C5", "bull") */
	name: string;

	/** Number of vertices in pattern */
	size: number;

	/** Edge connections as vertex pairs */
	edges: Array<[number, number]>;
}

/**
 * Adjacency list representation
 *
 * Maps vertex ID to set of adjacent vertices.
 */
export type AdjacencyList = ReadonlyMap<number, ReadonlySet<number>>;

/**
 * Build adjacency list from edge list
 *
 * @param vertices - Set of vertex IDs
 * @param edges - Array of edge pairs
 * @returns Adjacency list map
 */
export const buildAdjacencyList = (
	vertices: ReadonlySet<number>,
	edges: ReadonlyArray<readonly [number, number]>
): AdjacencyList => {
	const adj = new Map<number, Set<number>>();

	// Initialize all vertices
	for (const v of vertices) {
		adj.set(v, new Set());
	}

	// Add edges (undirected)
	for (const [u, v] of edges) {
		adj.get(u)?.add(v);
		adj.get(v)?.add(u);
	}

	// Freeze for immutability
	const frozen = new Map<number, Set<number>>();
	for (const [v, neighbors] of adj) {
		frozen.set(v, new Set(neighbors));
	}

	return frozen;
};

/**
 * Check if two sets of vertices induce the same subgraph pattern
 *
 * Compares:
 * - Vertex count matches
 * - Edge count matches
 * - Edge structure is isomorphic under vertex mapping
 *
 * @param graphAdj - Full graph adjacency
 * @param candidateVertices - Set of vertex IDs to check
 * @param pattern - Pattern to match against
 * @returns true if candidate induces pattern
 */
const matchesInducedPattern = (
	graphAdj: AdjacencyList,
	candidateVertices: ReadonlySet<number>,
	pattern: SubgraphPattern
): boolean => {
	// Size must match
	if (candidateVertices.size !== pattern.size) {
		return false;
	}

	const vertices = [...candidateVertices];

	// Try all bijections between pattern vertices and candidate vertices
	// For patterns up to 6 vertices, this is at most 6! = 720 permutations
	const permutations = generatePermutations(vertices);

	for (const mapping of permutations) {
		if (patternMatchesUnderMapping(graphAdj, mapping, pattern)) {
			return true;
		}
	}

	return false;
};

/**
 * Generate all permutations of an array
 *
 * Uses Heap's algorithm for efficient generation.
 *
 * @param arr - Array to permute
 * @param array
 * @returns All permutations
 */
const generatePermutations = <T,>(array: readonly T[]): T[][] => {
	const result: T[][] = [];
	const a = [...array];

	const heap = (n: number): void => {
		if (n === 1) {
			result.push([...a]);
			return;
		}

		for (let index = 0; index < n; index++) {
			heap(n - 1);
			if (n % 2 === 0) {
				[a[index], a[n - 1]] = [a[n - 1], a[index]];
			} else {
				[a[0], a[n - 1]] = [a[n - 1], a[0]];
			}
		}
	};

	heap(array.length);
	return result;
};

/**
 * Check if pattern matches under specific vertex mapping
 *
 * @param graphAdj - Full graph adjacency
 * @param mapping - Array mapping pattern[i] to graph vertex
 * @param pattern - Pattern to check
 * @returns true if pattern edges match under mapping
 */
const patternMatchesUnderMapping = (
	graphAdj: AdjacencyList,
	mapping: number[],
	pattern: SubgraphPattern
): boolean => {
	// Check all required edges exist
	for (const [index, index_] of pattern.edges) {
		const u = mapping[index];
		const v = mapping[index_];
		const neighbors = graphAdj.get(u);

		if (!neighbors?.has(v)) {
			return false;
		}
	}

	// Check no extra edges exist (induced subgraph requirement)
	const patternEdgeSet = new Set<string>(
		pattern.edges.map(([index, index_]) => {
			const a = Math.min(index, index_);
			const b = Math.max(index, index_);
			return `${a},${b}`;
		})
	);

	for (let index = 0; index < pattern.size; index++) {
		for (let index_ = index + 1; index_ < pattern.size; index_++) {
			const u = mapping[index];
			const v = mapping[index_];
			const neighbors = graphAdj.get(u);

			// If edge exists in graph, must exist in pattern
			if (neighbors?.has(v)) {
				const edgeKey = `${index},${index_}`;
				if (!patternEdgeSet.has(edgeKey)) {
					return false; // Extra edge in graph
				}
			}
		}
	}

	return true;
};

/**
 * Check if graph contains induced subgraph matching pattern
 *
 * @param adjacency - Graph adjacency list
 * @param pattern - Pattern to search for
 * @returns true if induced subgraph exists
 */
export const hasInducedSubgraph = (
	adjacency: AdjacencyList,
	pattern: SubgraphPattern
): boolean => {
	const vertices = [...adjacency.keys()];

	// Not enough vertices
	if (vertices.length < pattern.size) {
		return false;
	}

	// Generate all vertex combinations of size pattern.size
	const combinations = generateCombinations(vertices, pattern.size);

	for (const combo of combinations) {
		const vertexSet = new Set(combo);
		if (matchesInducedPattern(adjacency, vertexSet, pattern)) {
			return true;
		}
	}

	return false;
};

/**
 * Generate all k-combinations from array
 *
 * Uses recursive combination generation.
 *
 * @param arr - Source array
 * @param array
 * @param k - Combination size
 * @returns All k-combinations
 */
const generateCombinations = <T,>(array: readonly T[], k: number): T[][] => {
	const result: T[][] = [];

	const combine = (start: number, chosen: T[]): void => {
		if (chosen.length === k) {
			result.push([...chosen]);
			return;
		}

		for (let index = start; index < array.length; index++) {
			chosen.push(array[index]);
			combine(index + 1, chosen);
			chosen.pop();
		}
	};

	combine(0, []);
	return result;
};

/**
 * Detect multiple subgraph patterns in one pass
 *
 * Optimized batch detection that avoids redundant combination generation.
 *
 * @param adjacency - Graph adjacency list
 * @param patterns - Array of patterns to detect
 * @returns Map of pattern name to detection result
 */
export const detectMultipleSubgraphs = (
	adjacency: AdjacencyList,
	patterns: readonly SubgraphPattern[]
): ReadonlyMap<string, boolean> => {
	const results = new Map<string, boolean>();
	const vertices = [...adjacency.keys()];

	// Initialize all as false
	for (const pattern of patterns) {
		results.set(pattern.name, false);
	}

	// Group patterns by size for efficient checking
	const bySize = new Map<number, SubgraphPattern[]>();
	for (const pattern of patterns) {
		const size = pattern.size;
		if (!bySize.has(size)) {
			bySize.set(size, []);
		}
		bySize.get(size)!.push(pattern);
	}

	// Check each size class
	for (const [size, sizePatterns] of bySize) {
		if (vertices.length < size) {
			continue; // Not enough vertices
		}

		const combinations = generateCombinations(vertices, size);

		for (const combo of combinations) {
			const vertexSet = new Set(combo);

			for (const pattern of sizePatterns) {
				if (results.get(pattern.name) === true) {
					continue; // Already found
				}

				if (matchesInducedPattern(adjacency, vertexSet, pattern)) {
					results.set(pattern.name, true);
				}
			}
		}
	}

	return results;
};

/**
 * ★ Insight ─────────────────────────────────────
 * **Forbidden Subgraph Detection Design**
 *
 * 1. **Induced vs Non-Induced**: We check induced subgraphs where
 *    edge structure must match exactly (no extra edges allowed).
 *    This is stricter than subgraph isomorphism and is required
 *    for most forbidden subgraph characterizations.
 *
 * 2. **Permutation Complexity**: For small patterns (≤6 vertices),
 *    n! permutations are manageable (720 max). For larger patterns,
 *    we'd need more sophisticated algorithms (VF2, color coding).
 *
 * 3. **Batch Optimization**: When checking multiple patterns of the
 *    same size, we generate vertex combinations once and reuse them.
 *    This provides significant speedup for multi-pattern detection.
 * ─────────────────────────────────────────────────
 */

// ============================================================================
// PREDEFINED SUBGRAPH PATTERNS
// ============================================================================

/**
 * Path graph P_k
 * Linear chain of k vertices
 *
 * P3: o - o - o
 * P4: o - o - o - o
 * P5: o - o - o - o - o
 * @param k
 */
const pathPattern = (k: number): SubgraphPattern => {
	const edges: Array<[number, number]> = [];
	for (let index = 0; index < k - 1; index++) {
		edges.push([index, index + 1]);
	}
	return { name: `P${k}`, size: k, edges };
};

/**
 * Cycle graph C_k
 * Ring of k vertices
 *
 * C3: triangle, C4: square, C5: pentagon
 * @param k
 */
const cyclePattern = (k: number): SubgraphPattern => {
	const edges: Array<[number, number]> = [];
	for (let index = 0; index < k; index++) {
		edges.push([index, (index + 1) % k]);
	}
	return { name: `C${k}`, size: k, edges };
};

/**
 * Complete graph K_k
 * All pairs connected
 * @param k
 */
const completePattern = (k: number): SubgraphPattern => {
	const edges: Array<[number, number]> = [];
	for (let index = 0; index < k; index++) {
		for (let index_ = index + 1; index_ < k; index_++) {
			edges.push([index, index_]);
		}
	}
	return { name: `K${k}`, size: k, edges };
};

/**
 * Library of common forbidden subgraph patterns
 */
export const SUBGRAPH_PATTERNS = {
	/** Path P3 (3 vertices) */
	P3: pathPattern(3),

	/** Path P4 (4 vertices) */
	P4: pathPattern(4),

	/** Path P5 (5 vertices) */
	P5: pathPattern(5),

	/** Path P6 (6 vertices) */
	P6: pathPattern(6),

	/** Path P7 (7 vertices) */
	P7: pathPattern(7),

	/** Cycle C3 (triangle) */
	C3: cyclePattern(3),

	/** Cycle C4 (square) */
	C4: cyclePattern(4),

	/** Cycle C5 (pentagon) */
	C5: cyclePattern(5),

	/** Cycle C6 (hexagon) */
	C6: cyclePattern(6),

	/** Cycle C7 (heptagon) */
	C7: cyclePattern(7),

	/** Complete K2 (edge) */
	K2: completePattern(2),

	/** Complete K3 (triangle) */
	K3: completePattern(3),

	/** Complete K4 */
	K4: completePattern(4),

	/** Complete K5 */
	K5: completePattern(5),

	/**
	 * Bull graph
	 * Triangle with two pendant vertices
	 *
	 *     2
	 *     |
	 * 0 - 1 - 3
	 *     |
	 *     4
	 */
	bull: {
		name: "bull",
		size: 5,
		edges: [
			[0, 1],
			[1, 2],
			[1, 3],
			[1, 4],
			[2, 3],
		],
	} as SubgraphPattern,

	/**
	 * Gem graph
	 * P4 with a universal vertex
	 *
	 *     2
	 *     |
	 * 0 - 1 - 3
	 *     |
	 *     4
	 * plus all edges from vertex 1
	 */
	gem: {
		name: "gem",
		size: 5,
		edges: [
			[0, 1],
			[1, 2],
			[1, 3],
			[1, 4],
			[2, 3],
			[2, 4],
			[3, 4],
		],
	} as SubgraphPattern,

	/**
	 * Net graph
	 * Triangle with three pendant vertices
	 *
	 *       2
	 *      /|\
	 *     3 0 4
	 *      \|/
	 *       1
	 */
	net: {
		name: "net",
		size: 6,
		edges: [
			[0, 1],
			[0, 2],
			[0, 3],
			[1, 2],
			[2, 4],
			[2, 5],
		],
	} as SubgraphPattern,

	/**
	 * House graph
	 * P5 with a chord forming a "roof"
	 *
	 *   2 - 3
	 *   |   |
	 * 0 - 1 - 4
	 */
	house: {
		name: "house",
		size: 5,
		edges: [
			[0, 1],
			[1, 2],
			[2, 3],
			[1, 4],
			[3, 4],
		],
	} as SubgraphPattern,

	/**
	 * Diamond graph
	 * K4 minus one edge
	 *
	 *   2
	 *  /|\
	 * 3-0-1
	 *  \|/
	 *   4
	 */
	diamond: {
		name: "diamond",
		size: 4,
		edges: [
			[0, 1],
			[0, 2],
			[0, 3],
			[1, 2],
			[1, 3],
		],
	} as SubgraphPattern,

	/**
	 * Claw graph K1,3
	 * Star with 3 leaves
	 *
	 *     2
	 *     |
	 * 0 - 1 - 3
	 *     |
	 *     4
	 */
	claw: {
		name: "claw",
		size: 4,
		edges: [
			[0, 1],
			[1, 2],
			[1, 3],
		],
	} as SubgraphPattern,

	/**
	 * Fork graph
	 * P4 with an extra pendant attached to second vertex
	 *
	 *     2
	 *     |
	 * 0 - 1 - 3 - 4
	 */
	fork: {
		name: "fork",
		size: 5,
		edges: [
			[0, 1],
			[1, 2],
			[1, 3],
			[3, 4],
		],
	} as SubgraphPattern,

	/**
	 * Chair graph
	 * P4 plus a pendant attached to center
	 *
	 *   2
	 *   |
	 *   1
	 *   |
	 * 0-1-3-4  (vertex 1 has pendant 2)
	 */
	chair: {
		name: "chair",
		size: 5,
		edges: [
			[0, 1],
			[1, 2],
			[1, 3],
			[3, 4],
		],
	} as SubgraphPattern,

	/**
	 * Dart graph
	 * Triangle with a path attached
	 *
	 *   1---2
	 *   |\ /
	 *   | 0
	 *   |/
	 *   3
	 */
	dart: {
		name: "dart",
		size: 4,
		edges: [
			[0, 1],
			[0, 2],
			[0, 3],
			[1, 2],
			[1, 3],
		],
	} as SubgraphPattern,

	/**
	 * Kite graph
	 * Diamond with a pendant
	 */
	kite: {
		name: "kite",
		size: 5,
		edges: [
			[0, 1],
			[0, 2],
			[0, 3],
			[1, 2],
			[1, 3],
			[3, 4],
		],
	} as SubgraphPattern,

	/**
	 * Banner graph
	 * Triangle with a path of length 2 attached
	 */
	banner: {
		name: "banner",
		size: 5,
		edges: [
			[0, 1],
			[1, 2],
			[1, 3],
			[2, 3],
			[3, 4],
		],
	} as SubgraphPattern,

	/**
	 * 4-cycle with chord
	 * C4 plus one diagonal
	 */
	C4_chord: {
		name: "C4_chord",
		size: 4,
		edges: [
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 0],
			[0, 2],
		],
	} as SubgraphPattern,
} as const;

/**
 * Get all pattern names from library
 */
export const ALL_PATTERN_NAMES = Object.keys(
	SUBGRAPH_PATTERNS
) as readonly (keyof typeof SUBGRAPH_PATTERNS)[];

/**
 * Get pattern by name
 * @param name
 */
export const getPattern = (
	name: keyof typeof SUBGRAPH_PATTERNS
): SubgraphPattern => {
	const pattern = SUBGRAPH_PATTERNS[name];
	if (!pattern) {
		throw new Error(`Unknown pattern: ${name}`);
	}
	return pattern;
};
