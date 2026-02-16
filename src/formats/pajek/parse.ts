/**
 * Pajek .net format parser.
 *
 * Parses the Pajek network format into a structured document,
 * then converts to the normalized JSON format.
 *
 * Format specification:
 * - *Vertices N: Declares N vertices
 * - Vertex lines: id "label" [x y z] [attributes...]
 * - *Edges: Undirected edges section
 * - *Arcs: Directed arcs section
 * - *2Mode N: Bipartite (two-mode) edges — first N vertices are mode 1
 * - Edge/Arc lines: source target [weight]
 */

import type { GraphJson, GraphMeta, GraphNode } from "../gml/types";
import type { PajekDocument, PajekEdge, PajekVertex } from "./types";

/**
 * Parse state machine states.
 */
type ParseState = "initial" | "vertices" | "edges" | "arcs" | "matrix";

/**
 * Parse a Pajek .net format string into a structured document.
 *
 * @param content - The .net file content
 * @returns Parsed Pajek document
 */
export const parsePajek = (content: string): PajekDocument => {
	const lines = content.split(/\r?\n/);

	let vertexCount = 0;
	let mode1Count = 0; // bipartite: first N vertices are mode-1
	let matrixRow = 0; // current row index during *matrix parsing
	const vertices: PajekVertex[] = [];
	const edges: PajekEdge[] = [];
	const arcs: PajekEdge[] = [];

	let state: ParseState = "initial";

	for (const line of lines) {
		const trimmed = line.trim();

		// Skip empty lines and comments
		if (trimmed === "" || trimmed.startsWith("%")) {
			continue;
		}

		// Check for section headers
		const lowerLine = trimmed.toLowerCase();

		if (lowerLine.startsWith("*vertices")) {
			// Extract vertex count and optional mode-1 count
			// Format: *Vertices N [M] where M = mode-1 count for bipartite
			const match = trimmed.match(/\*vertices\s+(\d+)(?:\s+(\d+))?/i);
			if (match) {
				vertexCount = Number.parseInt(match[1], 10);
				if (match[2] !== undefined) {
					mode1Count = Number.parseInt(match[2], 10);
				}
			}
			state = "vertices";
			continue;
		}

		if (lowerLine.startsWith("*edges") || lowerLine.startsWith("*edgeslist")) {
			state = "edges";
			continue;
		}

		if (lowerLine.startsWith("*arcs") || lowerLine.startsWith("*arcslist")) {
			state = "arcs";
			continue;
		}

		// Bipartite (two-mode) networks: *2Mode N declares edges between
		// two vertex partitions. Data lines use the same format as *Edges.
		if (lowerLine.startsWith("*2mode")) {
			state = "edges";
			continue;
		}

		// Adjacency matrix: *Matrix section where each row i has values
		// for connections. For bipartite graphs with mode1Count > 0,
		// row i (1-indexed) maps to mode-1 vertex i, and column j maps
		// to mode-2 vertex (mode1Count + j).
		if (lowerLine.startsWith("*matrix")) {
			state = "matrix";
			matrixRow = 0;
			continue;
		}

		// Skip other section headers we don't handle (e.g. *net, *partition)
		if (lowerLine.startsWith("*")) {
			state = "initial";
			continue;
		}

		// Parse based on current state
		switch (state) {
			case "vertices": {
				const vertex = parseVertex(trimmed);
				if (vertex) {
					vertices.push(vertex);
				}
				break;
			}
			case "edges": {
				const edge = parseEdge(trimmed);
				if (edge) {
					edges.push(edge);
				}
				break;
			}
			case "arcs": {
				const arc = parseEdge(trimmed);
				if (arc) {
					arcs.push(arc);
				}
				break;
			}
			case "matrix": {
				matrixRow++;
				const values = trimmed.split(/\s+/);
				for (const [col, value] of values.entries()) {
					const val = Number.parseFloat(value);
					if (val !== 0 && !Number.isNaN(val)) {
						// For bipartite: row→mode-1 vertex, col→mode-2 vertex
						const source = matrixRow;
						const target = mode1Count > 0
							? mode1Count + col + 1
							: col + 1;
						const edge: PajekEdge = { source, target };
						if (val !== 1) {
							edge.weight = val;
						}
						edges.push(edge);
					}
				}
				break;
			}
		}
	}

	return {
		vertexCount,
		vertices,
		edges,
		arcs,
		directed: arcs.length > 0 && edges.length === 0,
	};
};

/**
 * Parse a vertex line.
 *
 * Formats:
 * - id
 * - id "label"
 * - id "label" x y
 * - id "label" x y z
 * @param line
 */
const parseVertex = (line: string): PajekVertex | null => {
	// Match: id optionally followed by quoted label and coordinates
	const match = line.match(/^(\d+)(?:\s+"([^"]*)")?(?:\s+([0-9.e+-]+)\s+([0-9.e+-]+)(?:\s+([0-9.e+-]+))?)?/i);

	if (!match) {
		return null;
	}

	const vertex: PajekVertex = {
		id: Number.parseInt(match[1], 10),
	};

	if (match[2] !== undefined) {
		vertex.label = match[2];
	}

	if (match[3] !== undefined && match[4] !== undefined) {
		vertex.x = Number.parseFloat(match[3]);
		vertex.y = Number.parseFloat(match[4]);

		if (match[5] !== undefined) {
			vertex.z = Number.parseFloat(match[5]);
		}
	}

	return vertex;
};

/**
 * Parse an edge/arc line.
 *
 * Formats:
 * - source target
 * - source target weight
 * @param line
 */
const parseEdge = (line: string): PajekEdge | null => {
	const parts = line.split(/\s+/);

	if (parts.length < 2) {
		return null;
	}

	const source = Number.parseInt(parts[0], 10);
	const target = Number.parseInt(parts[1], 10);

	if (Number.isNaN(source) || Number.isNaN(target)) {
		return null;
	}

	const edge: PajekEdge = { source, target };

	if (parts.length >= 3) {
		const weight = Number.parseFloat(parts[2]);
		if (!Number.isNaN(weight)) {
			edge.weight = weight;
		}
	}

	return edge;
};

/**
 * Options for converting Pajek to JSON.
 */
export interface PajekToJsonOptions {
	/** Metadata to include in output */
	meta: Omit<GraphMeta, "directed">;
	/** Override directed detection */
	directed?: boolean;
}

/**
 * Convert a parsed Pajek document to normalized JSON format.
 *
 * @param doc - Parsed Pajek document
 * @param document
 * @param options - Conversion options
 * @returns Graph in normalized JSON format
 */
export const pajekToJson = (document: PajekDocument, options: PajekToJsonOptions): GraphJson => {
	const directed = options.directed ?? document.directed;

	// Build node map - Pajek IDs are 1-indexed
	const nodeMap = new Map<number, GraphNode>();

	// First, add explicitly defined vertices
	for (const vertex of document.vertices) {
		const node: GraphNode = {
			id: vertex.id.toString(),
		};

		if (vertex.label !== undefined) {
			node.label = vertex.label;
		}

		// Store position as properties if present
		if (vertex.x !== undefined && vertex.y !== undefined) {
			node.x = vertex.x;
			node.y = vertex.y;

			if (vertex.z !== undefined) {
				node.z = vertex.z;
			}
		}

		nodeMap.set(vertex.id, node);
	}

	// Collect all edges (both edges and arcs)
	const allEdges = [...document.edges, ...document.arcs];

	// Ensure all referenced nodes exist
	for (const edge of allEdges) {
		if (!nodeMap.has(edge.source)) {
			nodeMap.set(edge.source, { id: edge.source.toString() });
		}
		if (!nodeMap.has(edge.target)) {
			nodeMap.set(edge.target, { id: edge.target.toString() });
		}
	}

	// If no vertices were explicitly defined but vertexCount was given,
	// create nodes for all IDs up to vertexCount
	if (document.vertices.length === 0 && document.vertexCount > 0) {
		for (let index = 1; index <= document.vertexCount; index++) {
			if (!nodeMap.has(index)) {
				nodeMap.set(index, { id: index.toString() });
			}
		}
	}

	// Sort nodes by numeric ID
	const nodes = [...nodeMap.values()].sort((a, b) => Number.parseInt(a.id, 10) - Number.parseInt(b.id, 10));

	// Convert edges
	const edges = allEdges.map((edge) => {
		const graphEdge: { source: string; target: string; weight?: number } = {
			source: edge.source.toString(),
			target: edge.target.toString(),
		};

		if (edge.weight !== undefined) {
			graphEdge.weight = edge.weight;
		}

		return graphEdge;
	});

	return {
		meta: {
			...options.meta,
			directed,
		},
		nodes,
		edges,
	};
};
