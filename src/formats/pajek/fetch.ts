/**
 * Pajek Dataset Fetcher - Download and convert Pajek datasets in memory.
 *
 * Handles .net files, optionally compressed as .zip or .gz.
 *
 * @example CLI usage:
 * ```bash
 * npx tsx src/formats/pajek/fetch.ts http://example.com/network.net output.json
 * ```
 */

import { gunzipSync, unzipSync } from "fflate";

import type { GraphJson, GraphMeta } from "../gml/types";
import { pajekToJson, parsePajek } from "./parse";

/**
 * Options for fetching a Pajek dataset.
 */
export interface FetchPajekOptions {
	/** Metadata to include in output */
	meta: Omit<GraphMeta, "directed">;
	/** Override directed detection */
	directed?: boolean;
	/** Custom fetch function */
	fetch?: typeof globalThis.fetch;
}

/**
 * Result of fetching a Pajek dataset.
 */
export interface FetchPajekResult {
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
 * Fetch a Pajek dataset from URL, decompress if needed, and convert to JSON.
 *
 * @param url - URL to .net, .net.gz, or .zip file
 * @param options - Conversion options
 * @returns Converted graph and fetch metadata
 */
export const fetchPajekDataset = async (
	url: string,
	options: FetchPajekOptions
): Promise<FetchPajekResult> => {
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

		// Find the .net file in the archive
		const netFile = Object.keys(unzipped).find(
			(name) => name.toLowerCase().endsWith(".net") && !name.startsWith("__MACOSX")
		);

		if (!netFile) {
			throw new Error("No .net file found in ZIP archive");
		}

		const netData = unzipped[netFile];
		contentSize = netData.byteLength;

		const decoder = new TextDecoder("utf-8");
		content = decoder.decode(netData);
		filename = netFile;
	} else if (urlLower.endsWith(".gz")) {
		// Handle gzip
		const compressed = new Uint8Array(arrayBuffer);
		const decompressed = gunzipSync(compressed);
		contentSize = decompressed.byteLength;

		const decoder = new TextDecoder("utf-8");
		content = decoder.decode(decompressed);

		// Extract filename from URL
		const urlPath = new URL(url).pathname;
		filename = urlPath.split("/").pop()?.replace(/\.gz$/i, "") ?? "network.net";
	} else {
		// Plain .net file
		const decoder = new TextDecoder("utf-8");
		content = decoder.decode(arrayBuffer);
		contentSize = arrayBuffer.byteLength;

		const urlPath = new URL(url).pathname;
		filename = urlPath.split("/").pop() ?? "network.net";
	}

	// Parse and convert
	const document = parsePajek(content);
	const graph = pajekToJson(document, {
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
		console.error("Usage: npx tsx src/formats/pajek/fetch.ts <url> [output.json]");
		console.error("\nFetches a Pajek .net file and outputs JSON.");
		process.exit(1);
	}

	const [url, outputPath] = arguments_;

	console.error(`Fetching ${url}...`);

	const urlPath = new URL(url).pathname;
	const basename = urlPath.split("/").pop()?.replace(/\.(net|zip|gz)$/i, "") ?? "graph";

	const result = await fetchPajekDataset(url, {
		meta: {
			name: basename,
			description: `Graph fetched from ${url}`,
			source: "http://vlado.fmf.uni-lj.si/pub/networks/pajek/",
			url: url,
			citation: {
				authors: ["Vladimir Batagelj", "Andrej Mrvar"],
				title: "Pajek - Program for Large Network Analysis",
				year: 1998,
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

// Run CLI if executed directly (not when bundled)
if (import.meta.url === `file://${process.argv[1]}` && process.argv[1].endsWith("fetch.ts")) {
	main().catch((error: unknown) => {
		console.error("Error:", error);
		process.exit(1);
	});
}
