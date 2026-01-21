#!/usr/bin/env npx tsx
/**
 * SNAP Dataset Fetcher - Download and convert SNAP datasets in memory.
 *
 * Handles .txt.gz compressed edge list files from SNAP.
 *
 * @example CLI usage:
 * ```bash
 * npx tsx src/formats/snap/fetch.ts https://snap.stanford.edu/data/facebook_combined.txt.gz output.json
 * ```
 */

import { gunzipSync } from "fflate";

import type { GraphJson, GraphMeta } from "../gml/types";
import { parseSnap, snapToJson } from "./parse";

/**
 * Options for fetching a SNAP dataset.
 */
export interface FetchSnapOptions {
	/** Metadata to include in output */
	meta: Omit<GraphMeta, "directed">;
	/** Override directed detection */
	directed?: boolean;
	/** Custom fetch function */
	fetch?: typeof globalThis.fetch;
}

/**
 * Result of fetching a SNAP dataset.
 */
export interface FetchSnapResult {
	/** The converted graph */
	graph: GraphJson;
	/** Size of downloaded archive in bytes */
	archiveSize: number;
	/** Size of decompressed content in bytes */
	contentSize: number;
}

/**
 * Fetch a SNAP dataset from URL, decompress, and convert to JSON.
 *
 * @param url - URL to .txt.gz file
 * @param options - Conversion options
 * @returns Converted graph and fetch metadata
 */
export const fetchSnapDataset = async (
	url: string,
	options: FetchSnapOptions
): Promise<FetchSnapResult> => {
	const fetchFunction = options.fetch ?? globalThis.fetch;

	const response = await fetchFunction(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	}

	const arrayBuffer = await response.arrayBuffer();
	const archiveSize = arrayBuffer.byteLength;

	// Decompress if gzipped
	let content: string;
	let contentSize: number;

	if (url.endsWith(".gz")) {
		const compressed = new Uint8Array(arrayBuffer);
		const decompressed = gunzipSync(compressed);
		contentSize = decompressed.byteLength;
		const decoder = new TextDecoder("utf-8");
		content = decoder.decode(decompressed);
	} else {
		const decoder = new TextDecoder("utf-8");
		content = decoder.decode(arrayBuffer);
		contentSize = arrayBuffer.byteLength;
	}

	// Parse and convert
	const document = parseSnap(content);
	const graph = snapToJson(document, {
		meta: options.meta,
		directed: options.directed,
	});

	return {
		graph,
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
		console.error("Usage: npx tsx src/formats/snap/fetch.ts <url> [output.json]");
		console.error("\nFetches a SNAP edge list (.txt.gz) and outputs JSON.");
		process.exit(1);
	}

	const [url, outputPath] = arguments_;

	console.error(`Fetching ${url}...`);

	const urlPath = new URL(url).pathname;
	const basename = urlPath.split("/").pop()?.replace(/\.(txt|edges?)(\.gz)?$/i, "") ?? "graph";

	const result = await fetchSnapDataset(url, {
		meta: {
			name: basename,
			description: `Graph fetched from ${url}`,
			source: "https://snap.stanford.edu/data/",
			url: url,
			citation: {
				authors: ["Jure Leskovec", "Andrej Krevl"],
				title: "SNAP Datasets: Stanford Large Network Dataset Collection",
				year: 2014,
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
