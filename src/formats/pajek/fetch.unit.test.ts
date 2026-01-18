import { afterEach,beforeEach, describe, expect, it, vi } from "vitest";

import type { FetchPajekOptions, FetchPajekResult } from "./fetch";
import { fetchPajekDataset } from "./fetch";

// Mock the fflate module
vi.mock("fflate", () => ({
	unzipSync: vi.fn(),
	gunzipSync: vi.fn(),
}));

// Mock the parse module
vi.mock("./parse", () => ({
	parsePajek: vi.fn(),
	pajekToJson: vi.fn(),
}));

import { gunzipSync,unzipSync } from "fflate";

import { pajekToJson,parsePajek } from "./parse";

describe("fetchPajekDataset", () => {
	const mockUnzipSync = vi.mocked(unzipSync);
	const mockGunzipSync = vi.mocked(gunzipSync);
	const mockParsePajek = vi.mocked(parsePajek);
	const mockPajekToJson = vi.mocked(pajekToJson);

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
	): FetchPajekOptions => ({
		fetch: mockFetch,
		meta: {
			name: "Test Network",
			description: "A test Pajek network",
			source: "http://vlado.fmf.uni-lj.si/pub/networks/pajek/",
			url: "http://example.com/test.net",
			citation: {
				authors: ["Vladimir Batagelj", "Andrej Mrvar"],
				title: "Pajek - Program for Large Network Analysis",
				year: 1998,
			},
			retrieved: "2024-01-17",
		},
	});

	it("should fetch and parse a plain .net file", async () => {
		const pajekContent = "*Vertices 3\n1 \"A\"\n2 \"B\"\n3 \"C\"\n*Edges\n1 2\n2 3";
		const encoder = new TextEncoder();
		const mockArrayBuffer = encoder.encode(pajekContent).buffer;
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options = createMockOptions(mockFetch);

		mockParsePajek.mockReturnValue({ vertexCount: 0, vertices: [], edges: [], arcs: [], directed: false });
		mockPajekToJson.mockReturnValue({
			meta: { ...options.meta, directed: false },
			nodes: [{ id: "1" }, { id: "2" }, { id: "3" }],
			edges: [{ source: "1", target: "2" }, { source: "2", target: "3" }],
		});

		const result = await fetchPajekDataset("http://example.com/network.net", options);

		expect(mockFetch).toHaveBeenCalledWith("http://example.com/network.net");
		expect(mockParsePajek).toHaveBeenCalled();
		expect(mockPajekToJson).toHaveBeenCalled();
		expect(result.filename).toBe("network.net");
		expect(result.archiveSize).toBe(mockArrayBuffer.byteLength);
		expect(result.contentSize).toBe(mockArrayBuffer.byteLength);
		expect(result.graph.nodes).toHaveLength(3);
		expect(result.graph.edges).toHaveLength(2);
	});

	it("should fetch and decompress a .gz file", async () => {
		const mockArrayBuffer = new ArrayBuffer(100);
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options = createMockOptions(mockFetch);

		const pajekContent = "*Vertices 2\n1 \"A\"\n2 \"B\"\n*Edges\n1 2";
		const encoder = new TextEncoder();
		const decompressedData = encoder.encode(pajekContent);

		mockGunzipSync.mockReturnValue(decompressedData);
		mockParsePajek.mockReturnValue({ vertexCount: 0, vertices: [], edges: [], arcs: [], directed: false });
		mockPajekToJson.mockReturnValue({
			meta: { ...options.meta, directed: false },
			nodes: [{ id: "1" }, { id: "2" }],
			edges: [{ source: "1", target: "2" }],
		});

		const result = await fetchPajekDataset("http://example.com/network.net.gz", options);

		expect(mockGunzipSync).toHaveBeenCalled();
		expect(result.filename).toBe("network.net");
		expect(result.archiveSize).toBe(100);
		expect(result.contentSize).toBe(decompressedData.byteLength);
	});

	it("should fetch and extract from a .zip archive", async () => {
		const mockArrayBuffer = new ArrayBuffer(200);
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options = createMockOptions(mockFetch);

		const pajekContent = "*Vertices 1\n1 \"A\"";
		const encoder = new TextEncoder();
		const netData = encoder.encode(pajekContent);

		mockUnzipSync.mockReturnValue({
			"data/network.net": netData,
		});

		mockParsePajek.mockReturnValue({ vertexCount: 0, vertices: [], edges: [], arcs: [], directed: false });
		mockPajekToJson.mockReturnValue({
			meta: { ...options.meta, directed: false },
			nodes: [{ id: "1" }],
			edges: [],
		});

		const result = await fetchPajekDataset("http://example.com/archive.zip", options);

		expect(mockUnzipSync).toHaveBeenCalled();
		expect(result.filename).toBe("data/network.net");
		expect(result.archiveSize).toBe(200);
		expect(result.contentSize).toBe(netData.byteLength);
	});

	it("should throw error when fetch fails", async () => {
		const mockArrayBuffer = new ArrayBuffer(0);
		const mockFetch = createMockFetch(404, mockArrayBuffer, "Not Found");
		const options = createMockOptions(mockFetch);

		await expect(
			fetchPajekDataset("http://example.com/missing.net", options)
		).rejects.toThrow("Failed to fetch http://example.com/missing.net: 404 Not Found");
	});

	it("should throw error when no .net file found in zip", async () => {
		const mockArrayBuffer = new ArrayBuffer(100);
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options = createMockOptions(mockFetch);

		mockUnzipSync.mockReturnValue({
			"readme.txt": new Uint8Array([]),
			"__MACOSX/network.net": new Uint8Array([]),
		});

		await expect(
			fetchPajekDataset("http://example.com/archive.zip", options)
		).rejects.toThrow("No .net file found in ZIP archive");
	});

	it("should skip __MACOSX files when finding .net file in zip", async () => {
		const mockArrayBuffer = new ArrayBuffer(100);
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options = createMockOptions(mockFetch);

		const encoder = new TextEncoder();
		const netData = encoder.encode("*Vertices 1\n1 \"A\"");

		mockUnzipSync.mockReturnValue({
			"__MACOSX/hidden.net": new Uint8Array([]),
			"valid.net": netData,
		});

		mockParsePajek.mockReturnValue({ vertexCount: 0, vertices: [], edges: [], arcs: [], directed: false });
		mockPajekToJson.mockReturnValue({
			meta: { ...options.meta, directed: false },
			nodes: [{ id: "1" }],
			edges: [],
		});

		const result = await fetchPajekDataset("http://example.com/archive.zip", options);

		expect(result.filename).toBe("valid.net");
	});

	it("should use globalThis.fetch when no custom fetch provided", async () => {
		const originalFetch = globalThis.fetch;
		const pajekContent = "*Vertices 1\n1 \"A\"";
		const encoder = new TextEncoder();
		const mockArrayBuffer = encoder.encode(pajekContent).buffer;

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			statusText: "OK",
			arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
		});
		globalThis.fetch = mockFetch;

		mockParsePajek.mockReturnValue({ vertexCount: 0, vertices: [], edges: [], arcs: [], directed: false });
		mockPajekToJson.mockReturnValue({
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

		const options: FetchPajekOptions = {
			meta: {
				name: "Test",
				description: "Test",
				source: "",
				url: "",
				citation: { authors: [], title: "", year: 2024 },
				retrieved: "",
			},
		};

		await fetchPajekDataset("http://example.com/test.net", options);

		expect(mockFetch).toHaveBeenCalledWith("http://example.com/test.net");

		globalThis.fetch = originalFetch;
	});

	it("should pass directed option to pajekToJson", async () => {
		const pajekContent = "*Vertices 1\n1 \"A\"";
		const encoder = new TextEncoder();
		const mockArrayBuffer = encoder.encode(pajekContent).buffer;
		const mockFetch = createMockFetch(200, mockArrayBuffer);

		const options: FetchPajekOptions = {
			...createMockOptions(mockFetch),
			directed: true,
		};

		mockParsePajek.mockReturnValue({ vertexCount: 0, vertices: [], edges: [], arcs: [], directed: false });
		mockPajekToJson.mockReturnValue({
			meta: { ...options.meta, directed: true },
			nodes: [],
			edges: [],
		});

		await fetchPajekDataset("http://example.com/test.net", options);

		expect(mockPajekToJson).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ directed: true })
		);
	});

	it("should handle URL with uppercase extension", async () => {
		const pajekContent = "*Vertices 1\n1 \"A\"";
		const encoder = new TextEncoder();
		const mockArrayBuffer = encoder.encode(pajekContent).buffer;
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options = createMockOptions(mockFetch);

		mockParsePajek.mockReturnValue({ vertexCount: 0, vertices: [], edges: [], arcs: [], directed: false });
		mockPajekToJson.mockReturnValue({
			meta: { ...options.meta, directed: false },
			nodes: [],
			edges: [],
		});

		const result = await fetchPajekDataset("http://example.com/NETWORK.NET", options);

		expect(result.filename).toBe("NETWORK.NET");
	});
});

describe("FetchPajekOptions interface", () => {
	it("should accept valid options", () => {
		const options: FetchPajekOptions = {
			meta: {
				name: "Test",
				description: "A test network",
				source: "http://example.com",
				url: "http://example.com/test.net",
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

describe("FetchPajekResult interface", () => {
	it("should have correct structure", () => {
		const result: FetchPajekResult = {
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
			filename: "network.net",
			archiveSize: 1024,
			contentSize: 512,
		};

		expect(result.filename).toBe("network.net");
		expect(result.archiveSize).toBe(1024);
		expect(result.contentSize).toBe(512);
	});
});
