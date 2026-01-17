/**
 * Pajek .net format type definitions.
 *
 * Pajek is a Windows program for analysis of large networks.
 * The .net format is its primary text-based network format.
 */

/**
 * A vertex in a Pajek document.
 */
export interface PajekVertex {
	/** Vertex ID (1-indexed in Pajek) */
	id: number;
	/** Optional vertex label */
	label?: string;
	/** Optional x coordinate */
	x?: number;
	/** Optional y coordinate */
	y?: number;
	/** Optional z coordinate */
	z?: number;
}

/**
 * An edge/arc in a Pajek document.
 */
export interface PajekEdge {
	/** Source vertex ID */
	source: number;
	/** Target vertex ID */
	target: number;
	/** Optional edge weight */
	weight?: number;
}

/**
 * Parsed Pajek document structure.
 */
export interface PajekDocument {
	/** Declared vertex count */
	vertexCount: number;
	/** Vertex definitions (may be empty if only count declared) */
	vertices: PajekVertex[];
	/** Edges (undirected connections) */
	edges: PajekEdge[];
	/** Arcs (directed connections) */
	arcs: PajekEdge[];
	/** Whether the network is directed (has arcs) */
	directed: boolean;
}
