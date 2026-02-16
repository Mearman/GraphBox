/**
 * Matrix Market (.mtx) format parser.
 *
 * Parses the coordinate format used by SuiteSparse Matrix Collection.
 *
 * Format specification:
 * - Header: %%MatrixMarket matrix coordinate [real|integer|pattern] [general|symmetric]
 * - Comments: lines starting with %
 * - Dimensions: rows cols nnz
 * - Data: row col [value] per line (1-indexed)
 */

import type { GraphJson, GraphMeta, GraphNode } from "../gml/types";
import type { MtxDocument, MtxEntry, MtxSymmetry, MtxValueType } from "./types";

/**
 * Parse a Matrix Market .mtx string into a structured document.
 *
 * @param content - The .mtx file content
 * @returns Parsed Matrix Market document
 */
export const parseMtx = (content: string): MtxDocument => {
	const lines = content.split(/\r?\n/);

	let valueType: MtxValueType = "pattern";
	let symmetry: MtxSymmetry = "general";
	const comments: string[] = [];
	const entries: MtxEntry[] = [];
	let rows = 0;
	let cols = 0;
	let nnz = 0;
	let dimensionsParsed = false;

	for (const line of lines) {
		const trimmed = line.trim();

		// Skip empty lines
		if (trimmed === "") continue;

		// Header line
		if (trimmed.startsWith("%%MatrixMarket")) {
			const parts = trimmed.split(/\s+/).map((s) => s.toLowerCase());
			// %%MatrixMarket matrix coordinate [type] [symmetry]
			if (parts.length >= 4) {
				valueType = (parts[3] as MtxValueType) || "pattern";
			}
			if (parts.length >= 5) {
				symmetry = (parts[4] as MtxSymmetry) || "general";
			}
			continue;
		}

		// Comment line
		if (trimmed.startsWith("%")) {
			comments.push(trimmed.slice(1).trim());
			continue;
		}

		// Dimensions line (first non-comment, non-header line)
		if (!dimensionsParsed) {
			const parts = trimmed.split(/\s+/);
			if (parts.length >= 3) {
				rows = Number.parseInt(parts[0], 10);
				cols = Number.parseInt(parts[1], 10);
				nnz = Number.parseInt(parts[2], 10);
				dimensionsParsed = true;
			}
			continue;
		}

		// Data line
		const parts = trimmed.split(/\s+/);
		if (parts.length >= 2) {
			const row = Number.parseInt(parts[0], 10);
			const col = Number.parseInt(parts[1], 10);

			if (Number.isNaN(row) || Number.isNaN(col)) continue;

			const entry: MtxEntry = { row, col };

			if (valueType !== "pattern" && parts.length >= 3) {
				const value = Number.parseFloat(parts[2]);
				if (!Number.isNaN(value)) {
					entry.value = value;
				}
			}

			entries.push(entry);
		}
	}

	return {
		rows,
		cols,
		nnz,
		valueType,
		symmetry,
		entries,
		comments,
	};
};

/**
 * Options for converting Matrix Market to JSON.
 */
export interface MtxToJsonOptions {
	/** Metadata to include in output */
	meta: Omit<GraphMeta, "directed">;
	/** Override directed detection */
	directed?: boolean;
	/** Node labels from auxiliary file */
	nodeLabels?: string[];
}

/**
 * Convert a parsed Matrix Market document to normalised JSON format.
 *
 * Directed detection: symmetric matrices are undirected; general matrices
 * are directed unless overridden.
 *
 * @param document - Parsed Matrix Market document
 * @param options - Conversion options
 * @returns Graph in normalised JSON format
 */
export const mtxToJson = (
	document: MtxDocument,
	options: MtxToJsonOptions,
): GraphJson => {
	const directed =
		options.directed ??
		(document.symmetry === "symmetric" ? false : true);

	const labels = options.nodeLabels ?? document.nodeLabels;

	// Build node list
	const nodeCount = Math.max(document.rows, document.cols);
	const nodes: GraphNode[] = [];
	for (let i = 1; i <= nodeCount; i++) {
		const node: GraphNode = { id: i.toString() };
		if (labels?.[i - 1]) {
			node.label = labels[i - 1];
		}
		nodes.push(node);
	}

	// Build edge list
	const edges: Array<{
		source: string;
		target: string;
		weight?: number;
	}> = [];

	for (const entry of document.entries) {
		// Skip self-loops on the diagonal for symmetric matrices
		// (they'd be duplicated)
		const edge: { source: string; target: string; weight?: number } = {
			source: entry.row.toString(),
			target: entry.col.toString(),
		};

		if (entry.value !== undefined && entry.value !== 1) {
			edge.weight = entry.value;
		}

		edges.push(edge);

		// For symmetric matrices, add the reverse edge (skip diagonal)
		if (document.symmetry === "symmetric" && entry.row !== entry.col) {
			const reverseEdge: {
				source: string;
				target: string;
				weight?: number;
			} = {
				source: entry.col.toString(),
				target: entry.row.toString(),
			};
			if (entry.value !== undefined && entry.value !== 1) {
				reverseEdge.weight = entry.value;
			}
			edges.push(reverseEdge);
		}
	}

	return {
		meta: {
			...options.meta,
			directed,
		},
		nodes,
		edges,
	};
};
