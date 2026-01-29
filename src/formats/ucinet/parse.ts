/**
 * UCINet DL format parser.
 *
 * Parses the UCINet DL network format into a structured document,
 * then converts to the normalized JSON format.
 *
 * Format specification:
 * - Header: dl n=N [nm=M] [format=TYPE]
 * - Labels section: labels: or row labels: / col labels:
 * - Data section: data:
 *
 * Supported formats: fullmatrix, edgelist1
 */

import type { GraphEdge, GraphJson, GraphMeta, GraphNode } from "../gml/types";
import type { DlDocument, DlEdge, DlFormat } from "./types";

/**
 * Parse state machine states.
 */
type ParseState = "header" | "labels" | "rowlabels" | "collabels" | "matrixlabels" | "data";

/**
 * Parse a UCINet DL format string into a structured document.
 *
 * @param content - The .dl file content
 * @returns Parsed DL document
 */
export const parseDl = (content: string): DlDocument => {
	const lines = content.split(/\r?\n/);

	let n = 0;
	let nm: number | undefined;
	let nr: number | undefined;
	let nc: number | undefined;
	let format: DlFormat = "fullmatrix";
	let diagonal = true;
	const labels: string[] = [];
	const rowLabels: string[] = [];
	const colLabels: string[] = [];
	const matrixLabels: string[] = [];
	const edges: DlEdge[] = [];

	let state: ParseState = "header";
	const dataLines: string[] = [];

	for (const line of lines) {
		const trimmed = line.trim();

		// Skip empty lines in header state
		if (trimmed === "" && state === "header") {
			continue;
		}

		// Skip comments (lines starting with !)
		if (trimmed.startsWith("!")) {
			continue;
		}

		const lowerLine = trimmed.toLowerCase();

		// Check for DL header
		if (lowerLine.startsWith("dl")) {
			// Parse header parameters
			const nMatch = trimmed.match(/\bn\s*=\s*(\d+)/i);
			if (nMatch) {
				n = Number.parseInt(nMatch[1], 10);
			}

			const nmMatch = trimmed.match(/\bnm\s*=\s*(\d+)/i);
			if (nmMatch) {
				nm = Number.parseInt(nmMatch[1], 10);
			}

			const nrMatch = trimmed.match(/\bnr\s*=\s*(\d+)/i);
			if (nrMatch) {
				nr = Number.parseInt(nrMatch[1], 10);
			}

			const ncMatch = trimmed.match(/\bnc\s*=\s*(\d+)/i);
			if (ncMatch) {
				nc = Number.parseInt(ncMatch[1], 10);
			}

			const formatMatch = trimmed.match(/\bformat\s*=\s*(\w+)/i);
			if (formatMatch) {
				format = formatMatch[1].toLowerCase() as DlFormat;
			}

			continue;
		}

		// Check for section headers (may be on same line as header or separate)
		if (lowerLine.startsWith("labels:") || lowerLine === "labels") {
			state = "labels";
			// Check if labels are on the same line
			const afterColon = trimmed.slice(trimmed.indexOf(":") + 1).trim();
			if (afterColon) {
				parseLabels(afterColon, labels);
			}
			continue;
		}

		if (lowerLine.startsWith("row labels:") || lowerLine === "row labels") {
			state = "rowlabels";
			const afterColon = trimmed.slice(trimmed.indexOf(":") + 1).trim();
			if (afterColon) {
				parseLabels(afterColon, rowLabels);
			}
			continue;
		}

		if (lowerLine.startsWith("col labels:") || lowerLine === "col labels" || lowerLine.startsWith("column labels:")) {
			state = "collabels";
			const afterColon = trimmed.slice(trimmed.indexOf(":") + 1).trim();
			if (afterColon) {
				parseLabels(afterColon, colLabels);
			}
			continue;
		}

		if (lowerLine.startsWith("matrix labels:") || lowerLine === "matrix labels") {
			state = "matrixlabels";
			const afterColon = trimmed.slice(trimmed.indexOf(":") + 1).trim();
			if (afterColon) {
				parseLabels(afterColon, matrixLabels);
			}
			continue;
		}

		if (lowerLine.startsWith("data:") || lowerLine === "data") {
			state = "data";
			// Check if data starts on the same line
			const afterColon = trimmed.slice(trimmed.indexOf(":") + 1).trim();
			if (afterColon) {
				dataLines.push(afterColon);
			}
			continue;
		}

		// Check for diagonal specification
		if (lowerLine.includes("diagonal")) {
			diagonal = !lowerLine.includes("diagonal absent") && !lowerLine.includes("diagonal=absent");
			continue;
		}

		// Additional format specification on separate line
		if (lowerLine.startsWith("format")) {
			const formatMatch = trimmed.match(/format\s*(?:[=:]\s*)?(\w+)/i);
			if (formatMatch) {
				format = formatMatch[1].toLowerCase() as DlFormat;
			}
			continue;
		}

		// Parse based on current state
		switch (state) {
			case "labels": {
				parseLabels(trimmed, labels);
				break;
			}
			case "rowlabels": {
				parseLabels(trimmed, rowLabels);
				break;
			}
			case "collabels": {
				parseLabels(trimmed, colLabels);
				break;
			}
			case "matrixlabels": {
				parseLabels(trimmed, matrixLabels);
				break;
			}
			case "data": {
				if (trimmed !== "") {
					dataLines.push(trimmed);
				}
				break;
			}
		}
	}

	// Parse data based on format
	parseData(dataLines, format, n, nr, nc, nm, diagonal, edges);

	return {
		n,
		nm: nm === undefined ? undefined : nm,
		nr: nr === undefined ? undefined : nr,
		nc: nc === undefined ? undefined : nc,
		format,
		diagonal,
		labels: labels.length > 0 ? labels : undefined,
		rowLabels: rowLabels.length > 0 ? rowLabels : undefined,
		colLabels: colLabels.length > 0 ? colLabels : undefined,
		matrixLabels: matrixLabels.length > 0 ? matrixLabels : undefined,
		edges,
	};
};

/**
 * Parse labels from a line or lines.
 * Handles comma-separated, space-separated, and quoted labels.
 * @param line
 * @param labels
 */
const parseLabels = (line: string, labels: string[]): void => {
	// Handle quoted labels
	const quoted = line.match(/"[^"]+"/g);
	if (quoted) {
		for (const q of quoted) {
			labels.push(q.slice(1, -1));
		}
		return;
	}

	// Handle comma-separated or space-separated
	const parts = line.split(/[,\s]+/).filter((p) => p !== "");
	for (const part of parts) {
		labels.push(part);
	}
};

/**
 * Parse data section based on format.
 * @param dataLines
 * @param format
 * @param n
 * @param nr
 * @param nc
 * @param nm
 * @param diagonal
 * @param edges
 */
const parseData = (
	dataLines: string[],
	format: DlFormat,
	n: number,
	nr: number | undefined,
	nc: number | undefined,
	nm: number | undefined,
	diagonal: boolean,
	edges: DlEdge[]
): void => {
	switch (format) {
		case "fullmatrix": {
			parseFullMatrix(dataLines, n, nr, nc, nm, diagonal, edges);
			break;
		}
		case "edgelist1": {
			parseEdgeList1(dataLines, edges);
			break;
		}
		case "edgelist2": {
			parseEdgeList2(dataLines, edges);
			break;
		}
		case "nodelist1": {
			parseNodeList1(dataLines, edges);
			break;
		}
		case "nodelist2": {
			parseNodeList2(dataLines, edges);
			break;
		}
	}
};

/**
 * Parse fullmatrix format.
 * Data is an n x n matrix where each row represents connections from a node.
 * @param dataLines
 * @param n
 * @param nr
 * @param nc
 * @param nm
 * @param diagonal
 * @param edges
 */
const parseFullMatrix = (
	dataLines: string[],
	n: number,
	nr: number | undefined,
	nc: number | undefined,
	nm: number | undefined,
	diagonal: boolean,
	edges: DlEdge[]
): void => {
	const rows = nr ?? n;
	const cols = nc ?? n;
	const numberMatrices = nm ?? 1;

	// Flatten all data into a single array of numbers
	const values: number[] = [];
	for (const line of dataLines) {
		const nums = line.split(/\s+/).filter((s) => s !== "").map(Number);
		values.push(...nums);
	}

	// Parse matrices
	let valueIndex = 0;
	for (let m = 0; m < numberMatrices; m++) {
		for (let index = 0; index < rows; index++) {
			for (let index_ = 0; index_ < cols; index_++) {
				// Skip diagonal if absent
				if (!diagonal && index === index_) {
					continue;
				}

				if (valueIndex >= values.length) {
					break;
				}

				const weight = values[valueIndex++];
				if (weight !== 0) {
					edges.push({
						source: index,
						target: index_,
						weight,
						matrix: numberMatrices > 1 ? m : undefined,
					});
				}
			}
		}
	}
};

/**
 * Parse edgelist1 format.
 * Each line: source target [weight]
 * Node IDs are 1-indexed.
 * @param dataLines
 * @param edges
 */
const parseEdgeList1 = (dataLines: string[], edges: DlEdge[]): void => {
	for (const line of dataLines) {
		const parts = line.split(/\s+/).filter((s) => s !== "");
		if (parts.length < 2) continue;

		const source = Number.parseInt(parts[0], 10) - 1; // Convert to 0-indexed
		const target = Number.parseInt(parts[1], 10) - 1;
		const weight = parts.length > 2 ? Number.parseFloat(parts[2]) : 1;

		if (!Number.isNaN(source) && !Number.isNaN(target)) {
			edges.push({ source, target, weight });
		}
	}
};

/**
 * Parse edgelist2 format.
 * Node IDs are 0-indexed.
 * @param dataLines
 * @param edges
 */
const parseEdgeList2 = (dataLines: string[], edges: DlEdge[]): void => {
	for (const line of dataLines) {
		const parts = line.split(/\s+/).filter((s) => s !== "");
		if (parts.length < 2) continue;

		const source = Number.parseInt(parts[0], 10); // Already 0-indexed
		const target = Number.parseInt(parts[1], 10);
		const weight = parts.length > 2 ? Number.parseFloat(parts[2]) : 1;

		if (!Number.isNaN(source) && !Number.isNaN(target)) {
			edges.push({ source, target, weight });
		}
	}
};

/**
 * Parse nodelist1 format.
 * Each line: source target1 target2 target3 ...
 * Node IDs are 1-indexed.
 * @param dataLines
 * @param edges
 */
const parseNodeList1 = (dataLines: string[], edges: DlEdge[]): void => {
	for (const line of dataLines) {
		const parts = line.split(/\s+/).filter((s) => s !== "");
		if (parts.length < 2) continue;

		const source = Number.parseInt(parts[0], 10) - 1;
		if (Number.isNaN(source)) continue;

		for (let index = 1; index < parts.length; index++) {
			const target = Number.parseInt(parts[index], 10) - 1;
			if (!Number.isNaN(target)) {
				edges.push({ source, target, weight: 1 });
			}
		}
	}
};

/**
 * Parse nodelist2 format.
 * Node IDs are 0-indexed.
 * @param dataLines
 * @param edges
 */
const parseNodeList2 = (dataLines: string[], edges: DlEdge[]): void => {
	for (const line of dataLines) {
		const parts = line.split(/\s+/).filter((s) => s !== "");
		if (parts.length < 2) continue;

		const source = Number.parseInt(parts[0], 10);
		if (Number.isNaN(source)) continue;

		for (let index = 1; index < parts.length; index++) {
			const target = Number.parseInt(parts[index], 10);
			if (!Number.isNaN(target)) {
				edges.push({ source, target, weight: 1 });
			}
		}
	}
};

/**
 * Options for converting DL to JSON.
 */
export interface DlToJsonOptions {
	/** Metadata to include in output */
	meta: Omit<GraphMeta, "directed">;
	/** Override directed detection (default: true for DL format) */
	directed?: boolean;
}

/**
 * Convert a parsed DL document to normalized JSON format.
 *
 * @param doc - Parsed DL document
 * @param document
 * @param options - Conversion options
 * @returns Graph in normalized JSON format
 */
export const dlToJson = (document: DlDocument, options: DlToJsonOptions): GraphJson => {
	// DL format is typically directed (adjacency matrix is not necessarily symmetric)
	const directed = options.directed ?? true;

	// Determine node count
	const nodeCount = document.nr ?? document.nc ?? document.n;

	// Build nodes
	const nodes: GraphNode[] = [];
	for (let index = 0; index < nodeCount; index++) {
		const node: GraphNode = { id: index.toString() };

		// Add label if available
		if (document.labels?.[index]) {
			node.label = document.labels[index];
		} else if (document.rowLabels?.[index]) {
			node.label = document.rowLabels[index];
		}

		nodes.push(node);
	}

	// If there are column labels and different from row labels (2-mode network),
	// we might need to add additional nodes
	if (document.colLabels && document.colLabels.length > 0 && (!document.rowLabels || document.rowLabels.length === 0)) {
		// 2-mode network with only column labels
		for (let index = 0; index < document.colLabels.length; index++) {
			if (index >= nodes.length) {
				nodes.push({ id: index.toString(), label: document.colLabels[index] });
			} else if (!nodes[index].label) {
				nodes[index].label = document.colLabels[index];
			}
		}
	}

	// Convert edges
	const graphEdges: GraphEdge[] = document.edges.map((edge) => {
		const graphEdge: GraphEdge = {
			source: edge.source.toString(),
			target: edge.target.toString(),
		};

		if (edge.weight !== 1) {
			graphEdge.weight = edge.weight;
		}

		if (edge.matrix !== undefined && document.matrixLabels) {
			graphEdge.relation = document.matrixLabels[edge.matrix];
		}

		return graphEdge;
	});

	return {
		meta: {
			...options.meta,
			directed,
		},
		nodes,
		edges: graphEdges,
	};
};
