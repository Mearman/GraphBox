#!/usr/bin/env npx tsx
/**
 * Dataset Fetcher - Download, extract, and convert graph datasets in memory.
 *
 * Supports fetching GML files from zip archives (like Newman's network data)
 * and converting them to the normalized JSON format.
 *
 * @example CLI usage:
 * ```bash
 * npx tsx src/formats/gml/fetch.ts https://websites.umich.edu/~mejn/netdata/karate.zip output.json
 * ```
 *
 * @example Programmatic usage:
 * ```typescript
 * import { fetchDataset } from 'graphbox/formats/gml';
 *
 * const graph = await fetchDataset('https://websites.umich.edu/~mejn/netdata/karate.zip', {
 *   meta: { name: 'Karate Club', ... }
 * });
 * ```
 */

import { unzipSync } from "fflate";

import type { GmlToJsonOptions } from "./parse";
import { gmlToJson, parseGml } from "./parse";
import type { GraphJson } from "./types";

/**
 * Options for fetching a dataset.
 */
export interface FetchDatasetOptions extends GmlToJsonOptions {
	/** Custom fetch function (for testing or custom environments) */
	fetch?: typeof globalThis.fetch;
	/** File extension to look for in the archive (default: .gml) */
	extension?: string;
}

/**
 * Result of fetching a dataset, including the graph and metadata about the fetch.
 */
export interface FetchDatasetResult {
	/** The converted graph */
	graph: GraphJson;
	/** The filename that was extracted */
	filename: string;
	/** Size of the downloaded archive in bytes */
	archiveSize: number;
	/** Size of the extracted GML content in bytes */
	contentSize: number;
}

/**
 * Fetch a dataset from a URL, extract GML from zip, and convert to JSON.
 *
 * @param url - URL to a zip archive containing a GML file
 * @param options - Conversion options including metadata
 * @returns The converted graph and fetch metadata
 *
 * @example
 * ```typescript
 * const result = await fetchDataset(
 *   'https://websites.umich.edu/~mejn/netdata/karate.zip',
 *   {
 *     meta: {
 *       name: "Zachary's Karate Club",
 *       description: "Social network of friendships...",
 *       source: "https://websites.umich.edu/~mejn/netdata/",
 *       url: "https://websites.umich.edu/~mejn/netdata/karate.zip",
 *       citation: { authors: ["W. W. Zachary"], title: "...", year: 1977 },
 *       retrieved: "2024-01-17"
 *     }
 *   }
 * );
 * console.log(result.graph.nodes.length); // 34
 * ```
 */
export const fetchDataset = async (
	url: string,
	options: FetchDatasetOptions
): Promise<FetchDatasetResult> => {
	const fetchFunction = options.fetch ?? globalThis.fetch;
	const extension = options.extension ?? ".gml";

	// Fetch the zip archive
	const response = await fetchFunction(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	}

	const arrayBuffer = await response.arrayBuffer();
	const archiveSize = arrayBuffer.byteLength;

	// Extract the zip in memory
	const zipData = new Uint8Array(arrayBuffer);
	const unzipped = unzipSync(zipData);

	// Find the GML file
	const gmlFiles = Object.keys(unzipped).filter(name =>
		name.toLowerCase().endsWith(extension.toLowerCase())
	);

	if (gmlFiles.length === 0) {
		const files = Object.keys(unzipped).join(", ");
		throw new Error(`No ${extension} file found in archive. Files: ${files}`);
	}

	// Use the first GML file found
	const filename = gmlFiles[0];
	const gmlData = unzipped[filename];
	const contentSize = gmlData.byteLength;

	// Decode the GML content
	const decoder = new TextDecoder("utf-8");
	const gmlContent = decoder.decode(gmlData);

	// Parse and convert
	const document = parseGml(gmlContent);
	const graph = gmlToJson(document, options);

	return {
		graph,
		filename,
		archiveSize,
		contentSize,
	};
};

/**
 * Fetch multiple datasets in parallel.
 *
 * @param datasets - Array of [url, options] tuples
 * @returns Array of fetch results
 */
export const fetchDatasets = async (
	datasets: Array<[string, FetchDatasetOptions]>
): Promise<FetchDatasetResult[]> => {
	return Promise.all(datasets.map(([url, options]) => fetchDataset(url, options)));
};

/**
 * CLI entry point - fetch dataset from URL and output JSON.
 */
const main = async (): Promise<void> => {
	const arguments_ = process.argv.slice(2);

	if (arguments_.length === 0) {
		console.error("Usage: npx tsx src/formats/gml/fetch.ts <url> [output.json]");
		console.error("\nFetches a zip archive containing GML and outputs JSON.");
		console.error("\nExample:");
		console.error("  npx tsx src/formats/gml/fetch.ts https://websites.umich.edu/~mejn/netdata/karate.zip");
		process.exit(1);
	}

	const [url, outputPath] = arguments_;

	console.error(`Fetching ${url}...`);

	// Extract name from URL for basic metadata
	const urlPath = new URL(url).pathname;
	const basename = urlPath.split("/").pop()?.replace(/\.zip$/i, "") ?? "graph";

	const result = await fetchDataset(url, {
		meta: {
			name: basename,
			description: `Graph fetched from ${url}`,
			source: url,
			url: url,
			citation: {
				authors: [],
				title: basename,
				year: new Date().getFullYear(),
			},
			retrieved: new Date().toISOString().split("T")[0],
		},
	});

	console.error(`Extracted: ${result.filename}`);
	console.error(`Archive size: ${(result.archiveSize / 1024).toFixed(1)} KB`);
	console.error(`Content size: ${(result.contentSize / 1024).toFixed(1)} KB`);
	console.error(`Nodes: ${result.graph.nodes.length}, Edges: ${result.graph.edges.length}`);

	const output = JSON.stringify(result.graph, null, "\t");

	if (outputPath) {
		const fs = await import("node:fs");
		fs.writeFileSync(outputPath, output + "\n");
		console.error(`Written to ${outputPath}`);
	} else {
		console.log(output);
	}
};

// Run CLI if executed directly (not when bundled)
if (import.meta.url === `file://${process.argv[1]}` && process.argv[1].endsWith("fetch.ts")) {
	main().catch((error: unknown) => {
		console.error("Error:", error);
		process.exit(1);
	});
}
