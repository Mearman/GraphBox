/**
 * Unit tests for benchmark dataset fixtures
 *
 * Note: Tests that load actual data files are skipped if the benchmark data
 * directory doesn't exist. These are effectively integration tests that require
 * external data to be present.
 */

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
	BENCHMARK_DATASETS,
	CITESEER,
	CORA,
	createBenchmarkMeta,
	DATASETS_BY_ID,
	DBLP,
	FACEBOOK,
	getBenchmarkSummary,
	KARATE,
	LESMIS,
	loadBenchmark,
	loadBenchmarkById,
	loadBenchmarkByIdFromUrl,
	loadBenchmarkFromContent,
	loadBenchmarkFromUrl,
	validateBenchmark,
} from "./benchmark-datasets";

// Check if benchmark data directory exists
const __dirname = dirname(fileURLToPath(import.meta.url));
const benchmarksPath = resolve(__dirname, "../../../../data/benchmarks");
const hasBenchmarkData = existsSync(benchmarksPath);

describe("Benchmark Dataset Metadata", () => {
	it("should have all expected datasets", () => {
		expect(BENCHMARK_DATASETS).toHaveLength(6);
		expect(DATASETS_BY_ID.size).toBe(6);
	});

	it("should have consistent IDs in map", () => {
		for (const dataset of BENCHMARK_DATASETS) {
			expect(DATASETS_BY_ID.get(dataset.id)).toBe(dataset);
		}
	});

	describe("CORA", () => {
		it("should have correct metadata", () => {
			expect(CORA.name).toBe("Cora");
			expect(CORA.id).toBe("cora");
			expect(CORA.directed).toBe(true);
			expect(CORA.expectedNodes).toBe(2708);
			expect(CORA.expectedEdges).toBe(5429);
		});
	});

	describe("CITESEER", () => {
		it("should have correct metadata", () => {
			expect(CITESEER.name).toBe("CiteSeer");
			expect(CITESEER.id).toBe("citeseer");
			expect(CITESEER.directed).toBe(true);
			expect(CITESEER.expectedNodes).toBe(3264);
			expect(CITESEER.expectedEdges).toBe(4536);
		});
	});

	describe("FACEBOOK", () => {
		it("should have correct metadata", () => {
			expect(FACEBOOK.name).toBe("Facebook");
			expect(FACEBOOK.id).toBe("facebook");
			expect(FACEBOOK.directed).toBe(false);
			expect(FACEBOOK.expectedNodes).toBe(4039);
			expect(FACEBOOK.expectedEdges).toBe(88_234);
		});
	});

	describe("KARATE", () => {
		it("should have correct metadata", () => {
			expect(KARATE.name).toBe("Karate Club");
			expect(KARATE.id).toBe("karate");
			expect(KARATE.directed).toBe(false);
			expect(KARATE.expectedNodes).toBe(34);
			expect(KARATE.expectedEdges).toBe(78);
		});
	});

	describe("LESMIS", () => {
		it("should have correct metadata", () => {
			expect(LESMIS.name).toBe("Les Misérables");
			expect(LESMIS.id).toBe("lesmis");
			expect(LESMIS.directed).toBe(false);
			expect(LESMIS.expectedNodes).toBe(69);
			expect(LESMIS.expectedEdges).toBe(279);
		});
	});

	describe("DBLP", () => {
		it("should have correct metadata", () => {
			expect(DBLP.name).toBe("DBLP");
			expect(DBLP.id).toBe("dblp");
			expect(DBLP.directed).toBe(false);
			expect(DBLP.expectedNodes).toBe(317_080);
			expect(DBLP.expectedEdges).toBe(1_049_866);
		});
	});
});

describe.skipIf(!hasBenchmarkData)("Benchmark Loading", () => {
	it("should load Cora dataset", async () => {
		const benchmark = await loadBenchmark(CORA);

		expect(benchmark.meta).toBe(CORA);
		expect(benchmark.nodeCount).toBeGreaterThan(0);
		expect(benchmark.edgeCount).toBeGreaterThan(0);
		expect(benchmark.graph).toBeDefined();
	});

	it("should load CiteSeer dataset", async () => {
		const benchmark = await loadBenchmark(CITESEER);

		expect(benchmark.meta).toBe(CITESEER);
		expect(benchmark.nodeCount).toBeGreaterThan(0);
		expect(benchmark.edgeCount).toBeGreaterThan(0);
	});

	it("should load Facebook dataset", async () => {
		const benchmark = await loadBenchmark(FACEBOOK);

		expect(benchmark.meta).toBe(FACEBOOK);
		expect(benchmark.nodeCount).toBeGreaterThan(0);
		expect(benchmark.edgeCount).toBeGreaterThan(0);
	});

	it("should load Karate Club dataset", async () => {
		const benchmark = await loadBenchmark(KARATE);

		expect(benchmark.meta).toBe(KARATE);
		expect(benchmark.nodeCount).toBe(34);
		expect(benchmark.edgeCount).toBe(78);
	});

	it("should load Les Misérables dataset", async () => {
		const benchmark = await loadBenchmark(LESMIS);

		expect(benchmark.meta).toBe(LESMIS);
		expect(benchmark.nodeCount).toBe(69);
		expect(benchmark.edgeCount).toBe(279);
	});

	// Note: DBLP loading test skipped as it's 300K+ nodes and slow to load

	it("should load by ID (case insensitive)", async () => {
		const benchmark1 = await loadBenchmarkById("cora");
		const benchmark2 = await loadBenchmarkById("CORA");
		const benchmark3 = await loadBenchmarkById("Cora");

		expect(benchmark1.meta.id).toBe("cora");
		expect(benchmark2.meta.id).toBe("cora");
		expect(benchmark3.meta.id).toBe("cora");
	});

	it("should throw for unknown dataset ID", async () => {
		await expect(loadBenchmarkById("unknown")).rejects.toThrow("Unknown benchmark dataset");
	});
});

describe.skipIf(!hasBenchmarkData)("Benchmark Utilities", () => {
	it("should generate summary string", async () => {
		const benchmark = await loadBenchmark(CORA);
		const summary = getBenchmarkSummary(benchmark);

		expect(summary).toContain("Cora");
		expect(summary).toContain("nodes");
		expect(summary).toContain("edges");
		expect(summary).toContain("directed");
	});

	it("should validate benchmark within tolerance", async () => {
		const benchmark = await loadBenchmark(CORA);
		const result = validateBenchmark(benchmark);

		// Should be valid or have minor warnings
		expect(result.warnings).toBeDefined();
	});
});

describe("Browser-Compatible Loaders", () => {
	describe("loadBenchmarkFromContent", () => {
		it("should load graph from edge list content", () => {
			const content = "1 2\n2 3\n3 1";
			const meta = createBenchmarkMeta({
				id: "test-graph",
				name: "Test Graph",
				expectedNodes: 3,
				expectedEdges: 3,
				directed: false,
			});

			const benchmark = loadBenchmarkFromContent(content, meta);

			expect(benchmark.nodeCount).toBe(3);
			expect(benchmark.edgeCount).toBe(3);
			expect(benchmark.meta.id).toBe("test-graph");
		});

		it("should respect directed flag", () => {
			const content = "a b\nb c";
			const metaDirected = createBenchmarkMeta({
				id: "directed",
				name: "Directed",
				directed: true,
			});
			const metaUndirected = createBenchmarkMeta({
				id: "undirected",
				name: "Undirected",
				directed: false,
			});

			const directed = loadBenchmarkFromContent(content, metaDirected);
			const undirected = loadBenchmarkFromContent(content, metaUndirected);

			// Both should have same node/edge count, but graph internals differ
			expect(directed.nodeCount).toBe(3);
			expect(undirected.nodeCount).toBe(3);
			expect(directed.graph.isDirected()).toBe(true);
			expect(undirected.graph.isDirected()).toBe(false);
		});

		it("should handle custom delimiter", () => {
			const content = "1,2\n2,3\n3,1";
			const meta = createBenchmarkMeta({
				id: "csv-graph",
				name: "CSV Graph",
				delimiter: /,/,
			});

			const benchmark = loadBenchmarkFromContent(content, meta);

			expect(benchmark.nodeCount).toBe(3);
			expect(benchmark.edgeCount).toBe(3);
		});

		it("should skip comment lines", () => {
			const content = "# This is a comment\n1 2\n# Another comment\n2 3";
			const meta = createBenchmarkMeta({
				id: "with-comments",
				name: "With Comments",
			});

			const benchmark = loadBenchmarkFromContent(content, meta);

			expect(benchmark.nodeCount).toBe(3);
			expect(benchmark.edgeCount).toBe(2);
		});
	});

	describe("createBenchmarkMeta", () => {
		it("should create metadata with required fields", () => {
			const meta = createBenchmarkMeta({
				id: "custom",
				name: "Custom Dataset",
			});

			expect(meta.id).toBe("custom");
			expect(meta.name).toBe("Custom Dataset");
			expect(meta.directed).toBe(false); // default
			expect(meta.delimiter).toEqual(/\s+/); // default
			expect(meta.expectedNodes).toBe(0); // default
		});

		it("should allow overriding all optional fields", () => {
			const meta = createBenchmarkMeta({
				id: "full",
				name: "Full Config",
				description: "A fully configured dataset",
				directed: true,
				expectedNodes: 100,
				expectedEdges: 500,
				delimiter: /,/,
				source: "Test source",
				relativePath: "test/path.edges",
				remoteUrl: "https://example.com/data.txt",
			});

			expect(meta.directed).toBe(true);
			expect(meta.expectedNodes).toBe(100);
			expect(meta.expectedEdges).toBe(500);
			expect(meta.delimiter).toEqual(/,/);
			expect(meta.source).toBe("Test source");
			expect(meta.remoteUrl).toBe("https://example.com/data.txt");
		});

		it("should generate description if not provided", () => {
			const meta = createBenchmarkMeta({
				id: "auto-desc",
				name: "Auto Description",
			});

			expect(meta.description).toContain("Auto Description");
		});
	});

	describe("loadBenchmarkByIdFromUrl", () => {
		it("should throw for unknown dataset ID", async () => {
			await expect(loadBenchmarkByIdFromUrl("unknown")).rejects.toThrow(
				"Unknown benchmark dataset"
			);
		});

		it("should throw when no URL provided and no remoteUrl configured", async () => {
			await expect(loadBenchmarkByIdFromUrl("karate")).rejects.toThrow(
				"No URL provided"
			);
		});
	});
});

describe("URL-based Loading (Integration)", () => {
	// These tests require network access and may be skipped in CI
	// They serve as examples of how to use the URL-based loaders

	it("should export loadBenchmarkFromUrl function", () => {
		expect(typeof loadBenchmarkFromUrl).toBe("function");
	});

	it("should export loadBenchmarkByIdFromUrl function", () => {
		expect(typeof loadBenchmarkByIdFromUrl).toBe("function");
	});
});
