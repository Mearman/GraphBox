/**
 * Unit tests for benchmark dataset fixtures
 */

import { describe, expect, it } from "vitest";

import { clearCache, getCacheStats } from "../loaders/decompress";
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

describe("Benchmark Dataset Metadata", () => {
	it("should have all expected datasets", () => {
		expect(BENCHMARK_DATASETS).toHaveLength(11);
		expect(DATASETS_BY_ID.size).toBe(11);
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
			expect(CITESEER.expectedNodes).toBe(3327);  // LINQS remote dataset
			expect(CITESEER.expectedEdges).toBe(4732);  // LINQS remote dataset
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
			expect(LESMIS.expectedNodes).toBe(77);   // UMich remote GML
			expect(LESMIS.expectedEdges).toBe(254);  // UMich remote GML
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

describe("Benchmark Loading", () => {
	it("should load Karate Club dataset", async () => {
		const benchmark = await loadBenchmark(KARATE);

		expect(benchmark.meta).toBe(KARATE);
		expect(benchmark.nodeCount).toBeGreaterThan(0);
		expect(benchmark.edgeCount).toBeGreaterThan(0);
		expect(benchmark.graph).toBeDefined();
	});

	it("should load Les Misérables dataset", async () => {
		const benchmark = await loadBenchmark(LESMIS);

		expect(benchmark.meta).toBe(LESMIS);
		expect(benchmark.nodeCount).toBeGreaterThan(0);
		expect(benchmark.edgeCount).toBeGreaterThan(0);
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

describe("Benchmark Utilities", () => {
	it("should generate summary string", async () => {
		const benchmark = await loadBenchmark(KARATE);
		const summary = getBenchmarkSummary(benchmark);

		expect(summary).toContain("Karate Club");
		expect(summary).toContain("nodes");
		expect(summary).toContain("edges");
		expect(summary).toContain("undirected");
	});

	it("should validate Karate Club matches metadata", async () => {
		const benchmark = await loadBenchmark(KARATE);
		const result = validateBenchmark(benchmark);

		expect(result.valid).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});

	it("should validate Les Misérables matches metadata", async () => {
		const benchmark = await loadBenchmark(LESMIS);
		const result = validateBenchmark(benchmark);

		expect(result.valid).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});

	it("should validate Cora matches metadata", async () => {
		const benchmark = await loadBenchmark(CORA);
		const result = validateBenchmark(benchmark);

		expect(result.valid).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});

	it("should validate CiteSeer matches metadata", async () => {
		const benchmark = await loadBenchmark(CITESEER);
		const result = validateBenchmark(benchmark);

		expect(result.valid).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});

	it("should validate Facebook matches metadata", async () => {
		const benchmark = await loadBenchmark(FACEBOOK);
		const result = validateBenchmark(benchmark);

		expect(result.valid).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});

	// Note: DBLP is large (300K+ nodes, 14MB) - requires increased memory
	it("should validate DBLP matches metadata", async () => {
		const benchmark = await loadBenchmark(DBLP);
		const result = validateBenchmark(benchmark);

		expect(result.valid).toBe(true);
		expect(result.warnings).toHaveLength(0);
	}, 60_000); // 60s timeout for large dataset
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
	});
});

describe("URL-based Loading (Integration)", () => {
	// These tests require network access and verify caching works
	// Run with: pnpm test benchmark-datasets

	describe("Cache Management", () => {
		it("should export clearCache and getCacheStats", () => {
			expect(typeof clearCache).toBe("function");
			expect(typeof getCacheStats).toBe("function");
		});

		it("should get cache stats without error", async () => {
			const stats = await getCacheStats();
			expect(stats === null || typeof stats === "object").toBe(true);
			if (stats) {
				expect(typeof stats.count).toBe("number");
				expect(typeof stats.totalBytes).toBe("number");
			}
		});

		it("should clear cache without error", async () => {
			await expect(clearCache()).resolves.not.toThrow();
		});
	});

	describe("Remote URL Loading", () => {
		it("should export loadBenchmarkFromUrl function", () => {
			expect(typeof loadBenchmarkFromUrl).toBe("function");
		});

		it("should export loadBenchmarkByIdFromUrl function", () => {
			expect(typeof loadBenchmarkByIdFromUrl).toBe("function");
		});

		// Integration tests (require network access)
		// Note: Remote datasets may be in different formats than local edge lists
		// Karate/Les Mis from UMich are GML format, Cora/CiteSeer from LINQS are .tgz with specific structure
		// Facebook from SNAP is plain text edge list format and works with our loader

		it("should load Karate Club from remote URL with caching", async () => {
			// Karate dataset from UMich is in GML format
			// Note: Cache is NOT cleared here to allow persistent caching across test runs
			const benchmark1 = await loadBenchmarkByIdFromUrl("karate");
			expect(benchmark1.nodeCount).toBe(34);
			expect(benchmark1.edgeCount).toBe(78);

			// Check cache stats
			const stats = await getCacheStats();
			expect(stats).not.toBeNull();
			expect(stats!.count).toBeGreaterThan(0);
		});

		it("should load Les Misérables from remote URL", async () => {
			// Les Mis dataset from UMich is in GML format
			// Note: The UMich GML file has 77 nodes, 254 edges (different from local edge list)
			const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
			expect(benchmark.nodeCount).toBe(77);
			expect(benchmark.edgeCount).toBe(254);
		});

		it("should load Facebook dataset from remote URL with caching", async () => {
			// Facebook dataset from SNAP is plain text edge list format
			// Note: Cache is NOT cleared here to allow persistent caching across test runs
			const benchmark = await loadBenchmarkByIdFromUrl("facebook");
			expect(benchmark.nodeCount).toBe(4039);
			expect(benchmark.edgeCount).toBeGreaterThan(80_000);

			// Check cache stats
			const stats = await getCacheStats();
			expect(stats).not.toBeNull();
			expect(stats!.count).toBeGreaterThan(0);
		});

		it("should load Cora citation network from remote URL", async () => {
			// Cora from LINQS is .tgz with .cites/.content files
			const benchmark = await loadBenchmarkByIdFromUrl("cora");
			expect(benchmark.nodeCount).toBe(2708);
			expect(benchmark.edgeCount).toBe(5429);
		});

		it("should load CiteSeer citation network from remote URL", async () => {
			// CiteSeer from LINQS is .tgz with .cites/.content files
			// Note: LINQS version has 3327 nodes, 4732 edges (differs from local processed version)
			const benchmark = await loadBenchmarkByIdFromUrl("citeseer");
			expect(benchmark.nodeCount).toBe(3327);
			expect(benchmark.edgeCount).toBe(4732);
		});
	});
});
