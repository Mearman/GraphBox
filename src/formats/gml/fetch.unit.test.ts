import { afterEach,beforeEach, describe, expect, it, vi } from "vitest";

import type { FetchDatasetOptions, FetchDatasetResult } from "./fetch";
import { fetchDataset, fetchDatasets } from "./fetch";

// Mock the fflate module
vi.mock("fflate", () => ({
	unzipSync: vi.fn(),
}));

// Mock the parse module
vi.mock("./parse", () => ({
	parseGml: vi.fn(),
	gmlToJson: vi.fn(),
}));

import { unzipSync } from "fflate";

import { gmlToJson,parseGml } from "./parse";

describe("fetchDataset", () => {
	const mockUnzipSync = vi.mocked(unzipSync);
	const mockParseGml = vi.mocked(parseGml);
	const mockGmlToJson = vi.mocked(gmlToJson);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	const createMockFetch = (
		status: number,
		arrayBuffer: ArrayBuffer,
		statusText = "OK"
	): typeof globalThis.fetch => {
		return vi.fn().mockResolvedValue({
			ok: status >= 200 && status < 300,
			status,
			statusText,
			arrayBuffer: vi.fn().mockResolvedValue(arrayBuffer),
		});
	};

	const createMockOptions = (
		mockFetch: typeof globalThis.fetch
	): FetchDatasetOptions => ({
		fetch: mockFetch,
		meta: {
			name: "Test Graph",
			description: "A test graph",
			source: "https://example.com",
			url: "https://example.com/test.zip",
			citation: {
				authors: ["Test Author"],
				title: "Test Title",
				year: 2024,
			},
			retrieved: "2024-01-17",
		},
	});

	it("should fetch and parse a GML file from a zip archive", async () => {
		const mockArrayBuffer = new ArrayBuffer(100);
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options = createMockOptions(mockFetch);

		const gmlContent = "graph [ node [ id 1 ] ]";
		const encoder = new TextEncoder();
		const gmlData = encoder.encode(gmlContent);

		mockUnzipSync.mockReturnValue({
			"test.gml": gmlData,
		});

		mockParseGml.mockReturnValue({ graph: {}, nodes: [], edges: [] });
		mockGmlToJson.mockReturnValue({
			meta: { ...options.meta, directed: false },
			nodes: [{ id: "1" }],
			edges: [],
		});

		const result = await fetchDataset("https://example.com/test.zip", options);

		expect(mockFetch).toHaveBeenCalledWith("https://example.com/test.zip");
		expect(mockUnzipSync).toHaveBeenCalled();
		expect(mockParseGml).toHaveBeenCalledWith(gmlContent);
		expect(mockGmlToJson).toHaveBeenCalled();
		expect(result.filename).toBe("test.gml");
		expect(result.archiveSize).toBe(100);
		expect(result.contentSize).toBe(gmlData.byteLength);
		expect(result.graph.nodes).toHaveLength(1);
	});

	it("should throw error when fetch fails", async () => {
		const mockArrayBuffer = new ArrayBuffer(0);
		const mockFetch = createMockFetch(404, mockArrayBuffer, "Not Found");
		const options = createMockOptions(mockFetch);

		await expect(
			fetchDataset("https://example.com/missing.zip", options)
		).rejects.toThrow("Failed to fetch https://example.com/missing.zip: 404 Not Found");
	});

	it("should throw error when no GML file found in archive", async () => {
		const mockArrayBuffer = new ArrayBuffer(100);
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options = createMockOptions(mockFetch);

		mockUnzipSync.mockReturnValue({
			"readme.txt": new Uint8Array([]),
		});

		await expect(
			fetchDataset("https://example.com/test.zip", options)
		).rejects.toThrow("No .gml file found in archive");
	});

	it("should use custom extension when provided", async () => {
		const mockArrayBuffer = new ArrayBuffer(100);
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options: FetchDatasetOptions = {
			...createMockOptions(mockFetch),
			extension: ".graph",
		};

		const graphContent = "graph data";
		const encoder = new TextEncoder();
		const graphData = encoder.encode(graphContent);

		mockUnzipSync.mockReturnValue({
			"test.graph": graphData,
		});

		mockParseGml.mockReturnValue({ graph: {}, nodes: [], edges: [] });
		mockGmlToJson.mockReturnValue({
			meta: { ...options.meta, directed: false },
			nodes: [],
			edges: [],
		});

		const result = await fetchDataset("https://example.com/test.zip", options);

		expect(result.filename).toBe("test.graph");
	});

	it("should use first GML file when multiple are present", async () => {
		const mockArrayBuffer = new ArrayBuffer(100);
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options = createMockOptions(mockFetch);

		const encoder = new TextEncoder();
		const gmlData = encoder.encode("graph []");

		mockUnzipSync.mockReturnValue({
			"first.gml": gmlData,
			"second.gml": gmlData,
		});

		mockParseGml.mockReturnValue({ graph: {}, nodes: [], edges: [] });
		mockGmlToJson.mockReturnValue({
			meta: { ...options.meta, directed: false },
			nodes: [],
			edges: [],
		});

		const result = await fetchDataset("https://example.com/test.zip", options);

		expect(result.filename).toBe("first.gml");
	});

	it("should use globalThis.fetch when no custom fetch provided", async () => {
		const originalFetch = globalThis.fetch;
		const mockArrayBuffer = new ArrayBuffer(50);
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			statusText: "OK",
			arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
		});
		globalThis.fetch = mockFetch;

		const encoder = new TextEncoder();
		const gmlData = encoder.encode("graph []");

		mockUnzipSync.mockReturnValue({
			"test.gml": gmlData,
		});

		mockParseGml.mockReturnValue({ graph: {}, nodes: [], edges: [] });
		mockGmlToJson.mockReturnValue({
			meta: {
				name: "Test",
				description: "Test",
				source: "",
				url: "",
				citation: { authors: [], title: "", year: 2024 },
				retrieved: "",
				directed: false,
			},
			nodes: [],
			edges: [],
		});

		const options: FetchDatasetOptions = {
			meta: {
				name: "Test",
				description: "Test",
				source: "",
				url: "",
				citation: { authors: [], title: "", year: 2024 },
				retrieved: "",
			},
		};

		await fetchDataset("https://example.com/test.zip", options);

		expect(mockFetch).toHaveBeenCalledWith("https://example.com/test.zip");

		globalThis.fetch = originalFetch;
	});

	it("should handle case-insensitive extension matching", async () => {
		const mockArrayBuffer = new ArrayBuffer(100);
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options = createMockOptions(mockFetch);

		const encoder = new TextEncoder();
		const gmlData = encoder.encode("graph []");

		mockUnzipSync.mockReturnValue({
			"TEST.GML": gmlData,
		});

		mockParseGml.mockReturnValue({ graph: {}, nodes: [], edges: [] });
		mockGmlToJson.mockReturnValue({
			meta: { ...options.meta, directed: false },
			nodes: [],
			edges: [],
		});

		const result = await fetchDataset("https://example.com/test.zip", options);

		expect(result.filename).toBe("TEST.GML");
	});
});

describe("fetchDatasets", () => {
	const mockUnzipSync = vi.mocked(unzipSync);
	const mockParseGml = vi.mocked(parseGml);
	const mockGmlToJson = vi.mocked(gmlToJson);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should fetch multiple datasets in parallel", async () => {
		const encoder = new TextEncoder();
		const gmlData = encoder.encode("graph []");

		const createMockFetch = (_nodeCount: number): typeof globalThis.fetch => {
			return vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				statusText: "OK",
				arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
			});
		};

		mockUnzipSync.mockReturnValue({
			"test.gml": gmlData,
		});

		mockParseGml.mockReturnValue({ graph: {}, nodes: [], edges: [] });

		const mockMeta = {
			name: "Test",
			description: "Test",
			source: "",
			url: "",
			citation: { authors: [], title: "", year: 2024 },
			retrieved: "",
			directed: false,
		};

		mockGmlToJson
			.mockReturnValueOnce({ meta: mockMeta, nodes: [{ id: "1" }], edges: [] })
			.mockReturnValueOnce({ meta: mockMeta, nodes: [{ id: "2" }, { id: "3" }], edges: [] });

		const datasets: Array<[string, FetchDatasetOptions]> = [
			["https://example.com/graph1.zip", { fetch: createMockFetch(1), meta: mockMeta }],
			["https://example.com/graph2.zip", { fetch: createMockFetch(2), meta: mockMeta }],
		];

		const results = await fetchDatasets(datasets);

		expect(results).toHaveLength(2);
		expect(results[0].graph.nodes).toHaveLength(1);
		expect(results[1].graph.nodes).toHaveLength(2);
	});

	it("should return empty array for empty input", async () => {
		const results = await fetchDatasets([]);
		expect(results).toEqual([]);
	});
});

describe("FetchDatasetOptions interface", () => {
	it("should accept valid options", () => {
		const options: FetchDatasetOptions = {
			meta: {
				name: "Test",
				description: "A test graph",
				source: "https://example.com",
				url: "https://example.com/test.zip",
				citation: {
					authors: ["Author"],
					title: "Title",
					year: 2024,
				},
				retrieved: "2024-01-17",
			},
			fetch: vi.fn(),
			extension: ".gml",
		};

		expect(options.meta.name).toBe("Test");
		expect(options.extension).toBe(".gml");
	});
});

describe("FetchDatasetResult interface", () => {
	it("should have correct structure", () => {
		const result: FetchDatasetResult = {
			graph: {
				meta: {
					name: "Test",
					description: "Test",
					source: "",
					url: "",
					citation: { authors: [], title: "", year: 2024 },
					retrieved: "",
					directed: false,
				},
				nodes: [],
				edges: [],
			},
			filename: "test.gml",
			archiveSize: 1024,
			contentSize: 512,
		};

		expect(result.filename).toBe("test.gml");
		expect(result.archiveSize).toBe(1024);
		expect(result.contentSize).toBe(512);
	});
});
