#!/usr/bin/env npx tsx
/**
 * GML Parser - Parse Graph Modelling Language files to JSON.
 *
 * GML is a portable file format for graphs described by Mark Himsolt.
 * This parser handles the subset of GML used by common network datasets.
 *
 * @example CLI usage:
 * ```bash
 * npx tsx src/formats/gml/parse.ts input.gml output.json
 * ```
 *
 * @example Programmatic usage:
 * ```typescript
 * import { parseGml, gmlToJson } from 'graphbox/formats/gml';
 *
 * const gmlContent = fs.readFileSync('graph.gml', 'utf-8');
 * const parsed = parseGml(gmlContent);
 * const json = gmlToJson(parsed, { name: 'My Graph', ... });
 * ```
 */

import type { GmlDocument, GmlEdge, GmlNode, GraphEdge, GraphJson, GraphMeta, GraphNode } from "./types";

/**
 * Token types for the GML lexer.
 */
type TokenType = "KEY" | "STRING" | "NUMBER" | "LBRACKET" | "RBRACKET";

interface Token {
	type: TokenType;
	value: string | number;
}

/**
 * Tokenize a GML string into tokens.
 * @param input
 */
const tokenize = (input: string): Token[] => {
	const tokens: Token[] = [];
	let index = 0;

	while (index < input.length) {
		const char = input[index];

		// Skip whitespace
		if (/\s/.test(char)) {
			index++;
			continue;
		}

		// Skip comments (lines starting with #)
		if (char === "#") {
			while (index < input.length && input[index] !== "\n") {
				index++;
			}
			continue;
		}

		// Brackets
		if (char === "[") {
			tokens.push({ type: "LBRACKET", value: "[" });
			index++;
			continue;
		}
		if (char === "]") {
			tokens.push({ type: "RBRACKET", value: "]" });
			index++;
			continue;
		}

		// Quoted strings
		if (char === '"') {
			index++; // Skip opening quote
			let string_ = "";
			while (index < input.length && input[index] !== '"') {
				if (input[index] === "\\" && index + 1 < input.length) {
					// Handle escape sequences
					index++;
					const escaped = input[index];
					switch (escaped) {
						case "n": {
							string_ += "\n";
							break;
						}
						case "t": {
							string_ += "\t";
							break;
						}
						case "\\": {
							string_ += "\\";
							break;
						}
						case '"': {
							string_ += '"';
							break;
						}
						default: { string_ += escaped;
						}
					}
				} else {
					string_ += input[index];
				}
				index++;
			}
			index++; // Skip closing quote
			tokens.push({ type: "STRING", value: string_ });
			continue;
		}

		// Numbers (including negative and floating point)
		if (/[-+\d.]/.test(char)) {
			let numberString = "";
			// Check for negative sign
			if (char === "-" || char === "+") {
				numberString += char;
				index++;
			}
			// Collect digits and decimal point
			while (index < input.length && /[\d.e+-]/i.test(input[index])) {
				numberString += input[index];
				index++;
			}
			// Only treat as number if it's actually a valid number
			if (/^[-+]?(?:\d+(?:\.\d+)?|\.\d+)(e[-+]?\d+)?$/i.test(numberString)) {
				const number_ = Number.parseFloat(numberString);
				tokens.push({ type: "NUMBER", value: number_ });
				continue;
			}
			// If not a valid number, treat as key
			tokens.push({ type: "KEY", value: numberString });
			continue;
		}

		// Keywords/identifiers
		if (/[a-z_]/i.test(char)) {
			let key = "";
			while (index < input.length && /\w/.test(input[index])) {
				key += input[index];
				index++;
			}
			tokens.push({ type: "KEY", value: key });
			continue;
		}

		// Unknown character, skip
		index++;
	}

	return tokens;
};

/**
 * Parse tokens into a structured GML document.
 * @param tokens
 */
const parseTokens = (tokens: Token[]): GmlDocument => {
	let pos = 0;

	const parseValue = (): unknown => {
		const token = tokens[pos];
		if (!token) return null;

		if (token.type === "STRING" || token.type === "NUMBER") {
			pos++;
			return token.value;
		}

		if (token.type === "LBRACKET") {
			pos++; // Skip [
			const object: Record<string, unknown> = {};
			while (pos < tokens.length && tokens[pos].type !== "RBRACKET") {
				const keyToken = tokens[pos];
				if (keyToken.type !== "KEY") {
					pos++;
					continue;
				}
				const key = keyToken.value as string;
				pos++;
				const value = parseValue();
				// Handle multiple values with same key (arrays)
				if (key in object) {
					if (!Array.isArray(object[key])) {
						object[key] = [object[key]];
					}
					(object[key] as unknown[]).push(value);
				} else {
					object[key] = value;
				}
			}
			pos++; // Skip ]
			return object;
		}

		pos++;
		return null;
	};

	// Extract creator comment if present
	let creator: string | undefined;
	const document: GmlDocument = {
		graph: {},
		nodes: [],
		edges: [],
	};

	// Parse top-level
	while (pos < tokens.length) {
		const token = tokens[pos];
		if (token.type === "KEY") {
			const key = token.value as string;
			pos++;

			if (key === "Creator") {
				const value = parseValue();
				creator = String(value);
			} else if (key === "graph") {
				const graphObject = parseValue() as Record<string, unknown>;
				if (graphObject) {
					// Extract nodes and edges
					const nodes = graphObject.node;
					const edges = graphObject.edge;
					delete graphObject.node;
					delete graphObject.edge;

					document.graph = graphObject;

					if (nodes) {
						document.nodes = Array.isArray(nodes) ? (nodes as GmlNode[]) : [nodes as GmlNode];
					}
					if (edges) {
						document.edges = Array.isArray(edges) ? (edges as GmlEdge[]) : [edges as GmlEdge];
					}
				}
			} else {
				// Skip other top-level keys
				parseValue();
			}
		} else {
			pos++;
		}
	}

	if (creator) {
		document.creator = creator;
	}

	return document;
};

/**
 * Parse a GML string into a structured document.
 *
 * @param gml - GML file content as string
 * @returns Parsed GML document
 */
export const parseGml = (gml: string): GmlDocument => {
	const tokens = tokenize(gml);
	return parseTokens(tokens);
};

/**
 * Options for converting GML to JSON.
 */
export interface GmlToJsonOptions {
	/** Metadata to include in the output */
	meta: Omit<GraphMeta, "directed">;
	/** Map GML node IDs (numeric) to string IDs */
	nodeIdMapper?: (id: number, node: GmlNode) => string;
}

/**
 * Convert a parsed GML document to the normalized JSON format.
 *
 * @param doc - Parsed GML document
 * @param document
 * @param options - Conversion options including metadata
 * @returns Graph in normalized JSON format
 */
export const gmlToJson = (document: GmlDocument, options: GmlToJsonOptions): GraphJson => {
	const { meta, nodeIdMapper } = options;

	// Determine if directed
	const directed = document.graph.directed === 1;

	// Build node ID map (GML uses numeric IDs)
	const nodeIdMap = new Map<number, string>();

	// Default mapper: use label if available, otherwise string ID
	const defaultMapper = (id: number, node: GmlNode): string => {
		if (node.label && typeof node.label === "string") {
			return node.label;
		}
		return String(id);
	};

	const mapper = nodeIdMapper ?? defaultMapper;

	// Convert nodes
	const nodes: GraphNode[] = document.nodes.map((gmlNode) => {
		const stringId = mapper(gmlNode.id, gmlNode);
		nodeIdMap.set(gmlNode.id, stringId);

		const node: GraphNode = { id: stringId };

		// Copy other properties as-is (preserve original property names)
		for (const [key, value] of Object.entries(gmlNode)) {
			if (key === "id") continue;
			if (key === "label" && value === stringId) continue; // Don't duplicate
			if (key !== "label") {
				node[key] = value;
			}
		}

		return node;
	});

	// Convert edges
	const edges: GraphEdge[] = document.edges.map((gmlEdge) => {
		const sourceId = nodeIdMap.get(gmlEdge.source);
		const targetId = nodeIdMap.get(gmlEdge.target);

		if (!sourceId || !targetId) {
			throw new Error(`Edge references unknown node: ${gmlEdge.source} -> ${gmlEdge.target}`);
		}

		const edge: GraphEdge = {
			source: sourceId,
			target: targetId,
		};

		// Copy other properties
		for (const [key, value] of Object.entries(gmlEdge)) {
			if (key === "source" || key === "target") continue;
			if (key === "value" && typeof value === "number") {
				// Preserve 'value' as-is (not renamed to weight)
				edge.value = value;
			} else if (key === "weight" && typeof value === "number") {
				edge.weight = value;
			} else {
				edge[key] = value;
			}
		}

		return edge;
	});

	return {
		meta: {
			...meta,
			directed,
			creator: document.creator,
		},
		nodes,
		edges,
	};
};

/**
 * CLI entry point - parse GML file to JSON.
 */
const main = async (): Promise<void> => {
	const arguments_ = process.argv.slice(2);

	if (arguments_.length === 0) {
		console.error("Usage: npx tsx src/formats/gml/parse.ts <input.gml> [output.json]");
		console.error("\nReads GML and outputs JSON to stdout or specified file.");
		process.exit(1);
	}

	const [inputPath, outputPath] = arguments_;

	// Dynamic import for Node.js modules (allows this file to be used in browser too)
	const fs = await import("node:fs");
	const path = await import("node:path");

	const gmlContent = fs.readFileSync(inputPath, "utf8");
	const document = parseGml(gmlContent);

	// Create minimal metadata from filename
	const basename = path.basename(inputPath, ".gml");
	const absolutePath = path.resolve(inputPath);
	const json = gmlToJson(document, {
		meta: {
			name: basename,
			description: `Graph converted from ${path.basename(inputPath)}`,
			source: absolutePath,
			url: absolutePath,
			citation: {
				authors: [],
				title: basename,
				year: new Date().getFullYear(),
			},
			retrieved: new Date().toISOString().split("T")[0],
		},
	});

	const output = JSON.stringify(json, null, "\t");

	if (outputPath) {
		fs.writeFileSync(outputPath, output + "\n");
		console.error(`Written to ${outputPath}`);
	} else {
		console.log(output);
	}
};

// Run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error: unknown) => {
		console.error("Error:", error);
		process.exit(1);
	});
}
