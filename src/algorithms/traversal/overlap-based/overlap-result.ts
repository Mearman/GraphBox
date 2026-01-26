/**
 * Result from overlap-based expansion.
 *
 * Extends the base DegreePrioritisedExpansionResult with overlap-specific metadata.
 */
export interface OverlapBasedExpansionResult {
	/** Discovered paths (only when N ≥ 2 seeds) */
	paths: Array<{ fromSeed: number; toSeed: number; nodes: string[] }>;

	/** Union of all nodes visited by all frontiers */
	sampledNodes: Set<string>;

	/** Edges traversed during expansion */
	sampledEdges: Set<string>;

	/** Per-frontier visited sets (for diagnostics) */
	visitedPerFrontier: Array<Set<string>>;

	/** Statistics about the expansion */
	stats: ExpansionStats;

	/** Overlap-specific metadata */
	overlapMetadata: OverlapMetadata;
}

/**
 * Statistics collected during expansion (from base DegreePrioritisedExpansionResult).
 */
export interface ExpansionStats {
	/** Total nodes expanded (popped from frontiers) */
	nodesExpanded: number;

	/** Total edges traversed */
	edgesTraversed: number;

	/** Iterations (single node expansions) performed */
	iterations: number;

	/** Breakdown of nodes by degree ranges */
	degreeDistribution: Map<string, number>;
}

/**
 * Metadata about overlap events during expansion.
 */
export interface OverlapMetadata {
	/**
	 * Termination reason - why the algorithm stopped.
	 */
	terminationReason: "overlap-satisfied" | "n1-coverage" | "max-iterations" | "exhaustion";

	/**
	 * All overlap events recorded during expansion.
	 */
	overlapEvents: OverlapEvent[];

	/**
	 * Iteration count at termination.
	 */
	iterations: number;

	/**
	 * Overlap matrix showing which frontiers overlapped.
	 * Key format: "0-1" → Set of meeting nodes between frontier 0 and 1.
	 */
	overlapMatrix: Map<string, Set<string>>;

	/**
	 * Coverage percentage (for N=1 case or when total graph size known).
	 */
	coverage?: number;
}

/**
 * Overlap event recorded during expansion.
 */
export interface OverlapEvent {
	/** Iteration when overlap occurred */
	readonly iteration: number;

	/** Index of first frontier involved in overlap */
	readonly frontierA: number;

	/** Index of second frontier involved in overlap */
	readonly frontierB: number;

	/** Node where frontiers met */
	readonly meetingNode: string;
}
