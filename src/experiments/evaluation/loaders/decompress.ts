/**
 * Universal decompression utilities for browser and Node.js environments.
 *
 * Supports gzip decompression using:
 * - Node.js: Built-in `zlib` module (works in all Node versions)
 * - Browser: Native `DecompressionStream` API (Chrome 80+, Firefox 113+, Safari 16.4+)
 *
 * No external dependencies required.
 */

/**
 * Check if running in Node.js environment.
 */
const isNode = (): boolean =>
	typeof process !== "undefined" &&
	process.versions?.node != undefined;

/**
 * Check if DecompressionStream is available (modern browsers and Node 18+).
 */
const hasDecompressionStream = (): boolean =>
	typeof DecompressionStream !== "undefined";

/**
 * Decompress gzip data using Node.js zlib module.
 *
 * @param data - Compressed data as Uint8Array
 * @returns Decompressed string
 */
const decompressWithZlib = async (data: Uint8Array): Promise<string> => {
	// Dynamic import to avoid bundling issues in browser builds
	const { gunzip } = await import("node:zlib");
	const { promisify } = await import("node:util");

	const gunzipAsync = promisify(gunzip);
	const decompressed = await gunzipAsync(Buffer.from(data));
	return decompressed.toString("utf-8");
};

/**
 * Decompress gzip data using browser DecompressionStream API.
 *
 * @param data - Compressed data as Uint8Array
 * @returns Decompressed string
 */
const decompressWithStream = async (data: Uint8Array): Promise<string> => {
	// Create a new ArrayBuffer copy to ensure compatibility
	const buffer = new ArrayBuffer(data.byteLength);
	new Uint8Array(buffer).set(data);
	const blob = new Blob([buffer]);
	const stream = blob.stream();
	const decompressedStream = stream.pipeThrough(new DecompressionStream("gzip"));
	const response = new Response(decompressedStream);
	return response.text();
};

/**
 * Decompress gzip-compressed data to a string.
 *
 * Automatically uses the best available method for the current environment:
 * - Node.js: Uses built-in zlib module
 * - Browser: Uses native DecompressionStream API
 *
 * @param data - Gzip-compressed data as Uint8Array
 * @returns Promise resolving to decompressed UTF-8 string
 * @throws Error if decompression fails or no decompression method is available
 *
 * @example
 * ```typescript
 * const response = await fetch('https://example.com/data.gz');
 * const compressed = new Uint8Array(await response.arrayBuffer());
 * const text = await decompressGzip(compressed);
 * ```
 */
export const decompressGzip = async (data: Uint8Array): Promise<string> => {
	if (isNode()) {
		return decompressWithZlib(data);
	}

	if (hasDecompressionStream()) {
		return decompressWithStream(data);
	}

	throw new Error(
		"No decompression method available. " +
			"Browser requires DecompressionStream API (Chrome 80+, Firefox 113+, Safari 16.4+). " +
			"Consider using a polyfill like 'pako' for older browsers."
	);
};

/**
 * Fetch and decompress gzip content from a URL.
 *
 * @param url - URL to fetch gzip-compressed content from
 * @returns Promise resolving to decompressed UTF-8 string
 * @throws Error if fetch fails or decompression fails
 *
 * @example
 * ```typescript
 * const text = await fetchAndDecompressGzip('https://snap.stanford.edu/data/facebook_combined.txt.gz');
 * ```
 */
export const fetchAndDecompressGzip = async (url: string): Promise<string> => {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	}

	const arrayBuffer = await response.arrayBuffer();
	const data = new Uint8Array(arrayBuffer);

	return decompressGzip(data);
};

/**
 * Detect if a URL points to a gzip-compressed file based on extension.
 *
 * @param url - URL to check
 * @returns True if URL ends with .gz or .gzip
 */
export const isGzipUrl = (url: string): boolean => {
	const lowered = url.toLowerCase();
	return lowered.endsWith(".gz") || lowered.endsWith(".gzip");
};

/**
 * Fetch content from URL, automatically decompressing if gzip.
 *
 * Detects compression based on:
 * 1. URL extension (.gz, .gzip)
 * 2. Content-Encoding header
 *
 * @param url - URL to fetch content from
 * @returns Promise resolving to text content (decompressed if needed)
 *
 * @example
 * ```typescript
 * // Automatically handles both compressed and uncompressed URLs
 * const text1 = await fetchWithAutoDecompress('https://example.com/data.txt');
 * const text2 = await fetchWithAutoDecompress('https://example.com/data.txt.gz');
 * ```
 */
export const fetchWithAutoDecompress = async (url: string): Promise<string> => {
	// If URL indicates gzip, fetch as binary and decompress
	if (isGzipUrl(url)) {
		return fetchAndDecompressGzip(url);
	}

	// Otherwise, fetch as text (browser/fetch handles Content-Encoding automatically)
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	}

	return response.text();
};
