/**
 * Type definitions for Matrix Market (.mtx) format.
 *
 * Matrix Market is a standard format for exchanging sparse matrices,
 * commonly used by the SuiteSparse Matrix Collection.
 */

/**
 * Matrix Market value type.
 */
export type MtxValueType = "real" | "integer" | "complex" | "pattern";

/**
 * Matrix Market symmetry type.
 */
export type MtxSymmetry = "general" | "symmetric" | "skew-symmetric" | "hermitian";

/**
 * Parsed Matrix Market document.
 */
export interface MtxDocument {
	/** Number of rows */
	rows: number;
	/** Number of columns */
	cols: number;
	/** Number of non-zero entries */
	nnz: number;
	/** Value type (real, integer, complex, pattern) */
	valueType: MtxValueType;
	/** Symmetry (general, symmetric, skew-symmetric, hermitian) */
	symmetry: MtxSymmetry;
	/** Edges as (row, col, value?) triples (1-indexed) */
	entries: MtxEntry[];
	/** Comment lines from the header */
	comments: string[];
	/** Node labels from auxiliary _nodename.txt file */
	nodeLabels?: string[];
}

/**
 * A single Matrix Market entry.
 */
export interface MtxEntry {
	/** Row index (1-indexed) */
	row: number;
	/** Column index (1-indexed) */
	col: number;
	/** Value (undefined for pattern matrices) */
	value?: number;
}
