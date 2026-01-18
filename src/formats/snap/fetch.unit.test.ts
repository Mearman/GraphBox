import { afterEach,beforeEach, describe, expect, it, vi } from "vitest";

import type { FetchSnapOptions, FetchSnapResult } from "./fetch";
import { fetchSnapDataset } from "./fetch";

// Mock the fflate module
vi.mock("fflate", () => ({
	gunzipSync: vi.fn(),
}));

// Mock the parse module
vi.mock("./parse", () => ({
	parseSnap: vi.fn(),
	snapToJson: vi.fn(),
}));

import { gunzipSync } from "fflate";

import { parseSnap, snapToJson } from "./parse";

describe("fetchSnapDataset", () => {
	const mockGunzipSync = vi.mocked(gunzipSync);
	const mockParseSnap = vi.mocked(parseSnap);
	const mockSnapToJson = vi.mocked(snapToJson);

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
	): FetchSnapOptions => ({
		fetch: mockFetch,
		meta: {
			name: "Test SNAP Dataset",
			description: "A test SNAP edge list",
			source: "https://snap.stanford.edu/data/",
			url: "https://snap.stanford.edu/data/test.txt.gz",
			citation: {
				authors: ["Jure Leskovec", "Andrej Krevl"],
				title: "SNAP Datasets: Stanford Large Network Dataset Collection",
				year: 2014,
			},
			retrieved: "2024-01-17",
		},
	});

	it("should fetch and decompress a .gz file", async () => {
		const mockArrayBuffer = new ArrayBuffer(100);
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options = createMockOptions(mockFetch);

		const snapContent = "# Comments\n0 1\n1 2\n2 0";
		const encoder = new TextEncoder();
		const decompressedData = encoder.encode(snapContent);

		mockGunzipSync.mockReturnValue(decompressedData);
		mockParseSnap.mockReturnValue({ edges: [], meta: { comments: [] } });
		mockSnapToJson.mockReturnValue({
			meta: { ...options.meta, directed: false },
			nodes: [{ id: "0" }, { id: "1" }, { id: "2" }],
			edges: [
				{ source: "0", target: "1" },
				{ source: "1", target: "2" },
				{ source: "2", target: "0" },
			],
		});

		const result = await fetchSnapDataset("https://snap.stanford.edu/data/test.txt.gz", options);

		expect(mockFetch).toHaveBeenCalledWith("https://snap.stanford.edu/data/test.txt.gz");
		expect(mockGunzipSync).toHaveBeenCalled();
		expect(mockParseSnap).toHaveBeenCalledWith(snapContent);
		expect(mockSnapToJson).toHaveBeenCalled();
		expect(result.archiveSize).toBe(100);
		expect(result.contentSize).toBe(decompressedData.byteLength);
		expect(result.graph.nodes).toHaveLength(3);
		expect(result.graph.edges).toHaveLength(3);
	});

	it("should fetch a plain text file without decompression", async () => {
		const snapContent = "0 1\n1 2";
		const encoder = new TextEncoder();
		const mockArrayBuffer = encoder.encode(snapContent).buffer;
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options = createMockOptions(mockFetch);

		mockParseSnap.mockReturnValue({ edges: [], meta: { comments: [] } });
		mockSnapToJson.mockReturnValue({
			meta: { ...options.meta, directed: false },
			nodes: [{ id: "0" }, { id: "1" }, { id: "2" }],
			edges: [{ source: "0", target: "1" }, { source: "1", target: "2" }],
		});

		const result = await fetchSnapDataset("https://snap.stanford.edu/data/test.txt", options);

		expect(mockGunzipSync).not.toHaveBeenCalled();
		expect(result.archiveSize).toBe(mockArrayBuffer.byteLength);
		expect(result.contentSize).toBe(mockArrayBuffer.byteLength);
	});

	it("should throw error when fetch fails", async () => {
		const mockArrayBuffer = new ArrayBuffer(0);
		const mockFetch = createMockFetch(500, mockArrayBuffer, "Internal Server Error");
		const options = createMockOptions(mockFetch);

		await expect(
			fetchSnapDataset("https://snap.stanford.edu/data/missing.txt.gz", options)
		).rejects.toThrow("Failed to fetch https://snap.stanford.edu/data/missing.txt.gz: 500 Internal Server Error");
	});

	it("should use globalThis.fetch when no custom fetch provided", async () => {
		const originalFetch = globalThis.fetch;
		const snapContent = "0 1";
		const encoder = new TextEncoder();
		const mockArrayBuffer = encoder.encode(snapContent).buffer;

		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			statusText: "OK",
			arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
		});
		globalThis.fetch = mockFetch;

		mockParseSnap.mockReturnValue({ edges: [], meta: { comments: [] } });
		mockSnapToJson.mockReturnValue({
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

		const options: FetchSnapOptions = {
			meta: {
				name: "Test",
				description: "Test",
				source: "",
				url: "",
				citation: { authors: [], title: "", year: 2024 },
				retrieved: "",
			},
		};

		await fetchSnapDataset("https://snap.stanford.edu/data/test.txt", options);

		expect(mockFetch).toHaveBeenCalledWith("https://snap.stanford.edu/data/test.txt");

		globalThis.fetch = originalFetch;
	});

	it("should pass directed option to snapToJson", async () => {
		const snapContent = "0 1";
		const encoder = new TextEncoder();
		const mockArrayBuffer = encoder.encode(snapContent).buffer;
		const mockFetch = createMockFetch(200, mockArrayBuffer);

		const options: FetchSnapOptions = {
			...createMockOptions(mockFetch),
			directed: true,
		};

		mockParseSnap.mockReturnValue({ edges: [], meta: { comments: [] } });
		mockSnapToJson.mockReturnValue({
			meta: { ...options.meta, directed: true },
			nodes: [],
			edges: [],
		});

		await fetchSnapDataset("https://snap.stanford.edu/data/test.txt", options);

		expect(mockSnapToJson).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ directed: true })
		);
	});

	it("should handle 403 Forbidden response", async () => {
		const mockArrayBuffer = new ArrayBuffer(0);
		const mockFetch = createMockFetch(403, mockArrayBuffer, "Forbidden");
		const options = createMockOptions(mockFetch);

		await expect(
			fetchSnapDataset("https://snap.stanford.edu/data/restricted.txt.gz", options)
		).rejects.toThrow("Failed to fetch https://snap.stanford.edu/data/restricted.txt.gz: 403 Forbidden");
	});

	it("should handle empty decompressed content", async () => {
		const mockArrayBuffer = new ArrayBuffer(50);
		const mockFetch = createMockFetch(200, mockArrayBuffer);
		const options = createMockOptions(mockFetch);

		const emptyContent = "";
		const encoder = new TextEncoder();
		const decompressedData = encoder.encode(emptyContent);

		mockGunzipSync.mockReturnValue(decompressedData);
		mockParseSnap.mockReturnValue({ edges: [], meta: { comments: [] } });
		mockSnapToJson.mockReturnValue({
			meta: { ...options.meta, directed: false },
			nodes: [],
			edges: [],
		});

		const result = await fetchSnapDataset("https://snap.stanford.edu/data/empty.txt.gz", options);

		expect(result.graph.nodes).toHaveLength(0);
		expect(result.graph.edges).toHaveLength(0);
		expect(result.contentSize).toBe(0);
	});
});

describe("FetchSnapOptions interface", () => {
	it("should accept valid options", () => {
		const options: FetchSnapOptions = {
			meta: {
				name: "Test",
				description: "A test dataset",
				source: "https://snap.stanford.edu/data/",
				url: "https://snap.stanford.edu/data/test.txt.gz",
				citation: {
					authors: ["Author"],
					title: "Title",
					year: 2024,
				},
				retrieved: "2024-01-17",
			},
			directed: false,
			fetch: vi.fn(),
		};

		expect(options.meta.name).toBe("Test");
		expect(options.directed).toBe(false);
	});
});

describe("FetchSnapResult interface", () => {
	it("should have correct structure", () => {
		const result: FetchSnapResult = {
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
			archiveSize: 1024,
			contentSize: 4096,
		};

		expect(result.archiveSize).toBe(1024);
		expect(result.contentSize).toBe(4096);
	});
});
