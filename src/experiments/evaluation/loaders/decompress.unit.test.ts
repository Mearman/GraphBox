/**
 * Unit tests for decompression utilities
 */

import { gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import {
	clearCache,
	decompressGzip,
	fetchWithAutoDecompress,
	getCacheStats,
	isGzipUrl,
	isTarUrl,
	isTgzUrl,
	isZipUrl,
} from "./decompress";

describe("Decompression Utilities", () => {
	describe("isGzipUrl", () => {
		it("should detect .gz extension", () => {
			expect(isGzipUrl("https://example.com/data.txt.gz")).toBe(true);
			expect(isGzipUrl("https://example.com/data.gz")).toBe(true);
			expect(isGzipUrl("/path/to/file.gz")).toBe(true);
		});

		it("should detect .gzip extension", () => {
			expect(isGzipUrl("https://example.com/data.gzip")).toBe(true);
			expect(isGzipUrl("/path/to/file.gzip")).toBe(true);
		});

		it("should be case insensitive", () => {
			expect(isGzipUrl("https://example.com/data.GZ")).toBe(true);
			expect(isGzipUrl("https://example.com/data.GZIP")).toBe(true);
			expect(isGzipUrl("https://example.com/data.Gz")).toBe(true);
		});

		it("should return false for non-gzip URLs", () => {
			expect(isGzipUrl("https://example.com/data.txt")).toBe(false);
			expect(isGzipUrl("https://example.com/data.zip")).toBe(false);
			expect(isGzipUrl("https://example.com/data.tar")).toBe(false);
			expect(isGzipUrl("https://example.com/data")).toBe(false);
		});
	});

	describe("decompressGzip", () => {
		it("should decompress gzip data", async () => {
			const originalText = "Hello, World! This is a test.";
			const compressed = gzipSync(Buffer.from(originalText));
			const data = new Uint8Array(compressed);

			const result = await decompressGzip(data);

			expect(result).toBe(originalText);
		});

		it("should handle multi-line content", async () => {
			const originalText = "line1\nline2\nline3";
			const compressed = gzipSync(Buffer.from(originalText));
			const data = new Uint8Array(compressed);

			const result = await decompressGzip(data);

			expect(result).toBe(originalText);
		});

		it("should handle edge list format", async () => {
			const edgeList = "1 2\n2 3\n3 4\n4 1";
			const compressed = gzipSync(Buffer.from(edgeList));
			const data = new Uint8Array(compressed);

			const result = await decompressGzip(data);

			expect(result).toBe(edgeList);
			expect(result.split("\n")).toHaveLength(4);
		});

		it("should handle unicode content", async () => {
			// Test with accented characters and CJK characters (no emoji per lint rules)
			const unicodeText = "Hello World! \u65E5\u672C\u8A9E";
			const compressed = gzipSync(Buffer.from(unicodeText));
			const data = new Uint8Array(compressed);

			const result = await decompressGzip(data);

			expect(result).toBe(unicodeText);
		});

		it("should handle empty content", async () => {
			const emptyText = "";
			const compressed = gzipSync(Buffer.from(emptyText));
			const data = new Uint8Array(compressed);

			const result = await decompressGzip(data);

			expect(result).toBe(emptyText);
		});

		it("should handle large content", async () => {
			// Create a moderately large edge list (10k edges)
			const lines: string[] = [];
			for (let index = 0; index < 10_000; index++) {
				lines.push(`${index} ${index + 1}`);
			}
			const largeText = lines.join("\n");
			const compressed = gzipSync(Buffer.from(largeText));
			const data = new Uint8Array(compressed);

			const result = await decompressGzip(data);

			expect(result).toBe(largeText);
			expect(result.split("\n")).toHaveLength(10_000);
		});
	});

	describe("fetchWithAutoDecompress", () => {
		it("should export the function", () => {
			expect(typeof fetchWithAutoDecompress).toBe("function");
		});

		// Network tests would require mocking fetch or using a test server
		// These are integration tests that verify the function exists and has the right signature
	});

	describe("isZipUrl", () => {
		it("should detect .zip extension", () => {
			expect(isZipUrl("https://example.com/data.zip")).toBe(true);
			expect(isZipUrl("/path/to/file.zip")).toBe(true);
			expect(isZipUrl("https://example.com/data.ZIP")).toBe(true);
		});

		it("should return false for non-zip URLs", () => {
			expect(isZipUrl("https://example.com/data.txt")).toBe(false);
			expect(isZipUrl("https://example.com/data.gz")).toBe(false);
			expect(isZipUrl("https://example.com/data.tar")).toBe(false);
		});
	});

	describe("isTarUrl", () => {
		it("should detect .tar extension", () => {
			expect(isTarUrl("https://example.com/data.tar")).toBe(true);
			expect(isTarUrl("/path/to/file.tar")).toBe(true);
			expect(isTarUrl("https://example.com/data.TAR")).toBe(true);
		});

		it("should return false for non-tar URLs", () => {
			expect(isTarUrl("https://example.com/data.txt")).toBe(false);
			expect(isTarUrl("https://example.com/data.gz")).toBe(false);
			expect(isTarUrl("https://example.com/data.zip")).toBe(false);
		});
	});

	describe("isTgzUrl", () => {
		it("should detect .tar.gz extension", () => {
			expect(isTgzUrl("https://example.com/data.tar.gz")).toBe(true);
			expect(isTgzUrl("/path/to/file.tar.gz")).toBe(true);
			expect(isTgzUrl("https://example.com/data.TAR.GZ")).toBe(true);
		});

		it("should detect .tgz extension", () => {
			expect(isTgzUrl("https://example.com/data.tgz")).toBe(true);
			expect(isTgzUrl("/path/to/file.tgz")).toBe(true);
			expect(isTgzUrl("https://example.com/data.TGZ")).toBe(true);
		});

		it("should return false for non-tgz URLs", () => {
			expect(isTgzUrl("https://example.com/data.txt")).toBe(false);
			expect(isTgzUrl("https://example.com/data.tar")).toBe(false);
			expect(isTgzUrl("https://example.com/data.gz")).toBe(false);
		});
	});
});

describe("Cache Management (Node.js only)", () => {
	it("should export clearCache function", () => {
		expect(typeof clearCache).toBe("function");
	});

	it("should export getCacheStats function", () => {
		expect(typeof getCacheStats).toBe("function");
	});

	it("should get cache stats (returns null in browser/mock environment)", async () => {
		const stats = await getCacheStats();
		// In a browser or test environment without Node.js, returns null
		// In Node.js with cache, returns { count, totalBytes }
		expect(stats === null || typeof stats === "object").toBe(true);
	});

	it("should clear cache without error", async () => {
		// Should not throw, even in browser environment
		await expect(clearCache()).resolves.not.toThrow();
	});
});
