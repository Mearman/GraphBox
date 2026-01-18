import { afterEach,beforeEach, describe, expect, it, vi } from "vitest";

import type { ArchivedUrl, SnapshotOptions,WaybackOptions } from "./wayback";
import {
	checkArchived,
	formatAge,
	formatTimestamp,
	getSnapshots,
	parseTimestamp,
	parseTimestampToDate,
	submitToArchive,
} from "./wayback";

describe("submitToArchive", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("should submit URL and return archived URL on success", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			status: 200,
			url: "https://web.archive.org/web/20260117123456/https://example.com",
		});
		vi.stubGlobal("fetch", mockFetch);

		const result = await submitToArchive("https://example.com");

		expect(mockFetch).toHaveBeenCalledWith(
			"https://web.archive.org/save/https://example.com",
			expect.objectContaining({
				method: "GET",
				redirect: "follow",
			})
		);
		expect(result).not.toBeNull();
		expect(result!.original).toBe("https://example.com");
		expect(result!.archived).toBe("https://web.archive.org/web/20260117123456id_/https://example.com");
	});

	it("should return archived URL without id_ suffix when raw=false", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			status: 200,
			url: "https://web.archive.org/web/20260117123456/https://example.com",
		});
		vi.stubGlobal("fetch", mockFetch);

		const result = await submitToArchive("https://example.com", { raw: false });

		expect(result!.archived).toBe("https://web.archive.org/web/20260117123456/https://example.com");
	});

	it("should return null when response has no timestamp", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			status: 200,
			url: "https://web.archive.org/save/https://example.com",
		});
		vi.stubGlobal("fetch", mockFetch);

		const result = await submitToArchive("https://example.com");

		expect(result).toBeNull();
	});

	it("should retry on error with exponential backoff", async () => {
		const mockFetch = vi
			.fn()
			.mockRejectedValueOnce(new Error("Network error"))
			.mockResolvedValue({
				status: 200,
				url: "https://web.archive.org/web/20260117123456/https://example.com",
			});
		vi.stubGlobal("fetch", mockFetch);

		const resultPromise = submitToArchive("https://example.com", { maxRetries: 2 });

		// Advance timer to trigger retry
		await vi.advanceTimersByTimeAsync(5000);

		const result = await resultPromise;

		expect(mockFetch).toHaveBeenCalledTimes(2);
		expect(result).not.toBeNull();
	});

	it("should retry on 4xx/5xx status codes", async () => {
		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce({ status: 503 })
			.mockResolvedValue({
				status: 200,
				url: "https://web.archive.org/web/20260117123456/https://example.com",
			});
		vi.stubGlobal("fetch", mockFetch);

		const resultPromise = submitToArchive("https://example.com", { maxRetries: 2 });

		await vi.advanceTimersByTimeAsync(5000);

		const result = await resultPromise;

		expect(mockFetch).toHaveBeenCalledTimes(2);
		expect(result).not.toBeNull();
	});

	it("should return null after exhausting retries", async () => {
		const mockFetch = vi.fn().mockResolvedValue({ status: 500 });
		vi.stubGlobal("fetch", mockFetch);

		const resultPromise = submitToArchive("https://example.com", { maxRetries: 2 });

		await vi.advanceTimersByTimeAsync(5000);
		await vi.advanceTimersByTimeAsync(10_000);

		const result = await resultPromise;

		expect(mockFetch).toHaveBeenCalledTimes(2);
		expect(result).toBeNull();
	});

	it("should use custom user agent when provided", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			status: 200,
			url: "https://web.archive.org/web/20260117123456/https://example.com",
		});
		vi.stubGlobal("fetch", mockFetch);

		await submitToArchive("https://example.com", { userAgent: "custom-agent/1.0" });

		expect(mockFetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				headers: { "User-Agent": "custom-agent/1.0" },
			})
		);
	});
});

describe("checkArchived", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("should return archived URL when snapshot exists", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			status: 200,
			json: vi.fn().mockResolvedValue({
				archived_snapshots: {
					closest: {
						timestamp: "20260117123456",
						available: true,
					},
				},
			}),
		});
		vi.stubGlobal("fetch", mockFetch);

		const result = await checkArchived("https://example.com");

		expect(mockFetch).toHaveBeenCalledWith(
			"https://archive.org/wayback/available?url=https%3A%2F%2Fexample.com"
		);
		expect(result).not.toBeNull();
		expect(result!.original).toBe("https://example.com");
		expect(result!.archived).toBe("https://web.archive.org/web/20260117123456id_/https://example.com");
	});

	it("should return null when no snapshot exists", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			status: 200,
			json: vi.fn().mockResolvedValue({
				archived_snapshots: {},
			}),
		});
		vi.stubGlobal("fetch", mockFetch);

		const result = await checkArchived("https://example.com");

		expect(result).toBeNull();
	});

	it("should return null when snapshot is not available", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			status: 200,
			json: vi.fn().mockResolvedValue({
				archived_snapshots: {
					closest: {
						timestamp: "20260117123456",
						available: false,
					},
				},
			}),
		});
		vi.stubGlobal("fetch", mockFetch);

		const result = await checkArchived("https://example.com");

		expect(result).toBeNull();
	});

	it("should retry on error", async () => {
		const mockFetch = vi
			.fn()
			.mockRejectedValueOnce(new Error("Network error"))
			.mockResolvedValue({
				status: 200,
				json: vi.fn().mockResolvedValue({
					archived_snapshots: {
						closest: {
							timestamp: "20260117123456",
							available: true,
						},
					},
				}),
			});
		vi.stubGlobal("fetch", mockFetch);

		const resultPromise = checkArchived("https://example.com", { maxRetries: 2 });

		await vi.advanceTimersByTimeAsync(5000);

		const result = await resultPromise;

		expect(mockFetch).toHaveBeenCalledTimes(2);
		expect(result).not.toBeNull();
	});

	it("should return URL without id_ when raw=false", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			status: 200,
			json: vi.fn().mockResolvedValue({
				archived_snapshots: {
					closest: {
						timestamp: "20260117123456",
						available: true,
					},
				},
			}),
		});
		vi.stubGlobal("fetch", mockFetch);

		const result = await checkArchived("https://example.com", { raw: false });

		expect(result!.archived).toBe("https://web.archive.org/web/20260117123456/https://example.com");
	});
});

describe("getSnapshots", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should return list of snapshots", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue([
				["timestamp", "original"],
				["20260115123456", "https://example.com"],
				["20260110123456", "https://example.com"],
				["20260101123456", "https://example.com"],
			]),
		});
		vi.stubGlobal("fetch", mockFetch);

		const result = await getSnapshots("https://example.com");

		expect(result).toHaveLength(3);
		// Results should be reversed (most recent first)
		expect(result[0].archived).toContain("20260101123456");
		expect(result[2].archived).toContain("20260115123456");
	});

	it("should return empty array when no snapshots exist", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue([["timestamp", "original"]]),
		});
		vi.stubGlobal("fetch", mockFetch);

		const result = await getSnapshots("https://example.com");

		expect(result).toEqual([]);
	});

	it("should return empty array on fetch error", async () => {
		const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
		vi.stubGlobal("fetch", mockFetch);

		const result = await getSnapshots("https://example.com");

		expect(result).toEqual([]);
	});

	it("should return empty array on non-ok response", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
		});
		vi.stubGlobal("fetch", mockFetch);

		const result = await getSnapshots("https://example.com");

		expect(result).toEqual([]);
	});

	it("should apply limit parameter", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue([
				["timestamp", "original"],
				["20260117123456", "https://example.com"],
			]),
		});
		vi.stubGlobal("fetch", mockFetch);

		await getSnapshots("https://example.com", { limit: 5 });

		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("limit=-5")
		);
	});

	it("should apply date range parameters", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue([["timestamp", "original"]]),
		});
		vi.stubGlobal("fetch", mockFetch);

		await getSnapshots("https://example.com", {
			from: "20240101",
			to: "20241231",
		});

		const calledUrl = mockFetch.mock.calls[0][0] as string;
		expect(calledUrl).toContain("from=20240101");
		expect(calledUrl).toContain("to=20241231");
	});

	it("should use raw=false to exclude id_ suffix", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue([
				["timestamp", "original"],
				["20260117123456", "https://example.com"],
			]),
		});
		vi.stubGlobal("fetch", mockFetch);

		const result = await getSnapshots("https://example.com", { raw: false });

		expect(result[0].archived).not.toContain("id_");
	});
});

describe("parseTimestamp", () => {
	it("should extract timestamp from archived URL with id_", () => {
		const url = "https://web.archive.org/web/20260117111255id_/https://example.com";
		const timestamp = parseTimestamp(url);

		expect(timestamp).toBe("20260117111255");
	});

	it("should extract timestamp from archived URL without id_", () => {
		const url = "https://web.archive.org/web/20260117111255/https://example.com";
		const timestamp = parseTimestamp(url);

		expect(timestamp).toBe("20260117111255");
	});

	it("should return null for invalid URL", () => {
		expect(parseTimestamp("https://example.com")).toBeNull();
		expect(parseTimestamp("https://web.archive.org/")).toBeNull();
		expect(parseTimestamp("invalid")).toBeNull();
	});
});

describe("formatTimestamp", () => {
	it("should format timestamp as readable date string", () => {
		expect(formatTimestamp("20260117111255")).toBe("2026-01-17 11:12:55");
		expect(formatTimestamp("20241231235959")).toBe("2024-12-31 23:59:59");
		expect(formatTimestamp("20200101000000")).toBe("2020-01-01 00:00:00");
	});

	it("should return original string for invalid timestamps", () => {
		expect(formatTimestamp("invalid")).toBe("invalid");
		expect(formatTimestamp("123")).toBe("123");
		expect(formatTimestamp("")).toBe("");
	});
});

describe("parseTimestampToDate", () => {
	it("should parse timestamp to Date object", () => {
		const date = parseTimestampToDate("20260117111255");

		expect(date).not.toBeNull();
		expect(date!.getUTCFullYear()).toBe(2026);
		expect(date!.getUTCMonth()).toBe(0); // January
		expect(date!.getUTCDate()).toBe(17);
		expect(date!.getUTCHours()).toBe(11);
		expect(date!.getUTCMinutes()).toBe(12);
		expect(date!.getUTCSeconds()).toBe(55);
	});

	it("should return null for invalid timestamps", () => {
		expect(parseTimestampToDate("invalid")).toBeNull();
		expect(parseTimestampToDate("12345")).toBeNull();
		expect(parseTimestampToDate("")).toBeNull();
	});

	it("should handle edge cases", () => {
		// December 31st
		const dec31 = parseTimestampToDate("20241231235959");
		expect(dec31!.getUTCMonth()).toBe(11); // December (0-indexed)
		expect(dec31!.getUTCDate()).toBe(31);

		// January 1st
		const jan1 = parseTimestampToDate("20250101000000");
		expect(jan1!.getUTCMonth()).toBe(0);
		expect(jan1!.getUTCDate()).toBe(1);
	});
});

describe("formatAge", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-17T12:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("should format age as 'just now' for recent timestamps", () => {
		const timestamp = "20260117115959"; // 1 second ago
		expect(formatAge(timestamp)).toBe("just now");
	});

	it("should format age in minutes", () => {
		const timestamp = "20260117114500"; // 15 minutes ago
		expect(formatAge(timestamp)).toBe("15 minutes ago");
	});

	it("should format age in hours", () => {
		const timestamp = "20260117100000"; // 2 hours ago
		expect(formatAge(timestamp)).toBe("2 hours ago");
	});

	it("should format age in days", () => {
		const timestamp = "20260115120000"; // 2 days ago
		expect(formatAge(timestamp)).toBe("2 days ago");
	});

	it("should format age in weeks", () => {
		const timestamp = "20260103120000"; // 2 weeks ago
		expect(formatAge(timestamp)).toBe("2 weeks ago");
	});

	it("should format age in months", () => {
		const timestamp = "20251117120000"; // 2 months ago
		expect(formatAge(timestamp)).toBe("2 months ago");
	});

	it("should format age in years", () => {
		const timestamp = "20240117120000"; // 2 years ago
		expect(formatAge(timestamp)).toBe("2 years ago");
	});

	it("should use singular form for single units", () => {
		// 1 day ago
		const oneDayAgo = "20260116120000";
		expect(formatAge(oneDayAgo)).toBe("1 day ago");

		// 1 week ago
		const oneWeekAgo = "20260110120000";
		expect(formatAge(oneWeekAgo)).toBe("1 week ago");
	});

	it("should return 'unknown' for invalid timestamps", () => {
		expect(formatAge("invalid")).toBe("unknown");
		expect(formatAge("")).toBe("unknown");
	});
});

describe("interface types", () => {
	it("ArchivedUrl should have correct shape", () => {
		const archived: ArchivedUrl = {
			original: "https://example.com",
			archived: "https://web.archive.org/web/20260117123456id_/https://example.com",
		};

		expect(archived.original).toBeDefined();
		expect(archived.archived).toBeDefined();
	});

	it("WaybackOptions should accept all optional properties", () => {
		const options: WaybackOptions = {
			maxRetries: 5,
			userAgent: "test-agent",
			raw: false,
		};

		expect(options.maxRetries).toBe(5);
		expect(options.userAgent).toBe("test-agent");
		expect(options.raw).toBe(false);
	});

	it("SnapshotOptions should accept all optional properties", () => {
		const options: SnapshotOptions = {
			limit: 10,
			from: "20240101",
			to: "20241231",
			raw: true,
		};

		expect(options.limit).toBe(10);
		expect(options.from).toBe("20240101");
		expect(options.to).toBe("20241231");
		expect(options.raw).toBe(true);
	});
});
