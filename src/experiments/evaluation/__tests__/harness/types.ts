/**
 * Unified metrics types for algorithm evaluation harness
 *
 * Based on the principle that algorithm comparison should focus on:
 * - Correctness: Does the algorithm find valid paths?
 * - Exploration efficiency: How many nodes/edges expanded?
 * - Search behaviour: How does traversal order differ?
 * - Diversity: How varied are the discovered paths?
 */

/**
 * Normalized statistics returned by all expansion algorithms.
 *
 * All algorithms (DP, BFS, Frontier-Balanced, Random) should return
 * compatible metrics for fair comparison.
 */
export interface ExpansionMetrics {
	/** Algorithm name */
	algorithm: string;

	/** Graph identifier */
	graph: string;

	/** Number of seed nodes (N) */
	numSeeds: number;

	/** Total nodes expanded (popped from frontiers) */
	nodesExpanded: number;

	/** Total edges traversed */
	edgesTraversed: number;

	/** Iterations (single node expansions) performed */
	iterations: number;

	/** Number of unique nodes in the sampled subgraph */
	sampledNodes: number;

	/** Number of unique edges in the sampled subgraph */
	sampledEdges: number;

	/** Number of paths found (N >= 2 only) */
	pathsFound: number;

	/** Degree distribution of expanded nodes */
	degreeDistribution: Record<string, number>;

	/** Hub-specific metrics (if applicable) */
	hubMetrics?: {
		/** Number of hub nodes expanded */
		hubsExpanded: number;
		/** Total nodes expanded */
		totalExpanded: number;
		/** Percentage of paths that traverse hub nodes */
		hubTraversalRate: number;
	};
}

/**
 * Path analysis metrics for diversity assessment.
 */
export interface PathMetrics {
	/** Algorithm name */
	algorithm: string;

	/** Graph identifier */
	graph: string;

	/** Number of paths found */
	pathCount: number;

	/** Minimum path length */
	minLength: number;

	/** Maximum path length */
	maxLength: number;

	/** Mean path length */
	meanLength: number;

	/** Median path length */
	medianLength: number;

	/** Path diversity score (0-1, higher = more diverse) */
	diversity: number;

	/** Number of unique nodes across all paths */
	uniqueNodes: number;

	/** Jaccard dissimilarity between paths */
	jaccardDissimilarity: number;
}

/**
 * Combined result from a single algorithm run on a graph.
 */
export interface AlgorithmRunResult {
	/** Expansion metrics */
	metrics: ExpansionMetrics;

	/** Path analysis (if paths were found) */
	pathMetrics?: PathMetrics;

	/** Raw result for validation */
	raw: {
		paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }>;
		sampledNodes: Set<string>;
		sampledEdges: Set<string>;
	};
}

/**
 * Comparison result between two algorithms on the same graph.
 */
export interface AlgorithmComparison {
	/** Graph identifier */
	graph: string;

	/** Algorithm A name */
	algorithmA: string;

	/** Algorithm B name */
	algorithmB: string;

	/** Algorithm A metrics */
	metricsA: ExpansionMetrics;

	/** Algorithm B metrics */
	metricsB: ExpansionMetrics;

	/** Relative efficiency (A vs B) - negative means A expanded fewer nodes */
	efficiencyDelta: number;

	/** Path diversity delta */
	diversityDelta: number;
}

/**
 * Test fixture with known ground truth properties.
 */
export interface GraphFixture {
	/** Unique identifier for this graph */
	name: string;

	/** Human-readable description */
	description: string;

	/** Total number of nodes */
	nodeCount: number;

	/** Expected optimal path length (for N=2 seeds from opposite ends) */
	optimalPathLength?: number;

	/** Number of hubs (nodes with degree > threshold) */
	hubCount?: number;

	/** Whether graph is sparse (affects connectivity) */
	isSparse?: boolean;

	/** Factory function to create the graph expander */
	create: () => import("@graph/interfaces/graph-expander").GraphExpander<unknown>;

	/** Default seeds for N=1, N=2, N=3 tests */
	seeds: {
		/** Single seed for ego-network test */
		n1: string[];

		/** Two seeds for bidirectional test */
		n2: string[];

		/** Three seeds for multi-seed test */
		n3: string[];
	};
}
