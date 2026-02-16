/**
 * Matrix Market Dataset Fetcher - Download and convert .mtx datasets.
 *
 * Handles .tar.gz archives from SuiteSparse Matrix Collection,
 * which contain a .mtx file and optional auxiliary files (_nodename.txt).
 */

import { gunzipSync } from "fflate";

import type { GraphJson, GraphMeta } from "../gml/types";
import { mtxToJson, parseMtx } from "./parse";

/**
 * Options for fetching a Matrix Market dataset.
 */
export interface FetchMtxOptions {
	/** Metadata to include in output */
	meta: Omit<GraphMeta, "directed">;
	/** Override directed detection */
	directed?: boolean;
	/** Custom fetch function */
	fetch?: typeof globalThis.fetch;
}

/**
 * Result of fetching a Matrix Market dataset.
 */
export interface FetchMtxResult {
	/** The converted graph */
	graph: GraphJson;
	/** Original filename */
	filename: string;
	/** Size of downloaded archive in bytes */
	archiveSize: number;
}

/**
 * Minimal tar header parsing — extract file entries from a tar archive.
 *
 * Tar format: 512-byte header blocks followed by file content (padded to 512).
 * @param data
 */
const extractTar = (
	data: Uint8Array,
): Array<{ name: string; content: Uint8Array }> => {
	const entries: Array<{ name: string; content: Uint8Array }> = [];
	let offset = 0;

	while (offset + 512 <= data.length) {
		// Read filename (first 100 bytes, null-terminated)
		const nameBytes = data.slice(offset, offset + 100);
		const nameEnd = nameBytes.indexOf(0);
		const name = new TextDecoder("ascii").decode(
			nameBytes.slice(0, nameEnd === -1 ? 100 : nameEnd),
		);

		if (name === "") break; // End of archive

		// Read file size (octal string at offset 124, 12 bytes)
		const sizeStr = new TextDecoder("ascii")
			.decode(data.slice(offset + 124, offset + 136))
			.trim()
			.replaceAll("\0", "");
		const size = Number.parseInt(sizeStr, 8);

		if (Number.isNaN(size)) break;

		// File content starts after the 512-byte header
		const contentStart = offset + 512;
		const content = data.slice(contentStart, contentStart + size);

		// Only add regular files (not directories)
		if (size > 0) {
			entries.push({ name, content });
		}

		// Move to next entry (header + content padded to 512 bytes)
		offset = contentStart + Math.ceil(size / 512) * 512;
	}

	return entries;
};

/**
 * Fetch a Matrix Market dataset from SuiteSparse URL.
 *
 * Expects a .tar.gz archive containing a .mtx file and optional _nodename.txt.
 *
 * @param url - URL to .tar.gz archive
 * @param options - Conversion options
 * @returns Converted graph and fetch metadata
 */
export const fetchMtxDataset = async (
	url: string,
	options: FetchMtxOptions,
): Promise<FetchMtxResult> => {
	const fetchFunction = options.fetch ?? globalThis.fetch;

	const response = await fetchFunction(url);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch ${url}: ${response.status} ${response.statusText}`,
		);
	}

	const arrayBuffer = await response.arrayBuffer();
	const archiveSize = arrayBuffer.byteLength;

	// Decompress .tar.gz → tar → extract files
	const compressed = new Uint8Array(arrayBuffer);
	const tarData = gunzipSync(compressed);
	const tarEntries = extractTar(tarData);

	const decoder = new TextDecoder("utf-8");

	// Find the .mtx file
	const mtxEntry = tarEntries.find((entry) =>
		entry.name.toLowerCase().endsWith(".mtx"),
	);
	if (!mtxEntry) {
		throw new Error(`No .mtx file found in archive from ${url}`);
	}

	const mtxContent = decoder.decode(mtxEntry.content);
	const document = parseMtx(mtxContent);

	// Look for node labels file
	const nodeNameEntry = tarEntries.find((entry) =>
		entry.name.toLowerCase().endsWith("_nodename.txt"),
	);
	let nodeLabels: string[] | undefined;
	if (nodeNameEntry) {
		const labelContent = decoder.decode(nodeNameEntry.content);
		nodeLabels = labelContent
			.split(/\r?\n/)
			.filter((line) => line.trim() !== "");
	}

	const graph = mtxToJson(document, {
		meta: options.meta,
		directed: options.directed,
		nodeLabels,
	});

	return {
		graph,
		filename: mtxEntry.name,
		archiveSize,
	};
};
