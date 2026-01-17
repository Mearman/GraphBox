/**
 * UCINet DL format type definitions.
 *
 * UCINet is a software package for network analysis.
 * The DL format is its primary text-based network format.
 */

/**
 * Supported DL format types.
 */
export type DlFormat =
	| "fullmatrix"
	| "edgelist1"
	| "edgelist2"
	| "nodelist1"
	| "nodelist2";

/**
 * Parsed UCINet DL document structure.
 */
export interface DlDocument {
	/** Number of nodes */
	n: number;
	/** Number of matrices (for multi-relational data) */
	nm?: number;
	/** Number of rows (if different from n) */
	nr?: number;
	/** Number of columns (if different from n) */
	nc?: number;
	/** Format type */
	format: DlFormat;
	/** Whether the diagonal should be present (for fullmatrix) */
	diagonal?: boolean;
	/** Node labels */
	labels?: string[];
	/** Row labels (for 2-mode networks) */
	rowLabels?: string[];
	/** Column labels (for 2-mode networks) */
	colLabels?: string[];
	/** Edge data - adjacency matrix or edge list depending on format */
	edges: DlEdge[];
	/** Matrix names (for multi-relational data) */
	matrixLabels?: string[];
}

/**
 * An edge in a DL document.
 */
export interface DlEdge {
	/** Source node (0-indexed after parsing) */
	source: number;
	/** Target node (0-indexed after parsing) */
	target: number;
	/** Edge weight */
	weight: number;
	/** Matrix index (for multi-relational data) */
	matrix?: number;
}
