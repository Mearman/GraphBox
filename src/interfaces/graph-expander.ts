/**
 * GraphExpander - Interface for dynamic neighbor discovery during graph traversal.
 *
 * Unlike ReadableGraph (which assumes fully-loaded graphs), GraphExpander enables
 * algorithms to work with partially-loaded graphs by dynamically fetching neighbors
 * from external sources (APIs, databases, file systems).
 *
 * Key difference from ReadableGraph:
 * - ReadableGraph: Assumes entire graph is loaded in memory
 * - GraphExpander: Supports lazy-loading and dynamic expansion
 *
 * Use cases:
 * - OpenAlex API calls during traversal
 * - Database queries for large graphs
 * - File-based graph streaming
 * - Caching layers (memory → disk → API)
 *
 * @template T - Type of node data
 */
export interface GraphExpander<T> {
	/**
	 * Get neighbors of a node, potentially fetching from external source.
	 *
	 * This method may:
	 * - Return cached neighbors (already fetched)
	 * - Query an API/database (lazy loading)
	 * - Throw errors if fetch fails (caller should handle)
	 *
	 * @param nodeId - Node whose neighbors to fetch
	 * @returns Promise resolving to array of neighbor relationships
	 */
	getNeighbors(nodeId: string): Promise<Neighbor[]>;

	/**
	 * Get node degree for priority computation.
	 *
	 * Used to prioritize low-degree (specific) nodes over high-degree (generic)
	 * nodes in traversal algorithms like BidirectionalBFS.
	 *
	 * This should return the CURRENT degree (neighbors already loaded),
	 * not the POTENTIAL degree (all possible neighbors).
	 *
	 * @param nodeId - Node to get degree for
	 * @returns Number of relationships (higher = lower priority)
	 */
	getDegree(nodeId: string): number;

	/**
	 * Calculate weighted priority for thesis-aligned degree-prioritised expansion.
	 *
	 * Implements the priority function from Equation 4.106:
	 * $$\pi(v) = \frac{\deg^{+}(v) + \deg^{-}(v)}{w_V(v) + \epsilon}$$
	 *
	 * Where:
	 * - $\deg^{+}(v)$: Weighted out-degree (sum of outgoing edge weights)
	 * - $\deg^{-}(v)$: Weighted in-degree (sum of incoming edge weights)
	 * - $w_V(v)$: Node weight for normalization (default 1)
	 * - $\epsilon$: Small constant to prevent division by zero (default 1e-10)
	 *
	 * @param nodeId - Node to calculate priority for
	 * @param options - Optional configuration for weighted calculation
	 * @returns Priority value (lower = higher priority, expanded earlier)
	 */
	calculatePriority(nodeId: string, options?: PriorityOptions): number;

	/**
	 * Get node data (may fetch from cache/API).
	 *
	 * @param nodeId - Node to retrieve
	 * @returns Promise resolving to node data or null if not found
	 */
	getNode(nodeId: string): Promise<T | null>;

	/**
	 * Add an edge to the final graph output.
	 *
	 * Called during node expansion to track discovered relationships.
	 * This is separated from fetching to allow algorithms to:
	 * - Discover edges without storing them
	 * Filter edges before adding
	 * Build output graphs separately from input graphs
	 *
	 * @param source - Source node ID
	 * @param target - Target node ID
	 * @param relationshipType - Type of relationship
	 */
	addEdge(source: string, target: string, relationshipType: string): void;
}

/**
 * Options for weighted priority calculation.
 *
 * Used by calculatePriority() to implement the thesis-aligned priority function.
 */
export interface PriorityOptions {
	/**
	 * Node weight for normalization (w_V(v) in thesis formula).
	 * Higher values decrease priority (node is considered more important/central).
	 * Default: 1 (unweighted nodes).
	 */
	nodeWeight?: number;

	/**
	 * Small constant to prevent division by zero.
	 * Default: 1e-10.
	 */
	epsilon?: number;

	/**
	 * Whether to use simple degree count (legacy behavior) or weighted formula.
	 * Default: false (use weighted formula).
	 *
	 * @deprecated Use weighted formula for thesis alignment. Set true only for backward compatibility.
	 */
	useSimpleDegree?: boolean;
}

/**
 * Neighbor relationship returned by GraphExpander.getNeighbors().
 *
 * Represents a directed relationship from one node to another with
 * metadata about the relationship type.
 */
export interface Neighbor {
	/** Target node ID */
	targetId: string;

	/** Type of relationship (e.g., 'citation', 'authorship', 'affiliation') */
	relationshipType: string;
}
