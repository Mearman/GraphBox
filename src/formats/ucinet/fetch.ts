/**
 * UCINet Dataset Fetcher - Download and convert UCINet datasets in memory.
 *
 * Handles .dl files, optionally compressed as .zip or .gz.
 *
 * @example CLI usage:
 * ```bash
 * npx tsx src/formats/ucinet/fetch.ts http://example.com/network.dl output.json
 * ```
 */

import { gunzipSync, unzipSync } from "fflate";

import type { GraphJson, GraphMeta } from "../gml/types";
import { dlToJson, parseDl } from "./parse";

/**
 * Options for fetching a UCINet dataset.
 */
export interface FetchDlOptions {
	/** Metadata to include in output */
	meta: Omit<GraphMeta, "directed">;
	/** Override directed detection */
	directed?: boolean;
	/** Custom fetch function */
	fetch?: typeof globalThis.fetch;
}

/**
 * Result of fetching a UCINet dataset.
 */
export interface FetchDlResult {
	/** The converted graph */
	graph: GraphJson;
	/** Original filename (from URL or archive) */
	filename: string;
	/** Size of downloaded archive in bytes */
	archiveSize: number;
	/** Size of decompressed content in bytes */
	contentSize: number;
}

/**
 * Fetch a UCINet dataset from URL, decompress if needed, and convert to JSON.
 *
 * @param url - URL to .dl, .dl.gz, or .zip file
 * @param options - Conversion options
 * @returns Converted graph and fetch metadata
 */
export const fetchDlDataset = async (
	url: string,
	options: FetchDlOptions
): Promise<FetchDlResult> => {
	const fetchFunction = options.fetch ?? globalThis.fetch;

	const response = await fetchFunction(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	}

	const arrayBuffer = await response.arrayBuffer();
	const archiveSize = arrayBuffer.byteLength;

	// Determine file type from URL
	const urlLower = url.toLowerCase();
	let content: string;
	let contentSize: number;
	let filename: string;

	if (urlLower.endsWith(".zip")) {
		// Handle ZIP archive
		const zipData = new Uint8Array(arrayBuffer);
		const unzipped = unzipSync(zipData);

		// Find the .dl file in the archive
		const dlFile = Object.keys(unzipped).find(
			(name) => name.toLowerCase().endsWith(".dl") && !name.startsWith("__MACOSX")
		);

		if (!dlFile) {
			throw new Error("No .dl file found in ZIP archive");
		}

		const dlData = unzipped[dlFile];
		contentSize = dlData.byteLength;

		const decoder = new TextDecoder("utf-8");
		content = decoder.decode(dlData);
		filename = dlFile;
	} else if (urlLower.endsWith(".gz")) {
		// Handle gzip
		const compressed = new Uint8Array(arrayBuffer);
		const decompressed = gunzipSync(compressed);
		contentSize = decompressed.byteLength;

		const decoder = new TextDecoder("utf-8");
		content = decoder.decode(decompressed);

		// Extract filename from URL
		const urlPath = new URL(url).pathname;
		filename = urlPath.split("/").pop()?.replace(/\.gz$/i, "") ?? "network.dl";
	} else {
		// Plain .dl file
		const decoder = new TextDecoder("utf-8");
		content = decoder.decode(arrayBuffer);
		contentSize = arrayBuffer.byteLength;

		const urlPath = new URL(url).pathname;
		filename = urlPath.split("/").pop() ?? "network.dl";
	}

	// Parse and convert
	const document = parseDl(content);
	const graph = dlToJson(document, {
		meta: options.meta,
		directed: options.directed,
	});

	return {
		graph,
		filename,
		archiveSize,
		contentSize,
	};
};

/**
 * CLI entry point.
 */
const main = async (): Promise<void> => {
	const arguments_ = process.argv.slice(2);

	if (arguments_.length === 0) {
		console.error("Usage: npx tsx src/formats/ucinet/fetch.ts <url> [output.json]");
		console.error("\nFetches a UCINet .dl file and outputs JSON.");
		process.exit(1);
	}

	const [url, outputPath] = arguments_;

	console.error(`Fetching ${url}...`);

	const urlPath = new URL(url).pathname;
	const basename = urlPath.split("/").pop()?.replace(/\.(dl|zip|gz)$/i, "") ?? "graph";

	const result = await fetchDlDataset(url, {
		meta: {
			name: basename,
			description: `Graph fetched from ${url}`,
			source: "https://sites.google.com/site/uaborea/datasets",
			url: url,
			citation: {
				authors: ["Steve Borgatti", "Martin Everett", "Lin Freeman"],
				title: "UCINET for Windows: Software for Social Network Analysis",
				year: 2002,
				type: "other",
			},
			retrieved: new Date().toISOString().split("T")[0],
		},
	});

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

// Run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error: unknown) => {
		console.error("Error:", error);
		process.exit(1);
	});
}
