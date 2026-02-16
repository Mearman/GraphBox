/**
 * GD4 Dataset Fetcher - Download and convert GD4 datasets in memory.
 *
 * Handles .gd4 files, optionally compressed as .zip.
 * For ZIP archives, extracts .gd4 files (or nested challenge.zip containing them).
 */

import { unzipSync } from "fflate";

import type { GraphJson, GraphMeta } from "../gml/types";
import { gd4ToJson, parseGd4 } from "./parse";

/**
 * Options for fetching a GD4 dataset.
 */
export interface FetchGd4Options {
	/** Metadata to include in output */
	meta: Omit<GraphMeta, "directed">;
	/** Custom fetch function */
	fetch?: typeof globalThis.fetch;
	/** Specific .gd4 filename to extract from ZIP (e.g. "challenge/prob1.gd4") */
	entryName?: string;
}

/**
 * Result of fetching a GD4 dataset.
 */
export interface FetchGd4Result {
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
 * Find the best .gd4 file in an unzipped archive.
 *
 * If entryName is specified, searches all levels (including nested zips)
 * for that exact path before falling back. Otherwise picks the first
 * .gd4 file found.
 * @param unzipped
 * @param entryName
 */
const findGd4Content = (
	unzipped: Record<string, Uint8Array>,
	entryName?: string,
): { content: string; filename: string } | undefined => {
	const decoder = new TextDecoder("utf-8");

	// Direct match at this level
	if (entryName) {
		// Try exact match (with and without directory prefix)
		for (const [name, data] of Object.entries(unzipped)) {
			if (name === entryName || name.endsWith(`/${entryName}`)) {
				return { content: decoder.decode(data), filename: name };
			}
		}
	}

	// Search nested .zip files (prioritise entryName match before fallback)
	for (const [name, data] of Object.entries(unzipped)) {
		if (name.toLowerCase().endsWith(".zip") && !name.startsWith("__MACOSX")) {
			try {
				const nested = unzipSync(data);
				const result = findGd4Content(nested, entryName);
				if (result) {
					return result;
				}
			} catch {
				// Skip corrupt nested zips
			}
		}
	}

	// Fallback: first .gd4 file at this level (only when no entryName specified)
	if (!entryName) {
		const gd4File = Object.keys(unzipped).find(
			(name) => name.toLowerCase().endsWith(".gd4") && !name.startsWith("__MACOSX"),
		);
		if (gd4File) {
			return { content: decoder.decode(unzipped[gd4File]), filename: gd4File };
		}
	}

	return undefined;
};

/**
 * Fetch a GD4 dataset from URL, decompress if needed, and convert to JSON.
 *
 * @param url - URL to .gd4 or .zip file
 * @param options - Conversion options
 * @returns Converted graph and fetch metadata
 */
export const fetchGd4Dataset = async (
	url: string,
	options: FetchGd4Options,
): Promise<FetchGd4Result> => {
	const fetchFunction = options.fetch ?? globalThis.fetch;

	const response = await fetchFunction(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	}

	const arrayBuffer = await response.arrayBuffer();
	const archiveSize = arrayBuffer.byteLength;

	const urlLower = url.toLowerCase();
	let content: string;
	let contentSize: number;
	let filename: string;

	if (urlLower.endsWith(".zip")) {
		// Handle ZIP archive
		const zipData = new Uint8Array(arrayBuffer);
		const unzipped = unzipSync(zipData);

		const found = findGd4Content(unzipped, options.entryName);
		if (!found) {
			throw new Error("No .gd4 file found in ZIP archive");
		}

		content = found.content;
		contentSize = new TextEncoder().encode(content).byteLength;
		filename = found.filename;
	} else {
		// Plain .gd4 file
		const decoder = new TextDecoder("utf-8");
		content = decoder.decode(arrayBuffer);
		contentSize = arrayBuffer.byteLength;

		const urlPath = new URL(url).pathname;
		filename = urlPath.split("/").pop() ?? "graph.gd4";
	}

	// Parse and convert
	const document = parseGd4(content);
	const graph = gd4ToJson(document, { meta: options.meta });

	return { graph, filename, archiveSize, contentSize };
};
