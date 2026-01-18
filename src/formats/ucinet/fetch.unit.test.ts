import { afterEach,beforeEach, describe, expect, it, vi } from "vitest";

import type { FetchDlOptions, FetchDlResult } from "./fetch";
import { fetchDlDataset } from "./fetch";

// Mock the fflate module
vi.mock("fflate", () => ({
	unzipSync: vi.fn(),
	gunzipSync: vi.fn(),
}));

// Mock the parse module
vi.mock("./parse", () => ({
	parseDl: vi.fn(),
	dlToJson: vi.fn(),
}));

import { gunzipSync,unzipSync } from "fflate";

import { dlToJson,parseDl } from "./parse";

describe("fetchDlDataset", () => {
	const mockUnzipSync = vi.mocked(unzipSync);
	const mockGunzipSync = vi.mocked(gunzipSync);
	const mockParseDl = vi.mocked(parseDl);
	const mockDlToJson = vi.mocked(dlToJson);

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
	): FetchDlOptions => ({
		fetch: mockFetch,
		meta: {
			name: "Test UCINet Dataset",
			description: "A test UCINet network",
			source: "https://sites.google.com/site/uaborea/datasets",
			url: "http://example.com/test.dl",
			citation: {
				authors: ["Steve Borgatti", "Martin Everett", "Lin Freeman"],
				title: "UCINET for Windows: Software for Social Network Analysis",
				year: 2002,
			},
			retrieved: "2024-01-17",
		},
	});

	it("should fetch and parse a plain .dl file", async () => {
		const dlContent = "DL N=3\nDATA:\n0 1 1\n1 0 1\n1 1 0";
		const encoder = new TextEncoder();
		const mockArrayBuffer = encoder.encode(dlContent).buffer;
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options = createMockOptions(mockFetch);

		mockParseDl.mockReturnValue({ n: 3, edges: [], format: "fullmatrix" });
		mockDlToJson.mockReturnValue({
			meta: { ...options.meta, directed: false },
			nodes: [{ id: "1" }, { id: "2" }, { id: "3" }],
			edges: [
				{ source: "1", target: "2" },
				{ source: "1", target: "3" },
				{ source: "2", target: "3" },
			],
		});

		const result = await fetchDlDataset("http://example.com/network.dl", options);

		expect(mockFetch).toHaveBeenCalledWith("http://example.com/network.dl");
		expect(mockParseDl).toHaveBeenCalled();
		expect(mockDlToJson).toHaveBeenCalled();
		expect(result.filename).toBe("network.dl");
		expect(result.archiveSize).toBe(mockArrayBuffer.byteLength);
		expect(result.contentSize).toBe(mockArrayBuffer.byteLength);
		expect(result.graph.nodes).toHaveLength(3);
		expect(result.graph.edges).toHaveLength(3);
	});

	it("should fetch and decompress a .gz file", async () => {
		const mockArrayBuffer = new ArrayBuffer(100);
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options = createMockOptions(mockFetch);

		const dlContent = "DL N=2\nDATA:\n0 1\n1 0";
		const encoder = new TextEncoder();
		const decompressedData = encoder.encode(dlContent);

		mockGunzipSync.mockReturnValue(decompressedData);
		mockParseDl.mockReturnValue({ n: 2, edges: [], format: "fullmatrix" });
		mockDlToJson.mockReturnValue({
			meta: { ...options.meta, directed: false },
			nodes: [{ id: "1" }, { id: "2" }],
			edges: [{ source: "1", target: "2" }],
		});

		const result = await fetchDlDataset("http://example.com/network.dl.gz", options);

		expect(mockGunzipSync).toHaveBeenCalled();
		expect(result.filename).toBe("network.dl");
		expect(result.archiveSize).toBe(100);
		expect(result.contentSize).toBe(decompressedData.byteLength);
	});

	it("should fetch and extract from a .zip archive", async () => {
		const mockArrayBuffer = new ArrayBuffer(200);
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options = createMockOptions(mockFetch);

		const dlContent = "DL N=1\nDATA:\n0";
		const encoder = new TextEncoder();
		const dlData = encoder.encode(dlContent);

		mockUnzipSync.mockReturnValue({
			"data/network.dl": dlData,
		});

		mockParseDl.mockReturnValue({ n: 1, edges: [], format: "fullmatrix" });
		mockDlToJson.mockReturnValue({
			meta: { ...options.meta, directed: false },
			nodes: [{ id: "1" }],
			edges: [],
		});

		const result = await fetchDlDataset("http://example.com/archive.zip", options);

		expect(mockUnzipSync).toHaveBeenCalled();
		expect(result.filename).toBe("data/network.dl");
		expect(result.archiveSize).toBe(200);
		expect(result.contentSize).toBe(dlData.byteLength);
	});

	it("should throw error when fetch fails", async () => {
		const mockArrayBuffer = new ArrayBuffer(0);
		const mockFetch = createMockFetch(404, mockArrayBuffer, "Not Found");
		const options = createMockOptions(mockFetch);

		await expect(
			fetchDlDataset("http://example.com/missing.dl", options)
		).rejects.toThrow("Failed to fetch http://example.com/missing.dl: 404 Not Found");
	});

	it("should throw error when no .dl file found in zip", async () => {
		const mockArrayBuffer = new ArrayBuffer(100);
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options = createMockOptions(mockFetch);

		mockUnzipSync.mockReturnValue({
			"readme.txt": new Uint8Array([]),
			"__MACOSX/network.dl": new Uint8Array([]),
		});

		await expect(
			fetchDlDataset("http://example.com/archive.zip", options)
		).rejects.toThrow("No .dl file found in ZIP archive");
	});

	it("should skip __MACOSX files when finding .dl file in zip", async () => {
		const mockArrayBuffer = new ArrayBuffer(100);
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options = createMockOptions(mockFetch);

		const encoder = new TextEncoder();
		const dlData = encoder.encode("DL N=1\nDATA:\n0");

		mockUnzipSync.mockReturnValue({
			"__MACOSX/hidden.dl": new Uint8Array([]),
			"valid.dl": dlData,
		});

		mockParseDl.mockReturnValue({ n: 1, edges: [], format: "fullmatrix" });
		mockDlToJson.mockReturnValue({
			meta: { ...options.meta, directed: false },
			nodes: [{ id: "1" }],
			edges: [],
		});

		const result = await fetchDlDataset("http://example.com/archive.zip", options);

		expect(result.filename).toBe("valid.dl");
	});

	it("should use globalThis.fetch when no custom fetch provided", async () => {
		const originalFetch = globalThis.fetch;
		const dlContent = "DL N=1\nDATA:\n0";
		const encoder = new TextEncoder();
		const mockArrayBuffer = encoder.encode(dlContent).buffer;

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			statusText: "OK",
			arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
		});
		globalThis.fetch = mockFetch;

		mockParseDl.mockReturnValue({ n: 1, edges: [], format: "fullmatrix" });
		mockDlToJson.mockReturnValue({
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

		const options: FetchDlOptions = {
			meta: {
				name: "Test",
				description: "Test",
				source: "",
				url: "",
				citation: { authors: [], title: "", year: 2024 },
				retrieved: "",
			},
		};

		await fetchDlDataset("http://example.com/test.dl", options);

		expect(mockFetch).toHaveBeenCalledWith("http://example.com/test.dl");

		globalThis.fetch = originalFetch;
	});

	it("should pass directed option to dlToJson", async () => {
		const dlContent = "DL N=1\nDATA:\n0";
		const encoder = new TextEncoder();
		const mockArrayBuffer = encoder.encode(dlContent).buffer;
		const mockFetch = createMockFetch(200, mockArrayBuffer);

		const options: FetchDlOptions = {
			...createMockOptions(mockFetch),
			directed: true,
		};

		mockParseDl.mockReturnValue({ n: 1, edges: [], format: "fullmatrix" });
		mockDlToJson.mockReturnValue({
			meta: { ...options.meta, directed: true },
			nodes: [],
			edges: [],
		});

		await fetchDlDataset("http://example.com/test.dl", options);

		expect(mockDlToJson).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ directed: true })
		);
	});

	it("should handle URL with uppercase extension", async () => {
		const dlContent = "DL N=1\nDATA:\n0";
		const encoder = new TextEncoder();
		const mockArrayBuffer = encoder.encode(dlContent).buffer;
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options = createMockOptions(mockFetch);

		mockParseDl.mockReturnValue({ n: 1, edges: [], format: "fullmatrix" });
		mockDlToJson.mockReturnValue({
			meta: { ...options.meta, directed: false },
			nodes: [],
			edges: [],
		});

		const result = await fetchDlDataset("http://example.com/NETWORK.DL", options);

		expect(result.filename).toBe("NETWORK.DL");
	});

	it("should handle case-insensitive URL extension matching for zip", async () => {
		const mockArrayBuffer = new ArrayBuffer(100);
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options = createMockOptions(mockFetch);

		const encoder = new TextEncoder();
		const dlData = encoder.encode("DL N=1\nDATA:\n0");

		mockUnzipSync.mockReturnValue({
			"network.dl": dlData,
		});

		mockParseDl.mockReturnValue({ n: 1, edges: [], format: "fullmatrix" });
		mockDlToJson.mockReturnValue({
			meta: { ...options.meta, directed: false },
			nodes: [],
			edges: [],
		});

		const result = await fetchDlDataset("http://example.com/archive.ZIP", options);

		expect(mockUnzipSync).toHaveBeenCalled();
		expect(result.filename).toBe("network.dl");
	});

	it("should handle case-insensitive URL extension matching for gz", async () => {
		const mockArrayBuffer = new ArrayBuffer(100);
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options = createMockOptions(mockFetch);

		const dlContent = "DL N=1\nDATA:\n0";
		const encoder = new TextEncoder();
		const decompressedData = encoder.encode(dlContent);

		mockGunzipSync.mockReturnValue(decompressedData);
		mockParseDl.mockReturnValue({ n: 1, edges: [], format: "fullmatrix" });
		mockDlToJson.mockReturnValue({
			meta: { ...options.meta, directed: false },
			nodes: [],
			edges: [],
		});

		const result = await fetchDlDataset("http://example.com/network.dl.GZ", options);

		expect(mockGunzipSync).toHaveBeenCalled();
		expect(result.filename).toBe("network.dl");
	});
});

describe("FetchDlOptions interface", () => {
	it("should accept valid options", () => {
		const options: FetchDlOptions = {
			meta: {
				name: "Test",
				description: "A test network",
				source: "http://example.com",
				url: "http://example.com/test.dl",
				citation: {
					authors: ["Author"],
					title: "Title",
					year: 2024,
				},
				retrieved: "2024-01-17",
			},
			directed: true,
			fetch: vi.fn(),
		};

		expect(options.meta.name).toBe("Test");
		expect(options.directed).toBe(true);
	});
});

describe("FetchDlResult interface", () => {
	it("should have correct structure", () => {
		const result: FetchDlResult = {
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
			filename: "network.dl",
			archiveSize: 1024,
			contentSize: 512,
		};

		expect(result.filename).toBe("network.dl");
		expect(result.archiveSize).toBe(1024);
		expect(result.contentSize).toBe(512);
	});
});
