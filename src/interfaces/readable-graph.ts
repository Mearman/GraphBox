/**
 * ReadableGraph - Minimal generic interface for graph traversal algorithms.
 *
 * Provides the minimal API required for BFS, DFS, bidirectional BFS,
 * ego network extraction, and other traversal algorithms.
 */

/**
 * Base interface for graph nodes.
 *
 * @template T - Additional properties extending the base node
 */
export interface NodeBase {
	/** Unique identifier for the node */
	id: string;
}

/**
 * Base interface for graph edges.
 *
 * @template T - Additional properties extending the base edge
 */
export interface EdgeBase {
	/** Source node identifier */
	source: string;
	/** Target node identifier */
	target: string;
	/** Optional edge type/label */
	type?: string;
}

/**
 * Minimal interface for readable graph operations.
 *
 * Graph implementations must implement this interface to work with
 * traversal algorithms (BFS, DFS, bidirectional BFS, etc.).
 *
 * @template N - Node type extending NodeBase
 * @template E - Edge type extending EdgeBase
 */
export interface ReadableGraph<N extends NodeBase, E extends EdgeBase> {
	/**
	 * Check if a node exists in the graph.
	 * @param id - Node ID to check
	 * @returns true if node exists, false otherwise
	 */
	hasNode(id: string): boolean;

	/**
	 * Get a node by ID.
	 * @param id - Node ID to retrieve
	 * @returns Node data or null if not found
	 */
	getNode(id: string): N | null;

	/**
	 * Get neighbor node IDs for a given node.
	 * @param id - Node ID to get neighbors for
	 * @returns Array of neighbor IDs (empty array if node not found)
	 */
	getNeighbors(id: string): string[];

	/**
	 * Get all nodes in the graph.
	 * @returns Array of all nodes
	 */
	getAllNodes(): N[];

	/**
	 * Check if graph is directed.
	 * @returns true if directed, false if undirected
	 */
	isDirected(): boolean;

	/**
	 * Get outgoing edges from a node.
	 *
	 * For directed graphs: Returns edges where node is the source.
	 * For undirected graphs: Returns edges where node is either source or target.
	 *
	 * Used by ego-network extraction to preserve edge metadata.
	 *
	 * @param id - Node ID to get outgoing edges from
	 * @returns Array of outgoing edges (empty array if node not found)
	 */
	getOutgoingEdges?(id: string): E[];
}
