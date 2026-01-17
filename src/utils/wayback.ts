/**
 * Wayback Machine utilities for archiving and retrieving URLs.
 *
 * Provides functions to submit URLs to the Internet Archive's Wayback Machine,
 * check for existing archives, and retrieve historical snapshots.
 */

export interface ArchivedUrl {
	original: string;
	archived: string;
}

export interface UrlFormatOptions {
	/** Include id_ suffix for raw content without Wayback toolbar (default: true) */
	raw?: boolean;
}

export interface WaybackOptions extends UrlFormatOptions {
	maxRetries?: number;
	userAgent?: string;
}

export interface SnapshotOptions extends UrlFormatOptions {
	limit?: number;
	from?: string; // YYYYMMDD format
	to?: string; // YYYYMMDD format
}

const DEFAULT_USER_AGENT = "graphbox-wayback/1.0";
const DEFAULT_MAX_RETRIES = 3;

/**
 * Build archived URL. Use raw=true (default) for id_ format (no Wayback toolbar).
 * @param timestamp
 * @param url
 * @param raw
 */
const buildArchivedUrl = (timestamp: string, url: string, raw = true): string =>
	`https://web.archive.org/web/${timestamp}${raw ? "id_" : ""}/${url}`;

/**
 * Sleep for a specified duration.
 * @param ms
 */
const sleep = (ms: number): Promise<void> =>
	new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate exponential backoff delay.
 * @param attempt
 */
const getBackoffDelay = (attempt: number): number =>
	Math.min(5000 * Math.pow(2, attempt - 1), 60_000);

/**
 * Submit a URL to Wayback Machine for archiving.
 *
 * Uses the Save Page Now API to create a new snapshot.
 * Returns the archived URL with id_ suffix for direct access, or null on failure.
 *
 * @param url
 * @param options
 * @example
 * ```ts
 * const result = await submitToArchive("https://example.com");
 * if (result) {
 *   console.log(result.archived); // https://web.archive.org/web/20260117.../https://example.com
 * }
 * ```
 */
export const submitToArchive = async (
	url: string,
	options: WaybackOptions = {},
): Promise<ArchivedUrl | null> => {
	const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
	const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
	const raw = options.raw ?? true;

	const attempt = async (attemptNumber: number): Promise<ArchivedUrl | null> => {
		const saveUrl = `https://web.archive.org/save/${url}`;

		try {
			const response = await fetch(saveUrl, {
				method: "GET",
				headers: { "User-Agent": userAgent },
				redirect: "follow",
			});

			if (response.status >= 400) {
				if (attemptNumber < maxRetries) {
					const delay = getBackoffDelay(attemptNumber);
					await sleep(delay);
					return attempt(attemptNumber + 1);
				}
				return null;
			}

			// Extract timestamp from response URL
			// Format: https://web.archive.org/web/YYYYMMDDHHmmss/url
			const match = response.url.match(/\/web\/(\d{14})\//);
			if (match) {
				return {
					original: url,
					archived: buildArchivedUrl(match[1], url, raw),
				};
			}

			return null;
		} catch {
			if (attemptNumber < maxRetries) {
				const delay = getBackoffDelay(attemptNumber);
				await sleep(delay);
				return attempt(attemptNumber + 1);
			}
			return null;
		}
	};

	return attempt(1);
};

/**
 * Check if a URL has been archived and get the latest snapshot.
 *
 * Uses the Wayback Availability API to find the closest available snapshot.
 *
 * @param url
 * @param options
 * @example
 * ```ts
 * const result = await checkArchived("https://example.com");
 * if (result) {
 *   console.log("Already archived:", result.archived);
 * }
 * ```
 */
export const checkArchived = async (
	url: string,
	options: WaybackOptions = {},
): Promise<ArchivedUrl | null> => {
	const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
	const raw = options.raw ?? true;

	const attempt = async (attemptNumber: number): Promise<ArchivedUrl | null> => {
		const checkUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;

		try {
			const response = await fetch(checkUrl);

			if (response.status >= 400) {
				if (attemptNumber < maxRetries) {
					const delay = getBackoffDelay(attemptNumber);
					await sleep(delay);
					return attempt(attemptNumber + 1);
				}
				return null;
			}

			const data = (await response.json()) as {
				archived_snapshots?: {
					closest?: {
						timestamp?: string;
						available?: boolean;
					};
				};
			};

			if (data.archived_snapshots?.closest?.available) {
				const timestamp = data.archived_snapshots.closest.timestamp ?? "";
				return {
					original: url,
					archived: buildArchivedUrl(timestamp, url, raw),
				};
			}

			return null;
		} catch {
			if (attemptNumber < maxRetries) {
				const delay = getBackoffDelay(attemptNumber);
				await sleep(delay);
				return attempt(attemptNumber + 1);
			}
			return null;
		}
	};

	return attempt(1);
};

/**
 * Get multiple historical snapshots for a URL.
 *
 * Uses the CDX Server API to retrieve snapshot history.
 * Results are returned in reverse chronological order (most recent first).
 *
 * @param url
 * @param options
 * @example
 * ```ts
 * // Get last 5 snapshots
 * const snapshots = await getSnapshots("https://example.com", { limit: 5 });
 * for (const snapshot of snapshots) {
 *   console.log(snapshot.archived);
 * }
 *
 * // Get snapshots from 2024
 * const snapshots2024 = await getSnapshots("https://example.com", {
 *   from: "20240101",
 *   to: "20241231",
 * });
 * ```
 */
export const getSnapshots = async (
	url: string,
	options: SnapshotOptions = {},
): Promise<ArchivedUrl[]> => {
	const raw = options.raw ?? true;
	const parameters = new URLSearchParams({
		url,
		output: "json",
		fl: "timestamp,original",
		collapse: "digest", // Deduplicate identical content
	});

	if (options.limit !== undefined) {
		// Use negative limit to get most recent snapshots first
		parameters.set("limit", String(-options.limit));
	}
	if (options.from !== undefined) {
		parameters.set("from", options.from);
	}
	if (options.to !== undefined) {
		parameters.set("to", options.to);
	}

	const cdxUrl = `https://web.archive.org/cdx/search/cdx?${parameters.toString()}`;

	try {
		const response = await fetch(cdxUrl);

		if (!response.ok) {
			return [];
		}

		const data = (await response.json()) as string[][];

		// First row is header: ["timestamp", "original"]
		// Skip header and map remaining rows
		if (data.length <= 1) {
			return [];
		}

		// Results come chronological, reverse to show most recent first
		return data
			.slice(1)
			.map(([timestamp, original]) => ({
				original,
				archived: buildArchivedUrl(timestamp, original, raw),
			}))
			.reverse();
	} catch {
		return [];
	}
};

/**
 * Parse the timestamp from a Wayback Machine archived URL.
 *
 * @param archivedUrl
 * @example
 * ```ts
 * const timestamp = parseTimestamp("https://web.archive.org/web/20260117111255id_/https://example.com");
 * // Returns "20260117111255"
 * ```
 */
export const parseTimestamp = (archivedUrl: string): string | null => {
	const match = archivedUrl.match(/\/web\/(\d{14})(?:id_)?\//);
	return match ? match[1] : null;
};

/**
 * Format a Wayback timestamp as a readable date string.
 *
 * @param timestamp
 * @example
 * ```ts
 * formatTimestamp("20260117111255"); // "2026-01-17 11:12:55"
 * ```
 */
export const formatTimestamp = (timestamp: string): string => {
	if (timestamp.length !== 14) return timestamp;

	const year = timestamp.slice(0, 4);
	const month = timestamp.slice(4, 6);
	const day = timestamp.slice(6, 8);
	const hour = timestamp.slice(8, 10);
	const minute = timestamp.slice(10, 12);
	const second = timestamp.slice(12, 14);

	return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
};

/**
 * Parse a Wayback timestamp into a Date object.
 * @param timestamp
 */
export const parseTimestampToDate = (timestamp: string): Date | null => {
	if (timestamp.length !== 14) return null;

	const year = Number.parseInt(timestamp.slice(0, 4), 10);
	const month = Number.parseInt(timestamp.slice(4, 6), 10) - 1; // 0-indexed
	const day = Number.parseInt(timestamp.slice(6, 8), 10);
	const hour = Number.parseInt(timestamp.slice(8, 10), 10);
	const minute = Number.parseInt(timestamp.slice(10, 12), 10);
	const second = Number.parseInt(timestamp.slice(12, 14), 10);

	return new Date(Date.UTC(year, month, day, hour, minute, second));
};

/**
 * Format the age of a snapshot as a human-readable string.
 *
 * @param timestamp
 * @example
 * ```ts
 * formatAge("20260115111255"); // "2 days ago"
 * formatAge("20251117111255"); // "2 months ago"
 * ```
 */
export const formatAge = (timestamp: string): string => {
	const date = parseTimestampToDate(timestamp);
	if (!date) return "unknown";

	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);
	const diffWeeks = Math.floor(diffDays / 7);
	const diffMonths = Math.floor(diffDays / 30);
	const diffYears = Math.floor(diffDays / 365);

	if (diffYears > 0) return `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
	if (diffMonths > 0) return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
	if (diffWeeks > 0) return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
	if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
	if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
	if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
	return "just now";
};
