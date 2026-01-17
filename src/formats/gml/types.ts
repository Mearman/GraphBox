/**
 * Type definitions for the normalized graph JSON format.
 *
 * This format is used as the canonical interchange format for graphbox.
 */

/**
 * Structured citation for academic references.
 */
export interface Citation {
	/** List of author names */
	authors: string[];
	/** Title of the work */
	title: string;
	/** Publication year */
	year: number;
	/** Journal name (for articles) */
	journal?: string;
	/** Volume number */
	volume?: number;
	/** Issue number */
	issue?: number;
	/** Page range (e.g., "452-473") */
	pages?: string;
	/** Publisher name (for books) */
	publisher?: string;
	/** Publication location (for books) */
	location?: string;
	/** DOI identifier */
	doi?: string;
	/** Type of publication */
	type?: "article" | "book" | "conference" | "thesis" | "other";
}

/**
 * Metadata for a graph dataset.
 */
export interface GraphMeta {
	/** Human-readable name of the dataset */
	name: string;
	/** Description of what the graph represents */
	description: string;
	/** Canonical human-readable web page for the dataset */
	source: string;
	/** Direct download URL for the data file */
	url: string;
	/** Structured citation information */
	citation: Citation;
	/** Date when the data was retrieved (ISO format) */
	retrieved: string;
	/** Whether edges are directed */
	directed: boolean;
	/** Original creator of the GML file (if applicable) */
	creator?: string;
}

/**
 * A node in the graph.
 */
export interface GraphNode {
	/** Unique identifier for the node */
	id: string;
	/** Optional label/name for display */
	label?: string;
	/** Additional arbitrary properties (preserved from source) */
	[key: string]: unknown;
}

/**
 * An edge in the graph.
 */
export interface GraphEdge {
	/** Source node ID */
	source: string;
	/** Target node ID */
	target: string;
	/** Optional edge weight */
	weight?: number;
	/** Per-edge directed override (if different from graph default) */
	directed?: boolean;
	/** Additional arbitrary properties */
	[key: string]: unknown;
}

/**
 * Complete graph in the normalized JSON format.
 */
export interface GraphJson {
	/** Metadata about the graph */
	meta: GraphMeta;
	/** Array of nodes */
	nodes: GraphNode[];
	/** Array of edges */
	edges: GraphEdge[];
}

/**
 * Parsed GML document (intermediate representation).
 */
export interface GmlDocument {
	/** Creator comment (if present) */
	creator?: string;
	/** Graph-level properties */
	graph: {
		directed?: 0 | 1;
		[key: string]: unknown;
	};
	/** Nodes from the GML file */
	nodes: GmlNode[];
	/** Edges from the GML file */
	edges: GmlEdge[];
}

/**
 * Node as parsed from GML.
 */
export interface GmlNode {
	id: number;
	label?: string;
	value?: unknown;
	[key: string]: unknown;
}

/**
 * Edge as parsed from GML.
 */
export interface GmlEdge {
	source: number;
	target: number;
	value?: number;
	weight?: number;
	[key: string]: unknown;
}
