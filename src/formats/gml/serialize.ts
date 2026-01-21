#!/usr/bin/env npx tsx
/**
 * GML Serializer - Convert JSON graphs to Graph Modelling Language format.
 *
 * @example CLI usage:
 * ```bash
 * npx tsx src/formats/gml/serialize.ts input.json output.gml
 * ```
 *
 * @example Programmatic usage:
 * ```typescript
 * import { serializeGml } from 'graphbox/formats/gml';
 *
 * const json = JSON.parse(fs.readFileSync('graph.json', 'utf-8'));
 * const gml = serializeGml(json);
 * fs.writeFileSync('graph.gml', gml);
 * ```
 */

import type { GraphJson } from "./types";

/**
 * Options for GML serialization.
 */
export interface SerializeGmlOptions {
	/** Include creator comment */
	creator?: string;
	/** Indentation string (default: two spaces) */
	indent?: string;
	/** Use numeric IDs instead of labels */
	useNumericIds?: boolean;
}

/**
 * Escape a string value for GML format.
 * @param value
 */
const escapeGmlString = (value: string): string => {
	return value
		.replaceAll("\\", "\\\\")
		.replaceAll('"', String.raw`\"`)
		.replaceAll("\n", String.raw`\n`)
		.replaceAll("\t", String.raw`\t`);
};

/**
 * Format a value for GML output.
 * @param value
 */
const formatGmlValue = (value: unknown): string => {
	if (typeof value === "string") {
		return `"${escapeGmlString(value)}"`;
	}
	if (typeof value === "number") {
		return Number.isInteger(value) ? String(value) : value.toFixed(6);
	}
	if (typeof value === "boolean") {
		return value ? "1" : "0";
	}
	return `"${escapeGmlString(String(value))}"`;
};

/**
 * Serialize a graph JSON object to GML format.
 *
 * @param graph - Graph in normalized JSON format
 * @param options - Serialization options
 * @returns GML string
 */
export const serializeGml = (graph: GraphJson, options: SerializeGmlOptions = {}): string => {
	const { creator, indent = "  ", useNumericIds = false } = options;

	const lines: string[] = [];

	// Creator comment
	if (creator) {
		lines.push(`Creator "${escapeGmlString(creator)}"`);
	} else if (graph.meta.creator) {
		lines.push(`Creator "${escapeGmlString(graph.meta.creator)}"`);
	}

	lines.push("graph", "[", `${indent}directed ${graph.meta.directed ? 1 : 0}`);

	// Build node ID to numeric ID map if using numeric IDs
	const nodeIdToNumeric = new Map<string, number>();
	if (useNumericIds) {
		for (const [index, node] of graph.nodes.entries()) {
			nodeIdToNumeric.set(node.id, index);
		}
	}

	// Serialize nodes
	for (const [index, node] of graph.nodes.entries()) {
		lines.push(`${indent}node`, `${indent}[`);

		const numericId = useNumericIds ? index : index;
		lines.push(`${indent}${indent}id ${numericId}`);

		// Label (use original ID as label if using numeric IDs)
		if (useNumericIds || node.label) {
			const label = node.label ?? node.id;
			lines.push(`${indent}${indent}label ${formatGmlValue(label)}`);
		}

		// Other properties (preserve as-is)
		for (const [key, value] of Object.entries(node)) {
			if (key === "id" || key === "label") continue;
			if (value === undefined || value === null) continue;
			lines.push(`${indent}${indent}${key} ${formatGmlValue(value)}`);
		}

		lines.push(`${indent}]`);
	}

	// Serialize edges
	for (const edge of graph.edges) {
		lines.push(`${indent}edge`, `${indent}[`);

		// Source and target
		const sourceId = useNumericIds
			? nodeIdToNumeric.get(edge.source)
			: graph.nodes.findIndex((n) => n.id === edge.source);
		const targetId = useNumericIds
			? nodeIdToNumeric.get(edge.target)
			: graph.nodes.findIndex((n) => n.id === edge.target);

		if (sourceId === undefined || sourceId === -1) {
			throw new Error(`Unknown source node: ${edge.source}`);
		}
		if (targetId === undefined || targetId === -1) {
			throw new Error(`Unknown target node: ${edge.target}`);
		}

		lines.push(`${indent}${indent}source ${sourceId}`, `${indent}${indent}target ${targetId}`);

		// Other properties
		for (const [key, value] of Object.entries(edge)) {
			if (key === "source" || key === "target") continue;
			if (key === "directed") continue; // Handled at graph level
			if (value === undefined || value === null) continue;

			lines.push(`${indent}${indent}${key} ${formatGmlValue(value)}`);
		}

		lines.push(`${indent}]`);
	}

	lines.push("]");

	return lines.join("\n");
};

/**
 * CLI entry point - convert JSON to GML.
 */
const main = async (): Promise<void> => {
	const arguments_ = process.argv.slice(2);

	if (arguments_.length === 0) {
		console.error("Usage: npx tsx src/formats/gml/serialize.ts <input.json> [output.gml]");
		console.error("\nReads JSON and outputs GML to stdout or specified file.");
		process.exit(1);
	}

	const [inputPath, outputPath] = arguments_;

	const fs = await import("node:fs");

	const jsonContent = fs.readFileSync(inputPath, "utf8");
	const graph = JSON.parse(jsonContent) as GraphJson;

	const gml = serializeGml(graph, {
		useNumericIds: true,
	});

	if (outputPath) {
		fs.writeFileSync(outputPath, gml + "\n");
		console.error(`Written to ${outputPath}`);
	} else {
		console.log(gml);
	}
};

// Run CLI if executed directly (not when bundled)
if (import.meta.url === `file://${process.argv[1]}` && process.argv[1].endsWith("serialize.ts")) {
	main().catch((error: unknown) => {
		console.error("Error:", error);
		process.exit(1);
	});
}
