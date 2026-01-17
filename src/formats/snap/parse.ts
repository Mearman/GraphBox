#!/usr/bin/env npx tsx
/**
 * SNAP Edge List Parser - Parse Stanford SNAP network data format.
 *
 * SNAP uses simple edge list format:
 * - Lines starting with # are comments (may contain metadata)
 * - Each data line is "FromNodeId ToNodeId" separated by whitespace
 *
 * @example CLI usage:
 * ```bash
 * npx tsx src/formats/snap/parse.ts input.txt output.json
 * ```
 */

import type { GraphEdge, GraphJson, GraphMeta, GraphNode } from "../gml/types";
import type { SnapDocument } from "./types";

/**
 * Parse a SNAP edge list string into a document.
 *
 * @param content - Edge list file content
 * @returns Parsed SNAP document
 */
export const parseSnap = (content: string): SnapDocument => {
	const lines = content.split("\n");
	const edges: Array<[string, string]> = [];
	const comments: string[] = [];
	let nodes: number | undefined;
	let edgeCount: number | undefined;
	let directed: boolean | undefined;

	for (const line of lines) {
		const trimmed = line.trim();

		// Skip empty lines
		if (trimmed === "") continue;

		// Comment line
		if (trimmed.startsWith("#")) {
			comments.push(trimmed);

			// Try to extract metadata from comments
			const lower = trimmed.toLowerCase();

			// Look for node count
			const nodeMatch = lower.match(/(\d+)\s*nodes?/i);
			if (nodeMatch) {
				nodes = Number.parseInt(nodeMatch[1], 10);
			}

			// Look for edge count
			const edgeMatch = lower.match(/(\d+)\s*edges?/i);
			if (edgeMatch) {
				edgeCount = Number.parseInt(edgeMatch[1], 10);
			}

			// Look for directed/undirected
			if (lower.includes("directed") && !lower.includes("undirected")) {
				directed = true;
			} else if (lower.includes("undirected")) {
				directed = false;
			}

			continue;
		}

		// Data line - split by whitespace
		const parts = trimmed.split(/\s+/);
		if (parts.length >= 2) {
			edges.push([parts[0], parts[1]]);
		}
	}

	return {
		edges,
		meta: {
			nodes,
			edges: edgeCount,
			directed,
			comments,
		},
	};
};

/**
 * Options for converting SNAP to JSON.
 */
export interface SnapToJsonOptions {
	/** Metadata to include in output */
	meta: Omit<GraphMeta, "directed">;
	/** Override directed detection (default: infer from comments or assume undirected) */
	directed?: boolean;
}

/**
 * Convert a parsed SNAP document to normalized JSON format.
 *
 * @param doc - Parsed SNAP document
 * @param document
 * @param options - Conversion options including metadata
 * @returns Graph in normalized JSON format
 */
export const snapToJson = (document: SnapDocument, options: SnapToJsonOptions): GraphJson => {
	const { meta } = options;

	// Determine if directed
	const directed = options.directed ?? document.meta.directed ?? false;

	// Collect unique node IDs
	const nodeIds = new Set<string>();
	for (const [source, target] of document.edges) {
		nodeIds.add(source);
		nodeIds.add(target);
	}

	// Create nodes
	const nodes: GraphNode[] = [...nodeIds]
		.sort((a, b) => {
			// Try numeric sort first
			const numberA = Number.parseInt(a, 10);
			const numberB = Number.parseInt(b, 10);
			if (!Number.isNaN(numberA) && !Number.isNaN(numberB)) {
				return numberA - numberB;
			}
			return a.localeCompare(b);
		})
		.map(id => ({ id }));

	// Create edges
	const edges: GraphEdge[] = document.edges.map(([source, target]) => ({
		source,
		target,
	}));

	return {
		meta: {
			...meta,
			directed,
		},
		nodes,
		edges,
	};
};

/**
 * CLI entry point - parse SNAP edge list to JSON.
 */
const main = async (): Promise<void> => {
	const arguments_ = process.argv.slice(2);

	if (arguments_.length === 0) {
		console.error("Usage: npx tsx src/formats/snap/parse.ts <input.txt> [output.json]");
		console.error("\nReads SNAP edge list and outputs JSON to stdout or specified file.");
		process.exit(1);
	}

	const [inputPath, outputPath] = arguments_;

	const fs = await import("node:fs");
	const path = await import("node:path");

	const content = fs.readFileSync(inputPath, "utf8");
	const document = parseSnap(content);

	const basename = path.basename(inputPath).replace(/\.(txt|edges?)$/i, "");
	const absolutePath = path.resolve(inputPath);

	const json = snapToJson(document, {
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

	console.error(`Nodes: ${json.nodes.length}, Edges: ${json.edges.length}, Directed: ${json.meta.directed}`);
};

// Run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error: unknown) => {
		console.error("Error:", error);
		process.exit(1);
	});
}
