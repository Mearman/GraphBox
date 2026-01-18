/**
 * Unified graph loading from various formats.
 *
 * Handles auto-detection and parsing of graph files.
 */

import { readFileSync } from "node:fs";

import { gmlToJson, parseGml } from "../formats/gml/index";
import type { GraphJson, GraphMeta } from "../formats/gml/types";
import { pajekToJson, parsePajek } from "../formats/pajek/index";
import { parseSnap, snapToJson } from "../formats/snap/index";
import { dlToJson, parseDl } from "../formats/ucinet/index";
import { detectFormat, type GraphFormat } from "./format-detection";

export interface LoadGraphOptions {
	/** Explicitly specify format (skips auto-detection) */
	format?: GraphFormat;

	/** Metadata to use for JSON conversion */
	meta?: Partial<GraphMeta>;
}

export interface LoadGraphResult {
	/** The loaded graph in GraphJson format */
	graph: GraphJson;

	/** The detected or specified format */
	format: GraphFormat;
}

/**
 * Load a graph from a file.
 * Auto-detects format if not specified.
 * @param filepath
 * @param options
 */
export const loadGraphFromFile = (
	filepath: string,
	options: LoadGraphOptions = {}
): LoadGraphResult => {
	const content = readFileSync(filepath, "utf-8");
	return loadGraphFromString(content, filepath, options);
};

/**
 * Load a graph from a string.
 * Auto-detects format if not specified.
 * @param content
 * @param filename
 * @param options
 */
export const loadGraphFromString = (
	content: string,
	filename: string,
	options: LoadGraphOptions = {}
): LoadGraphResult => {
	// Determine format
	const format = options.format ?? detectFormat(filename, content);

	if (format === null) {
		throw new Error(
			`Could not detect graph format for ${filename}. Specify format explicitly with --format`
		);
	}

	// Parse based on format
	let graph: GraphJson;

	switch (format) {
		case "json": {
			graph = JSON.parse(content) as GraphJson;
			break;
		}

		case "gml": {
			const document = parseGml(content);
			graph = gmlToJson(document, { meta: createDefaultMeta(filename, options.meta) });
			break;
		}

		case "pajek": {
			const document = parsePajek(content);
			graph = pajekToJson(document, { meta: createDefaultMeta(filename, options.meta) });
			break;
		}

		case "snap": {
			const document = parseSnap(content);
			graph = snapToJson(document, { meta: createDefaultMeta(filename, options.meta) });
			break;
		}

		case "ucinet": {
			const document = parseDl(content);
			graph = dlToJson(document, { meta: createDefaultMeta(filename, options.meta) });
			break;
		}

		default: {
			const _exhaustive: never = format;
			throw new Error(`Unsupported format: ${_exhaustive}`);
		}
	}

	return { graph, format };
};

/**
 * Create default metadata for a loaded graph.
 * @param filename
 * @param overrides
 */
const createDefaultMeta = (filename: string, overrides?: Partial<GraphMeta>): GraphMeta => {
	return {
		name: overrides?.name ?? filename,
		description: overrides?.description ?? `Graph loaded from ${filename}`,
		source: overrides?.source ?? filename,
		url: overrides?.url ?? "",
		citation: overrides?.citation ?? {
			authors: [],
			title: filename,
			year: new Date().getFullYear(),
		},
		retrieved: new Date().toISOString(),
		directed: overrides?.directed ?? false,
		...overrides,
	};
};
