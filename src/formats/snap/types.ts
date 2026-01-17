/**
 * Type definitions for SNAP edge list format.
 */

/**
 * Parsed SNAP document containing edges and metadata from comments.
 */
export interface SnapDocument {
	/** Edges as [source, target] pairs */
	edges: Array<[string, string]>;
	/** Metadata extracted from comment lines */
	meta: {
		/** Number of nodes (from comments) */
		nodes?: number;
		/** Number of edges (from comments) */
		edges?: number;
		/** Whether the graph is directed (from comments or inferred) */
		directed?: boolean;
		/** Raw comment lines */
		comments: string[];
	};
}
