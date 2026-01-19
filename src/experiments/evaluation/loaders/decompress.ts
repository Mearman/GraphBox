/**
 * Universal decompression utilities for browser and Node.js environments.
 *
 * Supports multiple compression formats using fflate:
 * - gzip (.gz, .gzip)
 * - ZIP (.zip)
 * - TAR (.tar)
 * - Compressed TAR (.tar.gz, .tgz)
 *
 * Uses fflate for universal decompression across all environments.
 */

import { strFromU8, unzipSync, unzlibSync } from "fflate";

/**
 * Detect if a URL points to a gzip-compressed file based on extension.
 *
 * @param url - URL to check
 * @returns True if URL ends with .gz or .gzip (but not .tar.gz or .tgz)
 */
export const isGzipUrl = (url: string): boolean => {
	const lowered = url.toLowerCase();
	return (lowered.endsWith(".gz") || lowered.endsWith(".gzip")) && !lowered.endsWith(".tar.gz") && !lowered.endsWith(".tgz");
};

/**
 * Detect if a URL points to a ZIP file based on extension.
 *
 * @param url - URL to check
 * @returns True if URL ends with .zip
 */
export const isZipUrl = (url: string): boolean => {
	return url.toLowerCase().endsWith(".zip");
};

/**
 * Detect if a URL points to a TAR file based on extension.
 *
 * @param url - URL to check
 * @returns True if URL ends with .tar
 */
export const isTarUrl = (url: string): boolean => {
	return url.toLowerCase().endsWith(".tar");
};

/**
 * Detect if a URL points to a gzipped TAR file based on extension.
 *
 * @param url - URL to check
 * @returns True if URL ends with .tar.gz or .tgz
 */
export const isTgzUrl = (url: string): boolean => {
	const lowered = url.toLowerCase();
	return lowered.endsWith(".tar.gz") || lowered.endsWith(".tgz");
};

/**
 * Decompress gzip-compressed data to a string using fflate.
 *
 * @param data - Gzip-compressed data as Uint8Array
 * @returns Promise resolving to decompressed UTF-8 string
 */
export const decompressGzip = async (data: Uint8Array): Promise<string> => {
	try {
		const decompressed = unzlibSync(data);
		return strFromU8(decompressed);
	} catch (error) {
		throw new Error(`Failed to decompress gzip data: ${error}`);
	}
};

/**
 * Decompress ZIP data and extract all files.
 *
 * Returns a map of filename to content string.
 *
 * @param data - ZIP-compressed data as Uint8Array
 * @returns Promise resolving to map of filename to content
 */
export const decompressZip = async (data: Uint8Array): Promise<Map<string, string>> => {
	try {
		const zip = unzipSync(data);
		const result = new Map<string, string>();

		for (const [filename, fileData] of Object.entries(zip)) {
			// Skip directories (files without content)
			if (fileData.length === 0) continue;
			result.set(filename, strFromU8(fileData));
		}

		return result;
	} catch (error) {
		throw new Error(`Failed to decompress ZIP data: ${error}`);
	}
};

/**
 * Decompress TAR data and extract all files.
 *
 * Parses TAR format (ustar with null-terminated headers).
 *
 * @param data - TAR file data as Uint8Array
 * @returns Promise resolving to map of filename to content
 */
export const decompressTar = async (data: Uint8Array): Promise<Map<string, string>> => {
	try {
		const result = new Map<string, string>();
		let offset = 0;

		while (offset < data.length - 512) {
			// Read TAR header (512 bytes)
			const name = readNullTerminatedString(data, offset, 100);
			const sizeString = readNullTerminatedString(data, offset + 124, 12);
			const size = Number.parseInt(sizeString.trim(), 8);

			// Empty header name and size indicates end of archive
			if (name.length === 0 && size === 0) break;

			// Check for typeflag (regular file = '0' or null)
			const typeflag = data[offset + 156];
			if (typeflag === 0 || typeflag === 48) {
				// Skip header and read file content
				const contentOffset = offset + 512;
				const content = data.slice(contentOffset, contentOffset + size);
				result.set(name, strFromU8(content));
			}

			// Move to next record (header + content, rounded up to 512-byte boundary)
			offset += 512 + Math.ceil(size / 512) * 512;
		}

		return result;
	} catch (error) {
		throw new Error(`Failed to decompress TAR data: ${error}`);
	}
};

/**
 * Read null-terminated string from Uint8Array.
 * @param data
 * @param offset
 * @param maxLength
 */
const readNullTerminatedString = (data: Uint8Array, offset: number, maxLength: number): string => {
	let end = offset;
	while (end < offset + maxLength && data[end] !== 0) {
		end++;
	}
	const bytes = data.slice(offset, end);
	return strFromU8(bytes);
};

/**
 * Decompress gzipped TAR data and extract all files.
 *
 * @param data - Gzipped TAR file data as Uint8Array
 * @returns Promise resolving to map of filename to content
 */
export const decompressTgz = async (data: Uint8Array): Promise<Map<string, string>> => {
	try {
		// First decompress the gzip layer
		const decompressed = unzlibSync(data);
		// Then extract the TAR
		return decompressTar(decompressed);
	} catch (error) {
		throw new Error(`Failed to decompress TAR.GZ data: ${error}`);
	}
};

/**
 * Fetch and decompress gzip content from a URL.
 *
 * @param url - URL to fetch gzip-compressed content from
 * @returns Promise resolving to decompressed UTF-8 string
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
 * Fetch and decompress ZIP content from a URL.
 *
 * Returns a map of all files in the ZIP archive.
 *
 * @param url - URL to fetch ZIP file from
 * @returns Promise resolving to map of filename to content
 */
export const fetchAndDecompressZip = async (url: string): Promise<Map<string, string>> => {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	}

	const arrayBuffer = await response.arrayBuffer();
	const data = new Uint8Array(arrayBuffer);

	return decompressZip(data);
};

/**
 * Fetch and decompress TAR content from a URL.
 *
 * Returns a map of all files in the TAR archive.
 *
 * @param url - URL to fetch TAR file from
 * @returns Promise resolving to map of filename to content
 */
export const fetchAndDecompressTar = async (url: string): Promise<Map<string, string>> => {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	}

	const arrayBuffer = await response.arrayBuffer();
	const data = new Uint8Array(arrayBuffer);

	return decompressTar(data);
};

/**
 * Fetch and decompress gzipped TAR content from a URL.
 *
 * Returns a map of all files in the archive.
 *
 * @param url - URL to fetch TAR.GZ or .tgz file from
 * @returns Promise resolving to map of filename to content
 */
export const fetchAndDecompressTgz = async (url: string): Promise<Map<string, string>> => {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	}

	const arrayBuffer = await response.arrayBuffer();
	const data = new Uint8Array(arrayBuffer);

	return decompressTgz(data);
};

/**
 * Detect archive format from URL and fetch with auto-decompression.
 *
 * Supports:
 * - Plain text (no extension)
 * - Gzip (.gz, .gzip)
 * - ZIP (.zip)
 * - TAR (.tar)
 * - Gzipped TAR (.tar.gz, .tgz)
 *
 * For archives (ZIP, TAR, TGZ), returns a map of filename to content.
 * For single files, returns the content as a string.
 *
 * @param url - URL to fetch content from
 * @returns Promise resolving to either string (single file) or Map (archive)
 * @throws Error if fetch fails or decompression fails
 *
 * @example
 * ```typescript
 * // Plain text file
 * const text1 = await fetchWithAutoDecompress('https://example.com/data.txt');
 * // typeof text1 === "string"
 *
 * // Gzipped file
 * const text2 = await fetchWithAutoDecompress('https://example.com/data.txt.gz');
 * // typeof text2 === "string"
 *
 * // ZIP archive
 * const files = await fetchWithAutoDecompress('https://example.com/data.zip');
 * // files instanceof Map<string, string>
 * ```
 */
export const fetchWithAutoDecompress = async (
	url: string
): Promise<string | Map<string, string>> => {
	// Detect format based on URL extension
	if (isTgzUrl(url)) {
		return fetchAndDecompressTgz(url);
	}

	if (isZipUrl(url)) {
		return fetchAndDecompressZip(url);
	}

	if (isTarUrl(url)) {
		return fetchAndDecompressTar(url);
	}

	if (isGzipUrl(url)) {
		return fetchAndDecompressGzip(url);
	}

	// Plain text file
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	}

	return response.text();
};

/**
 * Fetch content from URL with automatic format detection for archives.
 *
 * For archives, extracts and returns the first file with a matching extension.
 * For single files, returns the content directly.
 *
 * @param url - URL to fetch content from
 * @param preferredExtensions - Array of preferred file extensions to extract from archives (e.g., ['.edges', '.txt'])
 * @returns Promise resolving to content string
 *
 * @example
 * ```typescript
 * // Extract first .edges file from ZIP
 * const edges = await fetchAndExtract('https://example.com/data.zip', ['.edges']);
 *
 * // Or just get the content from a plain file
 * const text = await fetchAndExtract('https://example.com/data.txt');
 * ```
 */
export const fetchAndExtract = async (
	url: string,
	preferredExtensions: string[] = [".edges", ".txt", ".cites", ".content"]
): Promise<string> => {
	const result = await fetchWithAutoDecompress(url);

	// If it's already a string, return it
	if (typeof result === "string") {
		return result;
	}

	// It's a Map (archive), find the preferred file
	if (result instanceof Map) {
		// Try to find a file with preferred extension
		for (const extension of preferredExtensions) {
			for (const [filename, content] of result.entries()) {
				if (filename.toLowerCase().endsWith(extension)) {
					return content;
				}
			}
		}

		// No preferred file found, return the first file's content
		const firstFile = result.values().next().value;
		if (firstFile) {
			return firstFile;
		}

		throw new Error(`Archive contains no extractable files: ${url}`);
	}

	throw new Error(`Unexpected result type from fetchWithAutoDecompress: ${url}`);
};
