/**
 * GD4 file format type definitions.
 *
 * The .gd4 format was used for the Graph Drawing 2004 contest.
 * It is a simple ASCII format for undirected graphs with node coordinates.
 *
 * Format:
 * - First line: N (number of nodes)
 * - Next N lines: X Y coordinate pairs (doubles, 0-indexed)
 * - Remaining lines: A B integer pairs (undirected edges, 0-indexed)
 * - Lines starting with # are comments
 */

/**
 * A node in a GD4 document.
 */
export interface Gd4Node {
	/** Node index (0-indexed) */
	index: number;
	/** X coordinate */
	x: number;
	/** Y coordinate */
	y: number;
}

/**
 * An edge in a GD4 document.
 */
export interface Gd4Edge {
	/** Source node index (0-indexed) */
	source: number;
	/** Target node index (0-indexed) */
	target: number;
}

/**
 * Parsed GD4 document structure.
 */
export interface Gd4Document {
	/** Declared node count */
	nodeCount: number;
	/** Node definitions with coordinates */
	nodes: Gd4Node[];
	/** Undirected edges */
	edges: Gd4Edge[];
}
