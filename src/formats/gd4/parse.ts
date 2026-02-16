/**
 * GD4 file format parser.
 *
 * Parses the Graph Drawing 2004 contest format into a structured document,
 * then converts to the normalised JSON format.
 *
 * Format specification (from GD 2004 contest rules):
 * - First number: N (node count)
 * - Next N pairs: X Y coordinates (doubles) for nodes 0..N-1
 * - Remaining integer pairs: A B (undirected edges)
 * - Lines starting with # are comments
 * - Nodes are 0-indexed
 */

import type { GraphJson, GraphMeta } from "../gml/types";
import type { Gd4Document, Gd4Edge, Gd4Node } from "./types";

/**
 * Parse a GD4 format string into a structured document.
 *
 * @param content - The .gd4 file content
 * @returns Parsed GD4 document
 */
export const parseGd4 = (content: string): Gd4Document => {
	const lines = content.split(/\r?\n/);

	// Filter out empty lines and comments
	const dataLines: string[] = [];
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === "" || trimmed.startsWith("#")) {
			continue;
		}
		dataLines.push(trimmed);
	}

	if (dataLines.length === 0) {
		return { nodeCount: 0, nodes: [], edges: [] };
	}

	// First data line: node count
	const nodeCount = Number.parseInt(dataLines[0], 10);
	if (Number.isNaN(nodeCount) || nodeCount < 0) {
		throw new Error(`Invalid node count: ${dataLines[0]}`);
	}

	// Next N lines: X Y coordinate pairs
	const nodes: Gd4Node[] = [];
	for (let i = 0; i < nodeCount; i++) {
		const lineIndex = 1 + i;
		if (lineIndex >= dataLines.length) {
			break;
		}
		const parts = dataLines[lineIndex].split(/\s+/);
		if (parts.length < 2) {
			continue;
		}
		const x = Number.parseFloat(parts[0]);
		const y = Number.parseFloat(parts[1]);
		if (Number.isNaN(x) || Number.isNaN(y)) {
			continue;
		}
		nodes.push({ index: i, x, y });
	}

	// Remaining lines: edge pairs
	const edges: Gd4Edge[] = [];
	for (let i = 1 + nodeCount; i < dataLines.length; i++) {
		const parts = dataLines[i].split(/\s+/);
		if (parts.length < 2) {
			continue;
		}
		const source = Number.parseInt(parts[0], 10);
		const target = Number.parseInt(parts[1], 10);
		if (Number.isNaN(source) || Number.isNaN(target)) {
			continue;
		}
		edges.push({ source, target });
	}

	return { nodeCount, nodes, edges };
};

/**
 * Options for converting GD4 to JSON.
 */
export interface Gd4ToJsonOptions {
	/** Metadata to include in output (directed is always false for GD4) */
	meta: Omit<GraphMeta, "directed">;
}

/**
 * Convert a parsed GD4 document to normalised JSON format.
 *
 * GD4 graphs are always undirected.
 *
 * @param document - Parsed GD4 document
 * @param options - Conversion options
 * @returns Graph in normalised JSON format
 */
export const gd4ToJson = (document: Gd4Document, options: Gd4ToJsonOptions): GraphJson => {
	// Build nodes — GD4 uses 0-indexed IDs
	const nodes = document.nodes.map((node) => ({
		id: node.index.toString(),
		x: node.x,
		y: node.y,
	}));

	// Ensure all edge-referenced nodes exist
	const nodeSet = new Set(document.nodes.map((n) => n.index));
	for (const edge of document.edges) {
		if (!nodeSet.has(edge.source)) {
			nodes.push({ id: edge.source.toString(), x: 0, y: 0 });
			nodeSet.add(edge.source);
		}
		if (!nodeSet.has(edge.target)) {
			nodes.push({ id: edge.target.toString(), x: 0, y: 0 });
			nodeSet.add(edge.target);
		}
	}

	// Sort nodes by numeric ID
	nodes.sort((a, b) => Number.parseInt(a.id, 10) - Number.parseInt(b.id, 10));

	// Convert edges
	const edges = document.edges.map((edge) => ({
		source: edge.source.toString(),
		target: edge.target.toString(),
	}));

	return {
		meta: {
			...options.meta,
			directed: false, // GD4 graphs are always undirected
		},
		nodes,
		edges,
	};
};
